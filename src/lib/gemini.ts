import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";

export const models = {
  text: "gemini-3-flash-preview",
  image: "gemini-3.1-flash-image-preview",
  audio: "gemini-2.5-flash-preview-tts",
};

const controlIoTDevice: FunctionDeclaration = {
  name: "controlIoTDevice",
  description: "Control home automation devices like lights, thermostat, or security systems.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      device: { type: Type.STRING, description: "The device to control (e.g., 'living room light', 'thermostat')" },
      action: { type: Type.STRING, enum: ["on", "off", "set_temperature"], description: "The action to perform" },
      value: { type: Type.NUMBER, description: "The value for the action (e.g., temperature in Celsius)" }
    },
    required: ["device", "action"]
  }
};

const getSystemStatus: FunctionDeclaration = {
  name: "getSystemStatus",
  description: "Get real-time status of connected external systems.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      system: { type: Type.STRING, description: "The system name (e.g., 'cloud_storage', 'iot_hub')" }
    },
    required: ["system"]
  }
};

function getAI() {
  // Use process.env.API_KEY which is injected after user selects a key
  // Fallback to GEMINI_API_KEY if available
  const apiKey = (globalThis as any).process?.env?.API_KEY || 
                 (globalThis as any).process?.env?.GEMINI_API_KEY || 
                 "";
  return new GoogleGenAI({ apiKey });
}

export async function chatWithAI(message: string, history: { role: string; parts: { text: string }[] }[], customInstruction?: string) {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: models.text,
      contents: [...history, { role: "user", parts: [{ text: message }] }],
      config: {
        systemInstruction: customInstruction || "You are a highly accurate multi-modal AI assistant. Use Google Search when needed to provide up-to-date and factual information.",
        tools: [
          { googleSearch: {} },
          { functionDeclarations: [controlIoTDevice, getSystemStatus] }
        ],
        toolConfig: { includeServerSideToolInvocations: true }
      },
    });

    return {
      text: response.text,
      groundingMetadata: response.candidates?.[0]?.groundingMetadata,
      functionCalls: response.functionCalls
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errorMessage = error?.message || String(error);
    const isPermissionError = errorMessage.includes("403") || 
                              errorMessage.includes("permission") || 
                              errorMessage.includes("PERMISSION_DENIED");

    // If search grounding fails with 403, retry without it
    if (isPermissionError) {
      try {
        const response = await ai.models.generateContent({
          model: models.text,
          contents: [...history, { role: "user", parts: [{ text: message }] }],
          config: {
            systemInstruction: "You are a highly accurate multi-modal AI assistant.",
          },
        });
        return {
          text: response.text,
        };
      } catch (retryError) {
        console.error("Gemini Retry Error:", retryError);
        throw error; // Throw original error if retry also fails
      }
    }
    throw error;
  }
}

export async function generateImage(prompt: string) {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: models.image,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error: any) {
    console.error("Gemini Image API Error:", error);
    throw error;
  }
}

export async function textToSpeech(text: string, voice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' = 'Kore') {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: models.audio,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    return `data:audio/wav;base64,${base64Audio}`;
  }
  throw new Error("No audio generated");
}

export async function analyzeImage(prompt: string, base64Image: string, mimeType: string) {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: models.text,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Image.split(',')[1], mimeType } }
        ]
      },
      config: {
        systemInstruction: "You are a highly accurate visual AI assistant. Analyze the provided image and respond to the user's prompt.",
      },
    });

    return {
      text: response.text,
    };
  } catch (error: any) {
    console.error("Gemini Vision API Error:", error);
    throw error;
  }
}
