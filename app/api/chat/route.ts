import { ApiError } from "@google/genai"

import { CHAT_MODEL, getGenAI } from "@/lib/gemini"

export const runtime = "nodejs"

type ChatRole = "user" | "assistant"
type ChatMessage = { role: ChatRole; content: string }

// @google/genai's ApiError.message is often a raw JSON blob like
// {"error":{"code":400,"message":"API key not valid...","status":"..."}} —
// pull out the human-readable part instead of showing that to the user.
function extractNestedMessage(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw)
    const message = parsed?.error?.message
    return typeof message === "string" ? message : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  let body: { messages?: ChatMessage[]; systemInstruction?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const { messages, systemInstruction } = body
  if (!messages || !Array.isArray(messages)) {
    return Response.json({ error: "messages array is required" }, { status: 400 })
  }

  try {
    const client = getGenAI()
    const contents = messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }))

    const response = await client.models.generateContent({
      model: CHAT_MODEL,
      contents,
      config: {
        systemInstruction:
          systemInstruction ||
          'You are Paper Talk, a helpful, conversational chatbot assistant. If asked who you are, always say "Paper Talk". Keep your responses engaging and concise.',
      },
    })

    return Response.json({ reply: response.text || "" })
  } catch (error) {
    console.error("Chat API error:", error)

    if (error instanceof ApiError) {
      // Gemini's own nested error message, e.g. "API key not valid. Please
      // pass a valid API key." — more useful than our own generic text when
      // we can extract it.
      const nested = extractNestedMessage(error.message)

      // Confusingly, Gemini returns 400 (not 401/403) for an invalid key.
      if (nested?.toLowerCase().includes("api key") || error.status === 401 || error.status === 403) {
        return Response.json(
          { error: `Gemini rejected the request: ${nested ?? "check that GEMINI_API_KEY is set correctly."}` },
          { status: 500 }
        )
      }
      if (error.status === 429) {
        return Response.json(
          { error: "Gemini's rate limit was hit. Please wait a moment and try again." },
          { status: 429 }
        )
      }
      if (error.status >= 500) {
        return Response.json(
          { error: "Gemini is temporarily overloaded on Google's end. Please try again in a moment." },
          { status: 503 }
        )
      }

      return Response.json({ error: nested ?? error.message }, { status: 500 })
    }

    const message = error instanceof Error ? error.message : "Failed to generate chat response"
    return Response.json({ error: message }, { status: 500 })
  }
}
