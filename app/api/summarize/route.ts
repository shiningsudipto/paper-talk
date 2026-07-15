import { RefineError, summarizeConversation } from "@/lib/refine"

export const runtime = "nodejs"

type IncomingMessage = { role?: string; content?: string }

export async function POST(request: Request) {
  let body: { previousSummary?: string; newMessages?: IncomingMessage[] }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const { previousSummary, newMessages } = body
  if (!Array.isArray(newMessages) || newMessages.length === 0) {
    return Response.json({ error: "newMessages array is required" }, { status: 400 })
  }

  const cleaned = newMessages
    .filter((m): m is { role: "user" | "assistant"; content: string } => typeof m.content === "string" && !!m.content)
    .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content }))

  if (cleaned.length === 0) {
    return Response.json({ error: "newMessages had no usable content" }, { status: 400 })
  }

  try {
    const summary = await summarizeConversation({ previousSummary: previousSummary || "", newMessages: cleaned })
    return Response.json({ summary })
  } catch (error) {
    if (error instanceof RefineError) {
      console.error("summarize error:", error.message)
      return Response.json({ error: error.message }, { status: error.status })
    }
    console.error("Unexpected summarize error:", error)
    const message = error instanceof Error ? error.message : "Failed to summarize conversation"
    return Response.json({ error: message }, { status: 500 })
  }
}
