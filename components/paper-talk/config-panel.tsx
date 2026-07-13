"use client"

import { CheckIcon, SparklesIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

export type Voice = { id: string; name: string; tone: string }
export type BehaviorPreset = { id: string; name: string; description: string }

const VOICES: Voice[] = [
  { id: "aria", name: "Aria", tone: "Warm & natural" },
  { id: "nova", name: "Nova", tone: "Female · Clear" },
  { id: "flux", name: "Flux", tone: "Male · Energetic" },
  { id: "atlas", name: "Atlas", tone: "Male · Deep" },
  { id: "wren", name: "Wren", tone: "Male · Soft" },
]

const PRESETS: BehaviorPreset[] = [
  {
    id: "general",
    name: "General assistant",
    description: "Friendly, helpful, and highly conversational. Keeps responses grounded.",
  },
  {
    id: "thinker",
    name: "Deep thinker",
    description: "Thoughtful and deliberate. Answers with intellectual nuance and care.",
  },
  {
    id: "hype",
    name: "Energetic hype-agent",
    description: "High-energy, motivational, and supportive. Keeps the momentum high.",
  },
  {
    id: "concise",
    name: "Concise coordinator",
    description: "Ultra-pragmatic. Brief, direct, and immediately actionable.",
  },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 font-mono text-[10px] font-medium tracking-widest text-muted-foreground/70 uppercase">
      {children}
    </p>
  )
}

function ConfigPanel({
  open,
  selectedVoice,
  onSelectVoice,
  selectedPreset,
  onSelectPreset,
}: {
  open: boolean
  selectedVoice: string
  onSelectVoice: (id: string) => void
  selectedPreset: string
  onSelectPreset: (id: string) => void
}) {
  return (
    <aside
      aria-hidden={!open}
      className={cn(
        "flex min-h-0 shrink-0 flex-col overflow-hidden border-l border-border bg-sidebar transition-[width] duration-200 ease-linear",
        open ? "w-80" : "w-0"
      )}
    >
      <div className="flex h-full w-80 min-h-0 flex-col">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <SparklesIcon className="size-3.5 text-primary" />
          <h2 className="font-heading text-xs font-semibold tracking-wide text-foreground">
            AI core configuration
          </h2>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 px-4 pb-4">
            <div className="flex flex-col gap-2">
              <SectionLabel>Active voice</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {VOICES.map((voice) => {
                  const isActive = voice.id === selectedVoice
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => onSelectVoice(voice.id)}
                      aria-pressed={isActive}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-primary/40 bg-primary/10"
                          : "border-transparent bg-card/60 hover:border-border hover:bg-card"
                      )}
                    >
                      <span className="flex flex-col gap-0.5">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            isActive ? "text-primary" : "text-foreground"
                          )}
                        >
                          {voice.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{voice.tone}</span>
                      </span>
                      {isActive && (
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <CheckIcon className="size-2.5" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <SectionLabel>Behavior preset</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {PRESETS.map((preset) => {
                  const isActive = preset.id === selectedPreset
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelectPreset(preset.id)}
                      aria-pressed={isActive}
                      className={cn(
                        "flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-primary/40 bg-primary/10"
                          : "border-transparent bg-card/60 hover:border-border hover:bg-card"
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isActive ? "text-primary" : "text-foreground"
                        )}
                      >
                        {preset.name}
                      </span>
                      <span className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {preset.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="border-t border-border p-4">
          <div className="rounded-lg border border-border bg-card/60 px-3 py-2.5">
            <SectionLabel>System metadata</SectionLabel>
            <p className="mt-1.5 font-mono text-[11px] text-foreground">Paper Talk Core</p>
            <p className="font-mono text-[11px] text-muted-foreground">Conversational engine · v2.1</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export { ConfigPanel }
