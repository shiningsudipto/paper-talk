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
  const messages = useChatStore((state) => state.sessions.find((s) => s.id === state.activeSessionId)?.messages ?? [])
  const summarizedThroughCount = useChatStore(
    (state) => state.sessions.find((s) => s.id === state.activeSessionId)?.summarizedThroughCount ?? 0
  )
  const syncTextSummary = useChatStore((state) => state.syncTextSummary)

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const newCount = messages.length - summarizedThroughCount
    if (newCount < MIN_NEW_MESSAGES) return

    timeoutRef.current = setTimeout(() => {
      syncTextSummary()
    }, DEBOUNCE_MS)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [messages.length, summarizedThroughCount, syncTextSummary])
}
