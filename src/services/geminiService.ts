import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
  const model = "gemini-3-flash-preview";
  
  const prompt = `Проанализируй это изображение товара для продажи. 
  Определи категорию (электроника, одежда, мебель, бытовая техника, аксессуары, другое), бренд, модель, цвет и состояние (новый, почти новый, хорошее состояние, есть следы использования, требуется ремонт).
  Оцени рыночные цены в рублях (минимум, средняя, рекомендованная).
  Сгенерируй привлекательный заголовок и подробное описание для объявления.
  Верни результат строго в формате JSON.`;

  const part = isUrl 
    ? { text: `${prompt} Ссылка на изображение: ${imageData}` }
    : {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageData.split(",")[1] || imageData,
        },
      };

  const response = await ai.models.generateContent({
    model,
    contents: isUrl ? [{ parts: [part] }] : { parts: [part, { text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          brand: { type: Type.STRING },
          model: { type: Type.STRING },
          condition: { type: Type.STRING },
          color: { type: Type.STRING },
          minPrice: { type: Type.NUMBER },
          avgPrice: { type: Type.NUMBER },
          recommendedPrice: { type: Type.NUMBER },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          characteristics: { 
            type: Type.OBJECT,
            properties: {
              "Бренд": { type: Type.STRING },
              "Модель": { type: Type.STRING },
              "Цвет": { type: Type.STRING },
              "Состояние": { type: Type.STRING }
            }
          },
          confidence: { type: Type.NUMBER, description: "Уверенность в определении товара от 0 до 1" }
        },
        required: ["category", "brand", "model", "condition", "minPrice", "avgPrice", "recommendedPrice", "title", "description", "characteristics", "confidence"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const chatWithAI = async (message: string, context?: AnalysisResult) => {
  const model = "gemini-3-flash-preview";
  const systemInstruction = `Ты - помощник SellSmart, эксперт по онлайн-продажам. 
  Твоя цель - помочь пользователю выгодно и быстро продать товар. 
  Отвечай на русском языке. Будь вежливым и профессиональным.
  ${context ? `Контекст текущего товара: ${JSON.stringify(context)}` : ""}`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: message }] }],
    config: { systemInstruction }
  });

  return response.text;
};

export const speakText = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Скажи это дружелюбно: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e) {
    console.error("TTS error", e);
    return null;
  }
};

export const rewriteText = async (text: string, style: 'short' | 'selling'): Promise<string> => {
  const model = "gemini-3-flash-preview";
  const prompt = style === 'short' 
    ? `Перепиши это объявление, сделав его максимально коротким и лаконичным, сохранив суть: ${text}`
    : `Перепиши это объявление, сделав его более продающим, эмоциональным и привлекательным для покупателя: ${text}`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
  });

  return response.text || text;
};
