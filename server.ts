import { createServer, type IncomingMessage } from "node:http"
import type { Socket } from "node:net"
import next from "next"
import { WebSocketServer, type WebSocket } from "ws"
import { Modality, type Session } from "@google/genai"
import dotenv from "dotenv"

import { getGenAI, LIVE_MODEL } from "./lib/gemini"

dotenv.config()

const port = parseInt(process.env.PORT || "3000", 10)
const dev = process.env.NODE_ENV !== "production"
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const upgradeHandler = app.getUpgradeHandler()
  const server = createServer((req, res) => {
    handle(req, res)
  })

  // --- WebSocket bridge for the Gemini Live API (real-time voice) ---
  const wss = new WebSocketServer({ noServer: true })

  server.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const { pathname } = new URL(request.url || "", `http://${request.headers.host}`)
    if (pathname === "/api/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request)
      })
    } else {
      // Let Next.js handle its own upgrade requests (HMR / dev overlay websocket).
      upgradeHandler(request, socket, head)
    }
  })

  wss.on("connection", async (clientWs: WebSocket, request: IncomingMessage) => {
    console.log("WebSocket client connected to Live API bridge")
    let liveSession: Session | null = null

    try {
      const urlParams = new URL(request.url || "", `http://${request.headers.host}`).searchParams
      const voice = urlParams.get("voice") || "Zephyr"
      const instruction =
        urlParams.get("instruction") ||
        "You are a helpful voice assistant. Keep your responses conversational, warm, and highly engaging."

      const client = getGenAI()
      liveSession = await client.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
          systemInstruction: instruction,
          // Audio-only responses carry no text by default — these ask Gemini
          // to also transcribe both sides of the call, so the browser can
          // mirror the conversation into the same chat history as text chat.
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message) => {
            const parts = message.serverContent?.modelTurn?.parts
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  clientWs.send(JSON.stringify({ type: "audio", audio: part.inlineData.data }))
                }
                if (part.text) {
                  clientWs.send(JSON.stringify({ type: "text", text: part.text }))
                }
              }
            }

            const inputTranscript = message.serverContent?.inputTranscription
            if (inputTranscript?.text) {
              clientWs.send(
                JSON.stringify({
                  type: "input_transcript",
                  text: inputTranscript.text,
                  finished: !!inputTranscript.finished,
                })
              )
            }

            const outputTranscript = message.serverContent?.outputTranscription
            if (outputTranscript?.text) {
              clientWs.send(
                JSON.stringify({
                  type: "output_transcript",
                  text: outputTranscript.text,
                  finished: !!outputTranscript.finished,
                })
              )
            }

            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: "interrupted" }))
            }

            // Transcription.finished is not a reliable per-turn boundary (it
            // never fired once across extensive testing) — turnComplete on
            // the server content itself is the real signal that the model is
            // done responding, so the client knows to start a fresh message
            // for the next turn instead of appending forever.
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turn_complete" }))
            }
          },
          onclose: () => {
            console.log("Gemini Live session closed")
            clientWs.close()
          },
          onerror: (err) => {
            console.error("Gemini Live session error:", err)
            clientWs.send(
              JSON.stringify({ type: "error", error: err.message || "Gemini connection error" })
            )
          },
        },
      })

      clientWs.on("message", (rawData) => {
        try {
          const data = JSON.parse(rawData.toString())
          if (data.type === "audio" && data.audio) {
            liveSession?.sendRealtimeInput({
              audio: { data: data.audio, mimeType: "audio/pcm;rate=16000" },
            })
          } else if (data.type === "text" && data.text) {
            liveSession?.sendRealtimeInput({ text: data.text })
          }
        } catch (err) {
          console.error("Error processing client ws message:", err)
        }
      })

      clientWs.on("close", () => {
        console.log("WebSocket client disconnected")
        liveSession?.close()
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize Live API session"
      console.error("Error setting up Gemini Live connection:", err)
      clientWs.send(JSON.stringify({ type: "error", error: message }))
      clientWs.close()
    }
  })

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (${dev ? "development" : "production"})`)
  })
})
