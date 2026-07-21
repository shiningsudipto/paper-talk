import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
let refineAiClient: GoogleGenAI | null = null;

export function getGenAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export function getRefineGenAI() {
  if (!refineAiClient) {
    const apiKey = process.env.GEMINI_API_KEY_TWO || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY_TWO (or GEMINI_API_KEY) environment variable is missing.");
    }
    refineAiClient = new GoogleGenAI({ apiKey });
  }
  return refineAiClient;
}

// gemini-3.5-flash is consistently returning 503 "high demand"
// gemini-3.1-flash-lite is fast (~0.6-0.9s)
export const CHAT_MODEL = "gemini-3.1-flash-lite";
export const LIVE_MODEL = "gemini-3.1-flash-live-preview";
export const REFINE_MODEL = "gemini-3.1-flash-lite";
