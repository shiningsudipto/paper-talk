"use client"

import { MessageSquareIcon, PhoneIcon, SettingsIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { HistoryToggle } from "@/components/paper-talk/history-panel"
import { LogoMark } from "@/components/paper-talk/logo-mark"

export type PaperTalkView = "chat" | "voice"

const NAV_ITEMS: { id: PaperTalkView; label: string; icon: typeof MessageSquareIcon }[] = [
  { id: "chat", label: "Chat", icon: MessageSquareIcon },
  { id: "voice", label: "Voice call", icon: PhoneIcon },
]

function NavRail({
  view,
  onViewChange,
}: {
  view: PaperTalkView
  onViewChange: (view: PaperTalkView) => void
}) {
  return (
    <TooltipProvider>
      <aside className="flex h-full w-16 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-3">
        <LogoMark />

        <Separator className="my-3 w-8 bg-sidebar-border" />

        <nav className="flex flex-1 flex-col items-center gap-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = view === item.id
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      aria-label={item.label}
                      aria-pressed={isActive}
                      onClick={() => onViewChange(item.id)}
                      className={cn(
                        "relative text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                        isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                    />
                  }
                >
                  <span
                    className={cn(
                      "absolute inset-y-1.5 -left-3 w-1 rounded-full bg-sidebar-primary transition-opacity",
                      isActive ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <item.icon className="size-4.5" />
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        <div className="flex flex-col items-center gap-1.5 pb-1.5">
          <HistoryToggle onOpenSession={() => onViewChange("chat")} />
        </div>

        <div className="flex flex-col items-center gap-1.5 pt-1.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                />
              }
            >
              <SettingsIcon className="size-4.5" />
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="mt-1 rounded-full outline-none ring-offset-2 ring-offset-sidebar transition-shadow focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                />
              }
            >
              <Avatar size="sm" className="ring-2 ring-sidebar-border">
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                  RA
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="right">Ridwan · Profile</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}

export { NavRail }
