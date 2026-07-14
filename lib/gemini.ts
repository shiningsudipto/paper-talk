import { GoogleGenAI } from "@google/genai"

let aiClient: GoogleGenAI | null = null

export function getGenAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.")
    }
    aiClient = new GoogleGenAI({ apiKey })
  }
  return aiClient
}

export const CHAT_MODEL = "gemini-3.5-flash"
export const LIVE_MODEL = "gemini-3.1-flash-live-preview"
