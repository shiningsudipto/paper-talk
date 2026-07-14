"use client"

import { HistoryIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useChatStore, type ChatSession } from "@/components/paper-talk/chat-store"

function relativeTime(ms: number) {
  if (!ms) return ""
  const diff = Date.now() - ms
  const minute = 60_000
  const hour = 3_600_000
  const day = 86_400_000
  if (diff < minute) return "Just now"
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < day * 7) return `${Math.floor(diff / day)}d ago`
  return new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" })
}

function HistoryToggle({ onOpenSession }: { onOpenSession: () => void }) {
  const sessions = useChatStore((state) => state.sessions)
  const activeSessionId = useChatStore((state) => state.activeSessionId)
  const newSession = useChatStore((state) => state.newSession)
  const selectSession = useChatStore((state) => state.selectSession)
  const deleteSession = useChatStore((state) => state.deleteSession)

  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Chat history"
                  className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-foreground"
                />
              }
            />
          }
        >
          <HistoryIcon className="size-4.5" />
        </TooltipTrigger>
        <TooltipContent side="right">Chat history</TooltipContent>
      </Tooltip>

      <PopoverContent side="right" align="start" className="w-80 p-0">
        <PopoverHeader className="flex-row items-center justify-between px-3 pt-3">
          <PopoverTitle className="font-heading text-xs">Chat history</PopoverTitle>
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              newSession()
              onOpenSession()
            }}
          >
            <PlusIcon />
            New chat
          </Button>
        </PopoverHeader>

        <ScrollArea className="h-80">
          <div className="flex flex-col gap-1 p-2">
            {sorted.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">No conversations yet.</p>
            ) : (
              sorted.map((session) => (
                <HistoryRow
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onSelect={() => {
                    selectSession(session.id)
                    onOpenSession()
                  }}
                  onDelete={() => deleteSession(session.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function HistoryRow({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: ChatSession
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        "group/history-row flex items-center gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors",
        isActive
          ? "border-primary/40 bg-primary/10"
          : "border-transparent hover:border-border hover:bg-muted/60"
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className={cn("truncate text-sm", isActive ? "font-medium text-primary" : "text-foreground")}>
          {session.title}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {relativeTime(session.updatedAt)} · {session.messages.length} msg
          {session.messages.length === 1 ? "" : "s"}
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onDelete}
        className="shrink-0 text-muted-foreground opacity-0 group-hover/history-row:opacity-100 hover:text-destructive"
      >
        <Trash2Icon className="size-3.5" />
        <span className="sr-only">Delete conversation</span>
      </Button>
    </div>
  )
}

export { HistoryToggle }
