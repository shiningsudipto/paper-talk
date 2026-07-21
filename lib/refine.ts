import { getRefineGenAI, REFINE_MODEL } from "@/lib/gemini"

const DOCUMENT_SYSTEM_PROMPT = `You are "Paper-Talk" who is a documentation specialist. You turn messy, raw text extracted from an uploaded PDF/DOCX/XLSX/TXT file into clean, well-structured reference documentation that a separate AI voice/chat assistant will use to answer a user's questions about it.

Rules:
- Preserve every fact, number, name, and date from the source — never invent or omit substantive information.
- Remove extraction artifacts: repeated page headers/footers, page numbers, stray line breaks, OCR noise, table-of-contents cruft.
- Organize with lightweight markdown: "#"/"##" headings, "-" bullet lists, and short paragraphs.
- Be concise — cut filler, repetition, and boilerplate — but keep it complete enough to answer detailed questions.
- Output only the refined documentation itself. No commentary about the task, no preamble like "Here is the refined document".`

const SUMMARY_SYSTEM_PROMPT = `You maintain a running summary of an ongoing conversation between a user and an AI voice/chat assistant called "Paper Talk". This summary is fed back to the assistant as context, so it can pick up the conversation seamlessly whether the user continues by text or by voice.

Rules:
- Update the summary to incorporate the new exchange below into the existing summary (provided, if any).
- Preserve important facts: the user's name, stated preferences, decisions made, questions already answered, commitments made.
- Drop small talk and filler that has no bearing on future turns.
- Keep it concise — well under 200 words — even as the conversation grows; compress older, less relevant detail if needed to make room for new information.
- Output only the updated summary text itself. No commentary, no preamble like "Here is the updated summary".`

export class RefineError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "RefineError"
    this.status = status
  }
}

async function callGeminiRefine({
  systemPrompt,
  userContent,
}: {
  systemPrompt: string
  userContent: string
}) {
  try {
    const client = getRefineGenAI()
    const response = await client.models.generateContent({
      model: REFINE_MODEL,
      contents: userContent,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
      },
    })

    const text = response.text?.trim()
    if (!text) {
      throw new RefineError("Gemini returned an empty response.", 502)
    }
    return text
  } catch (err) {
    if (err instanceof RefineError) throw err
    const msg = err instanceof Error ? err.message : "Failed to execute Gemini refine request"
    console.error("Gemini refine call failed:", err)
    throw new RefineError(msg, 500)
  }
}

export async function refineDocumentText({ fileName, text }: { fileName: string; text: string }) {
  return callGeminiRefine({
    systemPrompt: DOCUMENT_SYSTEM_PROMPT,
    userContent: `Source file: ${fileName}\n\n${text}`,
  })
}

export async function summarizeConversation({
  previousSummary,
  newMessages,
}: {
  previousSummary: string
  newMessages: { role: "user" | "assistant"; content: string }[]
}) {
  const exchange = newMessages.map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`).join("\n")
  const userContent = `Existing summary:\n${previousSummary || "(none yet)"}\n\nNew exchange to incorporate:\n${exchange}`

  return callGeminiRefine({
    systemPrompt: SUMMARY_SYSTEM_PROMPT,
    userContent,
  })
}
