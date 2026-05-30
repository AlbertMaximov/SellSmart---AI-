import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";

// Load local environment variables if available
dotenv.config();

const app = express();
const PORT = 3000;

// Increase request payload size limit to support large base64 image uploads
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Initialize the backend Gemini client with high-quality settings
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Configure models from env vars or reasonable defaults
const VISION_MODEL = process.env.VISION_MODEL || "gemini-3.5-flash";
const TEXT_MODEL = process.env.MODEL_NAME || "gemini-3.5-flash";
const TTS_MODEL = "gemini-3.1-flash-tts-preview";

// Helper to sanitize potential markdown JSON wrapper
function sanitizeJsonString(raw: string): string {
  return raw.replace(/```json\s?/gi, "").replace(/```/g, "").trim();
}

// API Route: Analyze item photograph/source URL
app.post("/api/analyze-item", async (req, res) => {
  try {
    const { imageData, isUrl } = req.body;
    if (!imageData) {
      return res.status(400).json({ error: "Missing imageData in request body" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not defined on the server." });
    }

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
      model: VISION_MODEL,
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

    const parsedData = JSON.parse(sanitizeJsonString(response.text || "{}"));
    res.json(parsedData);
  } catch (err: any) {
    console.error("Error in /api/analyze-item:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred during item analysis" });
  }
});

// API Route: Casual/Expert Chat assistant for SellSmart
app.post("/api/chat-with-ai", async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Missing message in request body" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not defined on the server." });
    }

    const systemInstruction = `Ты - помощник SellSmart, эксперт по онлайн-продажам. 
Твоя цель - помочь пользователю выгодно и быстро продать товар. 
Отвечай на русском языке. Будь вежливым и профессиональным.
${context ? `Контекст текущего товара: ${JSON.stringify(context)}` : ""}`;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ parts: [{ text: message }] }],
      config: { systemInstruction }
    });

    res.json({ text: response.text || "Извините, я не получил ответ от ИИ." });
  } catch (err: any) {
    console.error("Error in /api/chat-with-ai:", err);
    res.status(500).json({ error: err.message || "An error occurred during chat reasoning" });
  }
});

// API Route: Text To Speech vocalization
app.post("/api/speak-text", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing text to speak" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not defined on the server." });
    }

    let base64Audio: string | null = null;

    try {
      const response = await ai.models.generateContent({
        model: TTS_MODEL,
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
      base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (ttsErr: any) {
      console.warn("Primary TTS model failed. Retrying with backup format/model...", ttsErr);
      // Fallback to legacy format/model if needed
      try {
        const responseBackup = await ai.models.generateContent({
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
        base64Audio = responseBackup.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      } catch (backupErr: any) {
        console.error("Backup TTS also failed:", backupErr);
      }
    }

    res.json({ audioBase64: base64Audio });
  } catch (err: any) {
    console.error("Error in /api/speak-text:", err);
    res.status(500).json({ error: err.message || "Synthesizing vocal speech failed" });
  }
});

// API Route: Rewrites the seller listing to short/impactful or long/persuasive form
app.post("/api/rewrite-text", async (req, res) => {
  try {
    const { text, style } = req.body;
    if (!text || !style) {
      return res.status(400).json({ error: "Missing text or style parameters" });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not defined on the server." });
    }

    const prompt = style === 'short' 
      ? `Перепиши это объявление, сделав его максимально коротким и лаконичным, сохранив суть: ${text}`
      : `Перепиши это объявление, сделав его более продающим, эмоциональным и привлекательным для покупателя: ${text}`;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });

    res.json({ text: response.text || text });
  } catch (err: any) {
    console.error("Error in /api/rewrite-text:", err);
    res.status(500).json({ error: err.message || "Rewriting listing text failed" });
  }
});

// Setup Vite Dev Middleware / production static folder
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite Development server configured.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Production static files server configured.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SellSmart Service online. Hosting entrypoint on port ${PORT}`);
  });
}

initializeServer();
