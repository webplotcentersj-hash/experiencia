import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = "Eres la inteligencia artificial de la Nave Plot de Plot Center. Tu nombre es PLOT AI. Eres eficiente, servicial y ligeramente misteriosa. Tu objetivo es asistir a la tripulación. Respuestas breves, directas y en estilo 'Sci-Fi'. No uses Markdown.";

function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
    setCors(res);
    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    let body = req.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch (_) {
            return res.status(400).json({ error: "Body JSON inválido" });
        }
    }
    const { contents: rawContents } = body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Falta la API Key en el servidor (GEMINI_API_KEY)" });
    }

    // Normalizar contents: array de { role, parts }
    const contents = Array.isArray(rawContents) && rawContents.length > 0
        ? rawContents.map((c) => ({
            role: (c.role || "user").toLowerCase() === "model" ? "model" : "user",
            parts: Array.isArray(c.parts) ? c.parts : [{ text: String(c.text || "") }],
        }))
        : [];

    if (contents.length === 0) {
        return res.status(400).json({ error: "Falta 'contents' en el body" });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents,
            systemInstruction: SYSTEM_INSTRUCTION,
        });

        const text = response.text ?? "";

        return res.status(200).json({
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
        const message = error?.message || String(error);
        return res.status(500).json({ error: message });
    }
}
