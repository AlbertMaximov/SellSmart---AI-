import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import dotenv from "dotenv";

// Load local environment variables if available
dotenv.config();

const app = express();
const PORT = 3000;

// Increase request payload size limit to support large base64 image uploads
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Initialize the backend DeepSeek client
const apiKey = process.env.DEEPSEEK_API_KEY || "";
const client = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://api.deepseek.com",
});

// API Route: Analyze item photograph/source URL
app.post("/api/analyze-item", async (req, res) => {
  try {
    const { imageData, isUrl } = req.body;
    
    if (!apiKey) {
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not defined on the server." });
    }

    // NOTE: DeepSeek API (like standard LLMs) generally does not support direct image processing.
    // We will provide a textual description that an image was provided.
    const prompt = `Проанализируй этот товар для продажи. 
${isUrl ? `Ссылка на изображение: ${imageData}` : "Изображение было предоставлено пользователем, но DeepSeek API не поддерживает прямой анализ изображений. Оцени товар на основе типичного описания предмета или предположи тип предмета, если возможно."}

Определи категорию (электроника, одежда, мебель, бытовая техника, аксессуары, другое), бренд, модель, цвет и состояние (новый, почти новый, хорошее состояние, есть следы использования, требуется ремонт).
Оцени рыночные цены в рублях (минимум, средняя, рекомендованная).
Сгенерируй привлекательный заголовок и подробное описание для объявления.

Верни результат строго в формате JSON, без дополнительного текста.
Пример формата:
{
  "category": "...", "brand": "...", "model": "...", "condition": "...", "color": "...", 
  "minPrice": 0, "avgPrice": 0, "recommendedPrice": 0, 
  "title": "...", "description": "...", 
  "characteristics": {"Бренд": "...", "Модель": "...", "Цвет": "...", "Состояние": "..."}, 
  "confidence": 0.5
}`;

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "Ты — эксперт по оценке товаров. Отвечай только в формате JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    const parsedData = JSON.parse(completion.choices[0].message.content || "{}");
    res.json(parsedData);
  } catch (err: any) {
    console.error("Error in /api/analyze-item:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred" });
  }
});

// API Route: Casual/Expert Chat assistant
app.post("/api/chat-with-ai", async (req, res) => {
  try {
    const { message, context } = req.body;
    
    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: `Ты - помощник SellSmart, эксперт по онлайн-продажам. ${context ? `Контекст товара: ${JSON.stringify(context)}` : ""}` },
        { role: "user", content: message }
      ]
    });

    res.json({ text: response.choices[0].message.content || "Извините, я не получил ответ." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "An error occurred" });
  }
});

// TTS is not supported by DeepSeek/OpenAI standard API.
app.post("/api/speak-text", async (req, res) => {
  res.status(501).json({ error: "TTS is not supported by the current AI provider." });
});

// API Route: Rewrites the seller listing
app.post("/api/rewrite-text", async (req, res) => {
  try {
    const { text, style } = req.body;
    const prompt = style === 'short' 
      ? `Перепиши это объявление, сделав его максимально коротким и лаконичным: ${text}`
      : `Перепиши это объявление, сделав его более продающим: ${text}`;

    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }]
    });

    res.json({ text: response.choices[0].message.content || text });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Rewriting failed" });
  }
});

// ... (keep Vite middleware as before)
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SellSmart Service online on port ${PORT}`);
  });
}

initializeServer();
