import { CHAT_MODEL, getGenAI } from "@/lib/gemini"

export const runtime = "nodejs"

type ChatRole = "user" | "assistant"
type ChatMessage = { role: ChatRole; content: string }

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
          "You are a helpful, conversational chatbot assistant. Keep your responses engaging and concise.",
      },
    })

    return Response.json({ reply: response.text || "" })
  } catch (error) {
    console.error("Chat API error:", error)
    const message = error instanceof Error ? error.message : "Failed to generate chat response"
    return Response.json({ error: message }, { status: 500 })
  }
}
