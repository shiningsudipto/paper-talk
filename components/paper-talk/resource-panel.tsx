"use client"

import * as React from "react"
import {
  AlertCircleIcon,
  FileTextIcon,
  SparklesIcon,
  TrashIcon,
  UploadCloudIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { type ResourceDoc, useActiveResources, useChatStore } from "@/components/paper-talk/chat-store"

const ACCEPTED = ".pdf,.docx,.txt,.xlsx,.xls"
const SUPPORTED_EXTENSIONS = new Set(["pdf", "docx", "txt", "xlsx", "xls"])

function getExtension(filename: string) {
  const match = /\.([a-z0-9]+)$/i.exec(filename)
  return match ? match[1].toLowerCase() : ""
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function extractText(file: File) {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch("/api/extract-text", { method: "POST", body: formData })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error ?? "Failed to extract text from this file.")
  }

  return data as { text: string; characterCount: number; truncated: boolean }
}

async function refineText(fileName: string, text: string) {
  const response = await fetch("/api/refine-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, text }),
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error ?? "Failed to refine document.")
  }

  return data.refinedText as string
}

function ResourcePanel() {
  const resources = useActiveResources()
  const addResource = useChatStore((state) => state.addResource)
  const updateResource = useChatStore((state) => state.updateResource)
  const removeResource = useChatStore((state) => state.removeResource)
  const [dragActive, setDragActive] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return

    for (const file of Array.from(fileList)) {
      const id = crypto.randomUUID()
      const extension = getExtension(file.name)
      const unsupported = !SUPPORTED_EXTENSIONS.has(extension)

      addResource({
        id,
        name: file.name,
        size: file.size,
        status: unsupported ? "error" : "extracting",
        error: unsupported ? "Unsupported file type. Use PDF, DOCX, TXT, or XLSX." : undefined,
      })

      if (unsupported) continue

      extractText(file)
        .then(async ({ text, characterCount, truncated }) => {
          updateResource(id, { status: "refining", rawText: text, rawCharacterCount: characterCount })
          try {
            const refinedText = await refineText(file.name, text)
            updateResource(id, { status: "ready", refinedText, refinedWithAI: true })
          } catch (refineError) {
            // Refinement is a nice-to-have (keeps Gemini token usage down) — fall
            // back to the raw extracted text so the resource still works if the
            // refinement model is unavailable (rate limit, quota, etc).
            console.error("Document refinement failed, using raw text:", refineError)
            updateResource(id, {
              status: "ready",
              refinedWithAI: false,
              error: truncated ? "Truncated at 60,000 characters." : undefined,
            })
          }
        })
        .catch((error: Error) => {
          updateResource(id, { status: "error", error: error.message })
        })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-heading text-sm font-semibold text-foreground">Resource workspace</h2>
          <p className="text-xs text-muted-foreground">PDF / DOCX / XLSX / TXT · refined with GLM</p>
        </div>
        {resources.length > 0 && (
          <Badge variant="outline" className="font-mono">
            {resources.length} file{resources.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-4">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(event.target.files)
              event.target.value = ""
            }}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragActive(false)
              addFiles(event.dataTransfer.files)
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 text-center transition-colors",
              resources.length === 0 ? "py-10" : "py-6",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border bg-card/40 hover:border-primary/40 hover:bg-card/70"
            )}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadCloudIcon className="size-5" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">Upload reference resource</span>
              <span className="max-w-[15rem] text-xs text-muted-foreground">
                Drag and drop a PDF, DOCX, XLSX, or TXT document, or click to browse local files.
              </span>
            </span>
            <span className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <Badge variant="outline" className="font-mono text-[10px]">
                PDF
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px]">
                DOCX
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px]">
                XLSX
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px]">
                TXT
              </Badge>
            </span>
          </button>

          {resources.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {resources.map((resource) => (
                <ResourceRow
                  key={resource.id}
                  resource={resource}
                  onRemove={() => removeResource(resource.id)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function ResourceRow({ resource, onRemove }: { resource: ResourceDoc; onRemove: () => void }) {
  const displayText = resource.refinedText ?? resource.rawText

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card/60 px-3 py-2">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          resource.status === "error"
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
        )}
      >
        {resource.status === "error" ? (
          <AlertCircleIcon className="size-4" />
        ) : (
          <FileTextIcon className="size-4" />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-foreground">{resource.name}</span>
        {resource.status === "extracting" && (
          <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <Spinner className="size-2.5" />
            Extracting text...
          </span>
        )}
        {resource.status === "refining" && (
          <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <Spinner className="size-2.5" />
            Refining with GLM...
          </span>
        )}
        {resource.status === "ready" && (
          <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            {resource.refinedWithAI ? (
              <>
                <SparklesIcon className="size-2.5 text-primary" />
                Refined · {resource.refinedText?.length.toLocaleString()} chars
              </>
            ) : (
              <>
                {formatSize(resource.size)} · raw text · {resource.rawCharacterCount?.toLocaleString()} chars
              </>
            )}
          </span>
        )}
        {resource.status === "error" && (
          <span className="text-[11px] text-destructive">{resource.error}</span>
        )}
      </span>

      {resource.status === "ready" && (
        <Dialog>
          <DialogTrigger render={<Button variant="outline" size="xs" className="shrink-0" />}>
            View text
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="truncate">{resource.name}</DialogTitle>
              <DialogDescription>
                {resource.refinedWithAI
                  ? "Refined with GLM — this is what's shared with Gemini."
                  : "Raw extracted text (refinement failed, using this as a fallback)."}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] rounded-lg border border-border bg-muted/40">
              <pre className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                {displayText}
              </pre>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        <TrashIcon className="size-3.5" />
        <span className="sr-only">Remove {resource.name}</span>
      </Button>
    </div>
  )
}

export { ResourcePanel }
