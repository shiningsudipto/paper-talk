"use client"

import * as React from "react"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ChatPanel } from "@/components/paper-talk/chat-panel"
import { useChatStore } from "@/components/paper-talk/chat-store"
import { ConfigPanel } from "@/components/paper-talk/config-panel"
import { NavRail, type PaperTalkView } from "@/components/paper-talk/nav-rail"
import { DEFAULT_INSTRUCTION, DEFAULT_VOICE } from "@/components/paper-talk/presets"
import { ResourcePanel } from "@/components/paper-talk/resource-panel"
import { TopBar } from "@/components/paper-talk/top-bar"
import { VoicePanel } from "@/components/paper-talk/voice-panel"

export default function Home() {
  const [view, setView] = React.useState<PaperTalkView>("chat")
  const [workspaceOpen, setWorkspaceOpen] = React.useState(true)
  const [configOpen, setConfigOpen] = React.useState(true)
  const [voiceName, setVoiceName] = React.useState(DEFAULT_VOICE)
  const [systemInstruction, setSystemInstruction] = React.useState(DEFAULT_INSTRUCTION)

  React.useEffect(() => {
    Promise.resolve(useChatStore.persist.rehydrate()).then(() => {
      useChatStore.getState().ensureInitialized()
    })
  }, [])

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      <NavRail view={view} onViewChange={setView} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          workspaceOpen={workspaceOpen}
          onToggleWorkspace={() => setWorkspaceOpen((open) => !open)}
          configOpen={configOpen}
          onToggleConfig={() => setConfigOpen((open) => !open)}
        />

        <div className="flex min-h-0 flex-1">
          <ResizablePanelGroup orientation="horizontal" className="min-w-0 flex-1">
            <ResizablePanel defaultSize={58} minSize={32} className="min-w-0">
              {view === "chat" ? (
                <ChatPanel systemInstruction={systemInstruction} />
              ) : (
                <VoicePanel voiceName={voiceName} systemInstruction={systemInstruction} />
              )}
            </ResizablePanel>

            {workspaceOpen && (
              <>
                <ResizableHandle />
                <ResizablePanel defaultSize={42} minSize={24} className="min-w-0 bg-background/40">
                  <ResourcePanel />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>

          <ConfigPanel
            open={configOpen}
            selectedVoice={voiceName}
            onSelectVoice={setVoiceName}
            selectedInstruction={systemInstruction}
            onSelectInstruction={setSystemInstruction}
          />
        </div>
      </div>
    </div>
  )
}
