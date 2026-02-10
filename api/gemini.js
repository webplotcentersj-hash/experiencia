import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = "Eres la inteligencia artificial de la nave OMEGA de Plot Center. Tu nombre es PLOT AI. Eres eficiente, servicial y ligeramente misteriosa. Tu objetivo es asistir a la tripulación. Respuestas breves, directas y en estilo 'Sci-Fi'. No uses Markdown.";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { contents } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Falta la API Key en el servidor' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents,
            systemInstruction: SYSTEM_INSTRUCTION,
        });

        const text = response.text ?? "";

        // Misma estructura que la API REST para no romper el frontend
        res.status(200).json({
            candidates: [
                {
                    content: {
                        parts: [{ text }],
                    },
                },
            ],
        });
    } catch (error) {
        console.error("Server API Error:", error);
        res.status(500).json({ error: error.message });
    }
}
