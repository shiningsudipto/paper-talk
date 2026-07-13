"use client"

import { BookOpenIcon, PanelRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function TopBar({
  workspaceOpen,
  onToggleWorkspace,
  configOpen,
  onToggleConfig,
}: {
  workspaceOpen: boolean
  onToggleWorkspace: () => void
  configOpen: boolean
  onToggleConfig: () => void
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/70 px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
          Paper Talk
        </h1>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-success uppercase">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
          System online
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleWorkspace}
          className={cn(
            "hidden sm:inline-flex",
            workspaceOpen && "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
          )}
        >
          <BookOpenIcon />
          {workspaceOpen ? "Close workspace" : "Open workspace"}
        </Button>
      </div>

      <Button
        variant={configOpen ? "secondary" : "ghost"}
        size="icon-sm"
        aria-pressed={configOpen}
        onClick={onToggleConfig}
        className="shrink-0"
      >
        <PanelRightIcon className="size-4" />
        <span className="sr-only">Toggle AI configuration panel</span>
      </Button>
    </header>
  )
}

export { TopBar }
