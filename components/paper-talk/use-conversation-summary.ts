"use client"

import * as React from "react"

import { useChatStore } from "@/components/paper-talk/chat-store"

const MIN_NEW_MESSAGES = 2 // wait for a full user+assistant exchange
const DEBOUNCE_MS = 3000 // coalesce rapid updates (e.g. streaming voice chunks)

// Mounted once in page.tsx (not duplicated in ChatPanel/VoicePanel) so both
// surfaces update the same rolling summary through one code path — a voice
// call and a text chat write into the same session's messages either way,
// so this only needs to watch that one array regardless of which UI is active.
export function useConversationSummarySync() {
  const activeSessionId = useChatStore((state) => state.activeSessionId)
  const messages = useChatStore((state) => state.sessions.find((s) => s.id === state.activeSessionId)?.messages ?? [])
  const summary = useChatStore((state) => state.sessions.find((s) => s.id === state.activeSessionId)?.summary ?? "")
  const summarizedThroughCount = useChatStore(
    (state) => state.sessions.find((s) => s.id === state.activeSessionId)?.summarizedThroughCount ?? 0
  )
  const setSummary = useChatStore((state) => state.setSummary)

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = React.useRef(false)

  React.useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const newCount = messages.length - summarizedThroughCount
    if (newCount < MIN_NEW_MESSAGES) return

    timeoutRef.current = setTimeout(() => {
      if (inFlightRef.current) return
      inFlightRef.current = true

      const sessionId = activeSessionId
      const throughCount = messages.length
      const newMessages = messages.slice(summarizedThroughCount).map((m) => ({ role: m.role, content: m.content }))

      fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previousSummary: summary, newMessages }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.summary) setSummary(sessionId, data.summary, throughCount)
        })
        .catch((error) => {
          console.error("Conversation summary update failed:", error)
        })
        .finally(() => {
          inFlightRef.current = false
        })
    }, DEBOUNCE_MS)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [messages, activeSessionId, summary, summarizedThroughCount, setSummary])
}
