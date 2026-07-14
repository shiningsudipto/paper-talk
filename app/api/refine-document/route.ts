import { RefineError, refineDocumentText } from "@/lib/refine"

export const runtime = "nodejs"

const MAX_INPUT_LENGTH = 60_000

export async function POST(request: Request) {
  let body: { fileName?: string; text?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const { fileName, text } = body
  if (!text || typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "text is required" }, { status: 400 })
  }

  const trimmed = text.slice(0, MAX_INPUT_LENGTH)

  try {
    const refinedText = await refineDocumentText({ fileName: fileName || "document", text: trimmed })
    return Response.json({ refinedText })
  } catch (error) {
    if (error instanceof RefineError) {
      console.error("refine-document error:", error.message)
      return Response.json({ error: error.message }, { status: error.status === 401 ? 500 : error.status })
    }
    console.error("Unexpected refine-document error:", error)
    const message = error instanceof Error ? error.message : "Failed to refine document"
    return Response.json({ error: message }, { status: 500 })
  }
}
