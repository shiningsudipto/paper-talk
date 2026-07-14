"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  time: string
}

export type ChatSession = {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
}

const STORAGE_KEY = "paper-talk.chat-history.v2"
const GREETING =
  "Hi, I'm your Paper Talk assistant, running on Gemini. Ask me anything, or start a voice call from the left rail."
const PLACEHOLDER_SESSION_ID = "placeholder"

export function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// SSR-safe placeholder: identical on the server and the client's first paint
// (no random id / real timestamp), so hydration never mismatches. The real
// session — with a real id and timestamp — is only created client-side, after
// mount, once we know whether localStorage actually had anything saved.
function placeholderSession(): ChatSession {
  return {
    id: PLACEHOLDER_SESSION_ID,
    title: "New chat",
    messages: [{ id: "seed-1", role: "assistant", content: GREETING, time: "" }],
    updatedAt: 0,
  }
}

function createSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [{ id: crypto.randomUUID(), role: "assistant", content: GREETING, time: timestamp() }],
    updatedAt: Date.now(),
  }
}

function deriveTitle(messages: ChatMessage[]) {
  const firstUser = messages.find((message) => message.role === "user")
  if (!firstUser) return "New chat"
  return firstUser.content.length > 42 ? `${firstUser.content.slice(0, 42)}…` : firstUser.content
}

type ChatStore = {
  sessions: ChatSession[]
  activeSessionId: string
  hasHydrated: boolean
  setMessages: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
  clearActiveSession: () => void
  newSession: () => void
  selectSession: (id: string) => void
  deleteSession: (id: string) => void
  ensureInitialized: () => void
  setHasHydrated: (value: boolean) => void
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [placeholderSession()],
      activeSessionId: PLACEHOLDER_SESSION_ID,
      hasHydrated: false,

      setMessages: (updater) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== state.activeSessionId) return session
            const messages = typeof updater === "function" ? updater(session.messages) : updater
            return { ...session, messages, title: deriveTitle(messages), updatedAt: Date.now() }
          }),
        })),

      clearActiveSession: () =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === state.activeSessionId
              ? {
                  ...session,
                  messages: [{ id: crypto.randomUUID(), role: "assistant", content: GREETING, time: timestamp() }],
                  title: "New chat",
                  updatedAt: Date.now(),
                }
              : session
          ),
        })),

      newSession: () =>
        set((state) => {
          const session = createSession()
          return { sessions: [session, ...state.sessions], activeSessionId: session.id }
        }),

      selectSession: (id) => set({ activeSessionId: id }),

      deleteSession: (id) =>
        set((state) => {
          const remaining = state.sessions.filter((session) => session.id !== id)
          if (remaining.length === 0) {
            const session = createSession()
            return { sessions: [session], activeSessionId: session.id }
          }
          return {
            sessions: remaining,
            activeSessionId: state.activeSessionId === id ? remaining[0].id : state.activeSessionId,
          }
        }),

      // Called once on the client after persist has attempted rehydration. If
      // nothing was in localStorage, the placeholder is still the only
      // session — swap it for a real one now that we're safely past hydration.
      ensureInitialized: () => {
        const { sessions } = get()
        if (sessions.length === 1 && sessions[0].id === PLACEHOLDER_SESSION_ID) {
          const session = createSession()
          set({ sessions: [session], activeSessionId: session.id })
        }
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

export function useActiveMessages() {
  return useChatStore((state) => state.sessions.find((s) => s.id === state.activeSessionId)?.messages ?? [])
}
