"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

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

const STORAGE_KEY = "paper-talk.resources.v1"
const MAX_TOTAL_CONTEXT_CHARS = 20_000

type ResourceStore = {
  resources: ResourceDoc[]
  hasHydrated: boolean
  addResource: (doc: ResourceDoc) => void
  updateResource: (id: string, patch: Partial<ResourceDoc>) => void
  removeResource: (id: string) => void
  setHasHydrated: (value: boolean) => void
}

export const useResourceStore = create<ResourceStore>()(
  persist(
    (set) => ({
      resources: [],
      hasHydrated: false,

      addResource: (doc) => set((state) => ({ resources: [...state.resources, doc] })),

      updateResource: (id, patch) =>
        set((state) => ({
          resources: state.resources.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)),
        })),

      removeResource: (id) =>
        set((state) => ({ resources: state.resources.filter((doc) => doc.id !== id) })),

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
        resources: state.resources.filter((doc) => doc.status === "ready" || doc.status === "error"),
      }),
    }
  )
)

export function useResourceContext() {
  return useResourceStore((state) => {
    const ready = state.resources.filter(
      (doc) => doc.status === "ready" && (doc.refinedText || doc.rawText)
    )
    if (ready.length === 0) return ""

    const combined = ready
      .map((doc) => `# Source: ${doc.name}\n\n${doc.refinedText ?? doc.rawText}`)
      .join("\n\n---\n\n")

    return combined.length > MAX_TOTAL_CONTEXT_CHARS ? combined.slice(0, MAX_TOTAL_CONTEXT_CHARS) : combined
  })
}
