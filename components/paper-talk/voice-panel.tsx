import { PhoneIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

function VoicePanel() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="font-heading text-sm font-semibold text-foreground">Voice call</h2>
        <p className="text-xs text-muted-foreground">Low-latency duplex audio link</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
        <div className="relative flex size-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary/15 animate-ping [animation-duration:2.4s]" />
          <span className="absolute inset-2 rounded-full bg-primary/10" />
          <span className="relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_color-mix(in_oklch,var(--primary)_70%,transparent)]">
            <PhoneIcon className="size-5" />
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="font-heading text-base font-medium text-foreground">Start a voice session</h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            Connect for a high-fidelity streaming call. Speak naturally to converse, instruct, or interrupt.
          </p>
        </div>

        <Button size="lg" className="px-6">
          <PhoneIcon />
          Start voice call
        </Button>

        <p className="font-mono text-[10px] tracking-widest text-muted-foreground/60 uppercase">
          Not connected
        </p>
      </div>
    </div>
  )
}

export { VoicePanel }
