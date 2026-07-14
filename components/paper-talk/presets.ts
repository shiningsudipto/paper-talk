export type Voice = { id: string; name: string; tone: string }
export type BehaviorPreset = { id: string; name: string; instruction: string }

// Voice IDs are the prebuilt Gemini Live/TTS voice names — they must match
// exactly what the API accepts, not just display labels.
export const VOICES: Voice[] = [
  { id: "Zephyr", name: "Zephyr", tone: "Warm & natural" },
  { id: "Kore", name: "Kore", tone: "Female · Clear" },
  { id: "Puck", name: "Puck", tone: "Male · Energetic" },
  { id: "Charon", name: "Charon", tone: "Male · Deep" },
  { id: "Fenrir", name: "Fenrir", tone: "Male · Soft" },
]

export const BEHAVIOR_PRESETS: BehaviorPreset[] = [
  {
    id: "general",
    name: "General assistant",
    instruction:
      "You are a friendly, helpful, and highly conversational assistant. Keep your responses natural, engaging, and clear.",
  },
  {
    id: "thinker",
    name: "Deep thinker",
    instruction:
      "You are a thoughtful, deep-thinking philosophical companion. Answer questions with intellectual depth, nuance, and curiosity.",
  },
  {
    id: "hype",
    name: "Energetic hype-agent",
    instruction:
      "You are an incredibly energetic, motivational, and supportive companion. Keep the energy high and encourage the user!",
  },
  {
    id: "concise",
    name: "Concise coordinator",
    instruction:
      "You are an ultra-concise, pragmatic voice assistant. Provide brief, direct, and actionable responses without fluff.",
  },
]

export const DEFAULT_VOICE = VOICES[0].id
export const DEFAULT_INSTRUCTION = BEHAVIOR_PRESETS[0].instruction
