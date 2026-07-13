"use client"

import * as React from "react"
import { FileTextIcon, TrashIcon, UploadCloudIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

type Resource = { id: string; name: string; size: number }

const ACCEPTED = ".pdf,.doc,.docx,.txt"

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ResourcePanel() {
  const [resources, setResources] = React.useState<Resource[]>([])
  const [dragActive, setDragActive] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const next: Resource[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
    }))
    setResources((prev) => [...prev, ...next])
  }

  function removeResource(id: string) {
    setResources((prev) => prev.filter((resource) => resource.id !== id))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-heading text-sm font-semibold text-foreground">Resource workspace</h2>
          <p className="text-xs text-muted-foreground">PDF / DOCX / TXT parsing engine</p>
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
                Drag and drop a PDF, DOCX, or TXT document, or click to browse local files.
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
                TXT
              </Badge>
            </span>
          </button>

          {resources.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {resources.map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-card/60 px-3 py-2"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <FileTextIcon className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-foreground">{resource.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {formatSize(resource.size)}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeResource(resource.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <TrashIcon className="size-3.5" />
                    <span className="sr-only">Remove {resource.name}</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export { ResourcePanel }
