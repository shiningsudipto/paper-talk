"use client"

import * as React from "react"
import { AlertCircleIcon, Loader2Icon, MicIcon, MicOffIcon, PhoneIcon, SquareIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/components/paper-talk/chat-store"

type ConnectionState = "disconnected" | "connecting" | "connected" | "error"
type Transcript = { id: string; role: "user" | "assistant"; text: string }

function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2)
  const view = new DataView(buffer)
  let offset = 0
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

function base64EncodeAudio(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const int16Array = new Int16Array(bytes.buffer)
  const float32Array = new Float32Array(int16Array.length)
  for (let i = 0; i < int16Array.length; i++) float32Array[i] = int16Array[i] / 32768
  return float32Array
}

function VoicePanel({ voiceName, systemInstruction }: { voiceName: string; systemInstruction: string }) {
  const isSyncingSummary = useChatStore((state) => state.isSyncingSummary)
  const [connectionState, setConnectionState] = React.useState<ConnectionState>("disconnected")
  const [errorMsg, setErrorMsg] = React.useState("")
  const [transcripts, setTranscripts] = React.useState<Transcript[]>([])
  const [isMuted, setIsMuted] = React.useState(false)
  const [micActivity, setMicActivity] = React.useState(0)
  const [assistantSpeaking, setAssistantSpeaking] = React.useState(false)

  const wsRef = React.useRef<WebSocket | null>(null)
  const inputAudioCtxRef = React.useRef<AudioContext | null>(null)
  const outputAudioCtxRef = React.useRef<AudioContext | null>(null)
  const processorRef = React.useRef<ScriptProcessorNode | null>(null)
  const micStreamRef = React.useRef<MediaStream | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const animFrameRef = React.useRef<number | null>(null)
  const nextStartTimeRef = React.useRef(0)
  const activeSourcesRef = React.useRef<AudioBufferSourceNode[]>([])
  const isMutedRef = React.useRef(false)
  const connectionStateRef = React.useRef<ConnectionState>("disconnected")
  const activeUserIdRef = React.useRef<string | null>(null)
  const activeAssistantIdRef = React.useRef<string | null>(null)
  const transcriptsRef = React.useRef<Transcript[]>([])
  const summarizedThroughRef = React.useRef(0)
  const isSyncingSummaryRef = React.useRef(false)
  const hasPendingSummarySyncRef = React.useRef(false)

  // Local, transient dialogue log for this call only — not written into the
  // shared chat session. Cross-surface memory is handled separately, by
  // folding completed turns into the session's rolling summary (see
  // maybeSyncSummary below), so voice and text stay in sync without mixing
  // raw transcripts into each other's message list.
  const appendTranscriptChunk = React.useCallback((role: "user" | "assistant", chunk: string, finished: boolean) => {
    const idRef = role === "user" ? activeUserIdRef : activeAssistantIdRef
    const prev = transcriptsRef.current
    let next: Transcript[]
    if (idRef.current) {
      const index = prev.findIndex((t) => t.id === idRef.current)
      if (index !== -1) {
        next = [...prev]
        next[index] = { ...next[index], text: next[index].text + chunk }
        transcriptsRef.current = next
        if (finished) idRef.current = null
        setTranscripts(next)
        return
      }
    }
    const id = crypto.randomUUID()
    idRef.current = id
    next = [...prev, { id, role, text: chunk }]
    transcriptsRef.current = next
    if (finished) idRef.current = null
    setTranscripts(next)
  }, [])

  const maybeSyncSummary = React.useCallback((force = false) => {
    const run = (f: boolean) => {
      if (isSyncingSummaryRef.current) {
        hasPendingSummarySyncRef.current = true
        return
      }

      const all = transcriptsRef.current
      const newOnes = all.slice(summarizedThroughRef.current)
      const minLength = f ? 1 : 2
      if (newOnes.length < minLength) return

      isSyncingSummaryRef.current = true
      hasPendingSummarySyncRef.current = false
      const newThroughCount = all.length

      const state = useChatStore.getState()
      const sessionId = state.activeSessionId
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) {
        isSyncingSummaryRef.current = false
        return
      }

      state.setIsSyncingSummary(true)

      fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previousSummary: session.summary,
          newMessages: newOnes.map((t) => ({ role: t.role, content: t.text })),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.summary) {
            summarizedThroughRef.current = newThroughCount
            // Pass the session's current (unchanged) text-message count through
            // — this only tracks voice's own place in `transcripts`, and must
            // not disturb chat's separate bookkeeping of its own messages array.
            useChatStore.getState().setSummary(sessionId, data.summary, session.messages.length)
          }
        })
        .catch((error) => console.error("Voice summary sync failed:", error))
        .finally(() => {
          isSyncingSummaryRef.current = false
          useChatStore.getState().setIsSyncingSummary(false)
          if (hasPendingSummarySyncRef.current) {
            run(f)
          }
        })
    }

    run(force)
  }, [])

  React.useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  React.useEffect(() => {
    connectionStateRef.current = connectionState
  }, [connectionState])

  const playAudioChunk = React.useCallback((base64Data: string) => {
    const ctx = outputAudioCtxRef.current
    if (!ctx) return

    setAssistantSpeaking(true)

    const float32Array = base64ToFloat32(base64Data)
    const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000)
    audioBuffer.getChannelData(0).set(float32Array)

    const sourceNode = ctx.createBufferSource()
    sourceNode.buffer = audioBuffer
    sourceNode.connect(ctx.destination)

    const currentTime = ctx.currentTime
    let playTime = nextStartTimeRef.current
    if (playTime < currentTime) playTime = currentTime + 0.05

    sourceNode.start(playTime)
    nextStartTimeRef.current = playTime + audioBuffer.duration

    activeSourcesRef.current.push(sourceNode)
    sourceNode.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((src) => src !== sourceNode)
      if (activeSourcesRef.current.length === 0) setAssistantSpeaking(false)
    }
  }, [])

  const stopAllPlayback = React.useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop()
      } catch {
        // already stopped
      }
    })
    activeSourcesRef.current = []
    nextStartTimeRef.current = 0
    setAssistantSpeaking(false)
  }, [])

  const disconnect = React.useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close()
      wsRef.current = null
    }
    micStreamRef.current?.getTracks().forEach((track) => track.stop())
    micStreamRef.current = null

    activeUserIdRef.current = null
    activeAssistantIdRef.current = null
    maybeSyncSummary(true)

    processorRef.current?.disconnect()
    processorRef.current = null

    inputAudioCtxRef.current?.close().catch(() => {})
    inputAudioCtxRef.current = null

    outputAudioCtxRef.current?.close().catch(() => {})
    outputAudioCtxRef.current = null

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }

    stopAllPlayback()
    setMicActivity(0)
    if (connectionStateRef.current !== "error") setConnectionState("disconnected")
  }, [maybeSyncSummary, stopAllPlayback])

  React.useEffect(() => disconnect, [disconnect])

  const startMicVisualizer = React.useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const draw = () => {
      if (!analyserRef.current) return
      analyser.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
      setMicActivity(sum / dataArray.length / 128)
      animFrameRef.current = requestAnimationFrame(draw)
    }
    animFrameRef.current = requestAnimationFrame(draw)
  }, [])

  const connect = React.useCallback(async () => {
    setConnectionState("connecting")
    setErrorMsg("")
    setTranscripts([])
    transcriptsRef.current = []
    summarizedThroughRef.current = 0
    activeUserIdRef.current = null
    activeAssistantIdRef.current = null

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream

      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      const inputCtx = new AudioCtx({ sampleRate: 16000 })
      inputAudioCtxRef.current = inputCtx

      const outputCtx = new AudioCtx({ sampleRate: 24000 })
      outputAudioCtxRef.current = outputCtx

      const analyser = inputCtx.createAnalyser()
      analyser.fftSize = 32
      analyserRef.current = analyser

      const source = inputCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      const processor = inputCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      source.connect(processor)
      processor.connect(inputCtx.destination)

      startMicVisualizer()

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const wsUrl = `${protocol}//${window.location.host}/api/live?voice=${encodeURIComponent(
        voiceName
      )}&instruction=${encodeURIComponent(systemInstruction)}`

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => setConnectionState("connected")

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === "audio" && msg.audio) {
            activeUserIdRef.current = null
            playAudioChunk(msg.audio)
          } else if (msg.type === "input_transcript" && msg.text) {
            appendTranscriptChunk("user", msg.text, !!msg.finished)
          } else if (msg.type === "output_transcript" && msg.text) {
            activeUserIdRef.current = null
            appendTranscriptChunk("assistant", msg.text, !!msg.finished)
          } else if (msg.type === "turn_complete") {
            activeAssistantIdRef.current = null
            activeUserIdRef.current = null
            maybeSyncSummary()
          } else if (msg.type === "interrupted") {
            stopAllPlayback()
          } else if (msg.type === "error") {
            setErrorMsg(msg.error || "Live session error")
            setConnectionState("error")
            disconnect()
          }
        } catch (err) {
          console.error("Error parsing socket message:", err)
        }
      }

      ws.onerror = () => {
        setErrorMsg("Failed to connect to the live voice service.")
        setConnectionState("error")
        disconnect()
      }

      ws.onclose = () => {
        setConnectionState((prev) => (prev === "error" ? prev : "disconnected"))
        disconnect()
      }

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN || isMutedRef.current) return
        const inputBuffer = e.inputBuffer.getChannelData(0)
        const pcmBuffer = floatTo16BitPCM(inputBuffer)
        ws.send(JSON.stringify({ type: "audio", audio: base64EncodeAudio(pcmBuffer) }))
      }
    } catch (err) {
      console.error("Mic access failed:", err)
      setErrorMsg(
        err instanceof Error ? err.message : "Microphone permission denied or unsupported hardware."
      )
      setConnectionState("error")
      disconnect()
    }
  }, [appendTranscriptChunk, disconnect, maybeSyncSummary, playAudioChunk, startMicVisualizer, stopAllPlayback, systemInstruction, voiceName])

  const barBases = [12, 20, 28, 36, 28, 20, 12]
  const barScales = [25, 40, 60, 80, 60, 40, 25]
  const liveHeights = barBases.map((base, i) => (isMuted || assistantSpeaking ? base : base + micActivity * barScales[i]))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-heading text-sm font-semibold text-foreground">Voice call</h2>
          <p className="text-xs text-muted-foreground">Gemini-3.1-Live WebSocket gateway</p>
        </div>
        {connectionState === "connected" && (
          <Button
            variant={isMuted ? "destructive" : "outline"}
            size="sm"
            onClick={() => setIsMuted((prev) => !prev)}
          >
            {isMuted ? <MicOffIcon /> : <MicIcon />}
            {isMuted ? "Microphone muted" : "Microphone active"}
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        {connectionState === "disconnected" && (
          <div className="flex flex-col items-center gap-5 text-center">
            <span className="flex size-16 items-center justify-center rounded-xl bg-card ring-1 ring-border">
              <MicIcon className="size-6 animate-pulse text-primary" />
            </span>
            <div className="flex flex-col items-center gap-1.5">
              <h3 className="font-heading text-sm font-semibold text-foreground">Start a voice session</h3>
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                Connect for a high-fidelity, low-latency duplex streaming call. Speak naturally to converse,
                instruct, or interrupt.
              </p>
            </div>
            <Button size="lg" className="px-6" onClick={connect} disabled={isSyncingSummary}>
              {isSyncingSummary ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Syncing chat context...
                </>
              ) : (
                <>
                  <PhoneIcon />
                  Initialize voice call
                </>
              )}
            </Button>
          </div>
        )}

        {connectionState === "connecting" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="relative flex size-16 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-xl bg-primary/15" />
              <span className="relative flex size-14 items-center justify-center rounded-xl bg-card ring-1 ring-border">
                <Loader2Icon className="size-5 animate-spin text-primary" />
              </span>
            </span>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Synchronizing audio buffers...</p>
              <p className="font-mono text-[10px] text-muted-foreground">Activating duplex stream protocol</p>
            </div>
          </div>
        )}

        {connectionState === "connected" && (
          <div className="flex w-full flex-col items-center justify-center gap-8">
            <div className="flex h-28 items-end justify-center gap-2">
              {liveHeights.map((height, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 rounded-full transition-all duration-75",
                    i === 3
                      ? "bg-chart-3 shadow-[0_0_15px_color-mix(in_oklch,var(--chart-3)_50%,transparent)]"
                      : "bg-primary/60",
                    assistantSpeaking && "animate-voice-wave"
                  )}
                  style={{
                    height: `${Math.min(112, Math.max(12, height))}px`,
                    animationDelay: assistantSpeaking ? `${i * 90}ms` : undefined,
                  }}
                />
              ))}
            </div>
            <div className="space-y-1 text-center">
              <h4 className="text-xs font-semibold text-foreground">
                {assistantSpeaking ? "Assistant is speaking..." : isMuted ? "Microphone muted" : "Listening for voice..."}
              </h4>
              <p className="font-mono text-[10px] text-muted-foreground">
                ACTIVE VOICE: {voiceName.toUpperCase()} · LATENCY: OPTIMIZED
              </p>
            </div>
            <Button variant="destructive" onClick={disconnect}>
              <SquareIcon className="fill-current" />
              Disconnect call
            </Button>
          </div>
        )}

        {connectionState === "error" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-destructive/20">
              <AlertCircleIcon className="size-5 text-destructive" />
            </span>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-destructive">Connection failed</h4>
              <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                {errorMsg || "An error occurred setting up the voice session."}
              </p>
            </div>
            <Button variant="outline" onClick={connect}>
              Retry connection
            </Button>
          </div>
        )}
      </div>

      {connectionState === "connected" && transcripts.length > 0 && (
        <div className="max-h-28 shrink-0 space-y-2 overflow-y-auto border-t border-border px-4 py-3">
          <p className="font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Dialogue log
          </p>
          {transcripts.map((t) => (
            <div key={t.id} className="flex gap-2 text-[11px]">
              <span className={cn("shrink-0 font-semibold", t.role === "assistant" ? "text-primary" : "text-muted-foreground")}>
                {t.role === "assistant" ? "Assistant:" : "You:"}
              </span>
              <span className="text-foreground">{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { VoicePanel }
