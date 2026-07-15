const REFINE_MAX_TOKENS = 2000;

const SYSTEM_PROMPT = `You are "Paper-Talk" who is a documentation specialist. You turn messy, raw text extracted from an uploaded PDF/DOCX/XLSX/TXT file into clean, well-structured reference documentation that a separate AI voice/chat assistant will use to answer a user's questions about it.

Rules:
- Preserve every fact, number, name, and date from the source — never invent or omit substantive information.
- Remove extraction artifacts: repeated page headers/footers, page numbers, stray line breaks, OCR noise, table-of-contents cruft.
- Organize with lightweight markdown: "#"/"##" headings, "-" bullet lists, and short paragraphs.
- Be concise — cut filler, repetition, and boilerplate — but keep it complete enough to answer detailed questions.
- Output only the refined documentation itself. No commentary about the task, no preamble like "Here is the refined document".`;

export class RefineError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RefineError";
    this.status = status;
  }
}

// Routed entirely through ZenMux's Anthropic-compatible gateway (one API key,
// multiple underlying model providers). Benchmarked GLM vs Grok on this exact
// refinement task (2KB doc, same prompt, 3 runs each): GLM averaged ~5.1s,
// Grok ~6.6s — Grok's replies carry a large hidden reasoning trace that adds
// latency without improving output quality here. GLM is the default;
// ACTIVE_MODEL=grok switches to Grok without touching code.
type ModelChoice = "glm" | "grok";

function resolveModel() {
  const baseUrl = process.env.PROVIDER;
  if (!baseUrl) {
    throw new RefineError("PROVIDER environment variable is missing.", 500);
  }

  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new RefineError("GLM_API_KEY environment variable is missing.", 500);
  }

  const choice = (process.env.ACTIVE_MODEL || "glm")
    .trim()
    .toLowerCase() as ModelChoice;
  const model =
    choice === "grok" ? process.env.GROK_MODEL : process.env.GLM_MODEL;
  if (!model) {
    throw new RefineError(
      `${choice === "grok" ? "GROK_MODEL" : "GLM_MODEL"} environment variable is missing.`,
      500,
    );
  }

  return {
    apiKey,
    baseUrl: `${baseUrl.replace(/\/$/, "")}/v1/messages`,
    model,
    choice,
  };
}

export async function refineDocumentText({
  fileName,
  text,
}: {
  fileName: string;
  text: string;
}) {
  const { apiKey, baseUrl, model, choice } = resolveModel();

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: REFINE_MAX_TOKENS,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Source file: ${fileName}\n\n${text}` },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `${choice} request failed with status ${response.status}`;
    throw new RefineError(message, response.status);
  }

  const textBlock = Array.isArray(data?.content)
    ? data.content.find((block: { type: string }) => block.type === "text")
    : null;
  const refined = textBlock?.text as string | undefined;

  if (!refined) {
    throw new RefineError(`${choice} returned an empty response.`, 502);
  }

  return refined.trim();
}
