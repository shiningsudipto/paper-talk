const DEFAULT_MAX_TOKENS = 2000

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

// Routed entirely through ZenMux's Anthropic-compatible gateway (one API key,
// multiple underlying model providers). Benchmarked GLM vs Grok on the
// document-refinement task (2KB doc, same prompt, 3 runs each): GLM averaged
// ~5.1s, Grok ~6.6s — Grok's replies carry a large hidden reasoning trace
// that adds latency without improving output quality here. GLM is the
// default; ACTIVE_MODEL=grok switches to Grok without touching code.
type ModelChoice = "glm" | "grok"

function resolveModel() {
  const baseUrl = process.env.PROVIDER
  if (!baseUrl) {
    throw new RefineError("PROVIDER environment variable is missing.", 500)
  }

  const apiKey = process.env.GLM_API_KEY
  if (!apiKey) {
    throw new RefineError("GLM_API_KEY environment variable is missing.", 500)
  }

  const choice = (process.env.ACTIVE_MODEL || "glm").trim().toLowerCase() as ModelChoice
  const model = choice === "grok" ? process.env.GROK_MODEL : process.env.GLM_MODEL
  if (!model) {
    throw new RefineError(
      `${choice === "grok" ? "GROK_MODEL" : "GLM_MODEL"} environment variable is missing.`,
      500
    )
  }

  return { apiKey, baseUrl: `${baseUrl.replace(/\/$/, "")}/v1/messages`, model, choice }
}

// Shared low-level call — both document refinement and conversation
// summarization are "give a system prompt + some text, get concise text
// back" tasks, so they share this one client instead of duplicating the
// fetch/parse/error-handling boilerplate.
async function callTextModel({
  systemPrompt,
  userContent,
  maxTokens = DEFAULT_MAX_TOKENS,
}: {
  systemPrompt: string
  userContent: string
  maxTokens?: number
}) {
  const { apiKey, baseUrl, model, choice } = resolveModel()

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    const message = data?.error?.message || `${choice} request failed with status ${response.status}`
    throw new RefineError(message, response.status)
  }

  const textBlock = Array.isArray(data?.content)
    ? data.content.find((block: { type: string }) => block.type === "text")
    : null
  const result = textBlock?.text as string | undefined

  if (!result) {
    throw new RefineError(`${choice} returned an empty response.`, 502)
  }

  return result.trim()
}

export async function refineDocumentText({ fileName, text }: { fileName: string; text: string }) {
  return callTextModel({
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

  return callTextModel({
    systemPrompt: SUMMARY_SYSTEM_PROMPT,
    userContent,
    maxTokens: 400,
  })
}
