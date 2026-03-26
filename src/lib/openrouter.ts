export async function chatWithOpenRouter(message: string, history: { role: string; content: string }[], systemInstruction?: string) {
  const apiKey = (globalThis as any).process?.env?.OPENROUTER_API_KEY || "";
  
  if (!apiKey) {
    throw new Error("OpenRouter API Key is not configured.");
  }

  const messages = [
    { role: "system", content: systemInstruction || "You are a highly intelligent AI assistant powered by OpenRouter." },
    ...history,
    { role: "user", content: message }
  ];

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "AI Studio Hybrid System"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo", // Default model, can be changed
        messages: messages,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Failed to fetch from OpenRouter");
    }

    const data = await response.json();
    return {
      text: data.choices[0].message.content,
    };
  } catch (error: any) {
    console.error("OpenRouter API Error:", error);
    throw error;
  }
}
