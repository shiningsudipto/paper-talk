"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  time: string
}

export type ResourceStatus = "extracting" | "refining" | "ready" | "error"

export type ResourceDoc = {
  id: string
  name: string
  size: number
  status: ResourceStatus
  rawText?: string
  rawCharacterCount?: number
  refinedText?: string
  refinedWithAI?: boolean
  error?: string
}

export type ChatSession = {
  id: string
  title: string
  messages: ChatMessage[]
  resources: ResourceDoc[]
  // Rolling summary of the whole conversation, kept in sync regardless of
  // whether turns happen over text or voice — see summarizedThroughCount for
  // how many messages have been folded into it so far.
  summary: string
  summarizedThroughCount: number
  updatedAt: number
}

const STORAGE_KEY = "paper-talk.chat-history.v3"
const GREETING =
  "Hi, I'm your Paper Talk assistant, running on Gemini. Ask me anything, or start a voice call from the left rail."
const PLACEHOLDER_SESSION_ID = "placeholder"
const MAX_TOTAL_CONTEXT_CHARS = 20_000

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
    resources: [],
    summary: "",
    summarizedThroughCount: 0,
    updatedAt: 0,
  }
}

function createSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [{ id: crypto.randomUUID(), role: "assistant", content: GREETING, time: timestamp() }],
    resources: [],
    summary: "",
    summarizedThroughCount: 0,
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
  addResource: (doc: ResourceDoc) => void
  updateResource: (id: string, patch: Partial<ResourceDoc>) => void
  removeResource: (id: string) => void
  setSummary: (sessionId: string, summary: string, throughCount: number) => void
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

      // Resources are scoped per session — a new chat starts with none, and
      // switching sessions swaps which documents are "active" for grounding.
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

      addResource: (doc) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === state.activeSessionId ? { ...session, resources: [...session.resources, doc] } : session
          ),
        })),

      updateResource: (id, patch) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === state.activeSessionId
              ? {
                  ...session,
                  resources: session.resources.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)),
                }
              : session
          ),
        })),

      removeResource: (id) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === state.activeSessionId
              ? { ...session, resources: session.resources.filter((doc) => doc.id !== id) }
              : session
          ),
        })),

      // Takes an explicit sessionId (not "the active session") because this
      // resolves asynchronously — the user may have switched sessions by the
      // time a summarize call completes, and it must land on the session it
      // was actually generated for, not whatever is active now.
      setSummary: (sessionId, summary, throughCount) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId ? { ...session, summary, summarizedThroughCount: throughCount } : session
          ),
        })),

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
      // Uploaded files themselves can't be persisted (and don't need to be) —
      // only the already-extracted/refined text, so a reload doesn't force a
      // paid re-refinement. Anything still mid-flight when the tab closed
      // can't be resumed, so drop it rather than persist a stuck spinner.
      partialize: (state) => ({
        sessions: state.sessions.map((session) => ({
          ...session,
          resources: session.resources.filter((doc) => doc.status === "ready" || doc.status === "error"),
        })),
        activeSessionId: state.activeSessionId,
      }),
    }
  )
)

function activeSession(state: ChatStore) {
  return state.sessions.find((session) => session.id === state.activeSessionId)
}

export function useActiveMessages() {
  return useChatStore((state) => activeSession(state)?.messages ?? [])
}

export function useActiveResources() {
  return useChatStore((state) => activeSession(state)?.resources ?? [])
}

export function useActiveSummary() {
  return useChatStore((state) => activeSession(state)?.summary ?? "")
}

export function useResourceContext() {
  return useChatStore((state) => {
    const ready = (activeSession(state)?.resources ?? []).filter(
      (doc) => doc.status === "ready" && (doc.refinedText || doc.rawText)
    )
    if (ready.length === 0) return ""

    const combined = ready
      .map((doc) => `# Source: ${doc.name}\n\n${doc.refinedText ?? doc.rawText}`)
      .join("\n\n---\n\n")

    return combined.length > MAX_TOTAL_CONTEXT_CHARS ? combined.slice(0, MAX_TOTAL_CONTEXT_CHARS) : combined
  })
}
