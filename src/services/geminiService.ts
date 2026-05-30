export interface AnalysisResult {
  category: string;
  brand: string;
  model: string;
  condition: string;
  color: string;
  minPrice: number;
  avgPrice: number;
  recommendedPrice: number;
  title: string;
  description: string;
  characteristics: Record<string, string>;
  confidence: number;
}

export const analyzeItem = async (imageData: string, isUrl: boolean = false): Promise<AnalysisResult> => {
  const response = await fetch("/api/analyze-item", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageData, isUrl }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to analyze item (HTTP ${response.status})`);
  }

  return response.json();
};

export const chatWithAI = async (message: string, context?: AnalysisResult): Promise<string> => {
  const response = await fetch("/api/chat-with-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, context }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to message chatbot (HTTP ${response.status})`);
  }

  const data = await response.json();
  return data.text;
};

export const speakText = async (text: string): Promise<string | null> => {
  try {
    const response = await fetch("/api/speak-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.warn("Speech synthesis API returned non-200 response:", response.status);
      return null;
    }

    const data = await response.json();
    return data.audioBase64 || null;
  } catch (e) {
    console.error("Vocal TTS proxy fetch error:", e);
    return null;
  }
};

export const rewriteText = async (text: string, style: 'short' | 'selling'): Promise<string> => {
  try {
    const response = await fetch("/api/rewrite-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, style }),
    });

    if (!response.ok) {
      console.warn("Rewrite proxy API returned non-200 response:", response.status);
      return text;
    }

    const data = await response.json();
    return data.text || text;
  } catch (e) {
    console.error("Vocal text rewrite proxy fetch error:", e);
    return text;
  }
};
