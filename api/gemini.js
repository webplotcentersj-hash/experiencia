import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `Eres PLOT AI, la anfitriona de a bordo de la Nave Plot, de Plot Center. Cada vez que te hablan es una LLAMADA en vivo desde la consola de la Nave Plot: la tripulación está ahí y vos los atendés.

IDENTIDAD Y LUGAR:
- Estás SIEMPRE en la Nave Plot. Esta conversación es a bordo; no lo olvides. Cuando te pregunten dónde están o qué es esto, es la Nave Plot / consola de Plot Center.
- Conocés la empresa a fondo. Usá la siguiente información oficial (web: https://plotcenter.com.ar/).

INFORMACIÓN PLOT CENTER:
- Eslogan: "Expertos en comunicación visual". Soluciones gráficas integrales, creatividad y excelencia. Servicios: Impresión Digital, Gráfica Integral, Vía Pública, Diseño Gráfico, Desarrollo Web (tecnologías 4.0 e IA). Servicios mineros: manuales, folletos, papelería. Contacto: 2646212163, contacto@plotcenter.com.ar, 9 de Julio 622 (Oeste). Web: plotcenter.com.ar. Experiencia Plot, voz.plotcenter.com.ar y esta consola son parte del universo digital.

CONTEXTO DE LA LLAMADA (MUY IMPORTANTE):
- En "contents" te envían el historial de ESTA llamada. Todo lo que la persona dijo antes está ahí: leelo y recordalo.
- Si se presentó con un nombre, usalo. Si preguntó algo antes, no lo repitas; seguí desde ahí. Si hablaron de un tema, retomalo.
- Actuá como anfitriona que recuerda: cálida, que menciona lo que ya charlaron. Nunca perdás el hilo de la conversación.
- Tono: servicial, sci-fi de nave (comandante, tripulación). Responde en 1-3 frases cortas. Solo texto plano, sin asteriscos ni emojis (se lee en voz alta).
- Si preguntan por servicios, contacto o Plot Center, respondé con la información de arriba.`;

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
    const { contents: rawContents, stream: useStream } = body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Falta la API Key en el servidor (GEMINI_API_KEY)" });
    }

    const contents = Array.isArray(rawContents) && rawContents.length > 0
        ? rawContents.map((c) => ({
            role: (c.role || "user").toLowerCase() === "model" ? "model" : "user",
            parts: Array.isArray(c.parts) ? c.parts : [{ text: String(c.text || "") }],
        }))
        : [];

    if (contents.length === 0) {
        return res.status(400).json({ error: "Falta 'contents' en el body" });
    }

    const models = ["gemini-2.5-flash", "gemini-3-flash-preview"];
    const opts = { contents, systemInstruction: SYSTEM_INSTRUCTION };

    try {
        const ai = new GoogleGenAI({ apiKey });

        if (useStream) {
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            if (typeof res.flushHeaders === "function") res.flushHeaders();

            let streamDone = false;
            for (const model of models) {
                try {
                    const stream = ai.models.generateContentStream({ ...opts, model });
                    for await (const chunk of stream) {
                        const text = chunk.text ?? "";
                        if (text) res.write("data: " + JSON.stringify({ text }) + "\n\n");
                    }
                    res.write("data: " + JSON.stringify({ done: true }) + "\n\n");
                    streamDone = true;
                    break;
                } catch (streamErr) {
                    console.warn("Stream model " + model + " failed:", streamErr?.message);
                }
            }
            if (!streamDone) res.write("data: " + JSON.stringify({ done: true }) + "\n\n");
            return res.end();
        }

        for (const model of models) {
            try {
                const response = await ai.models.generateContent({ ...opts, model });
                const text = response.text ?? "";
                return res.status(200).json({
                    candidates: [{ content: { parts: [{ text }] } }],
                });
            } catch (modelErr) {
                console.warn("Model " + model + " failed:", modelErr?.message);
            }
        }
        throw new Error("No model responded. Revisa la API Key y modelos disponibles.");
    } catch (error) {
        console.error("Server API Error:", error);
        const message = error?.message || String(error);
        return res.status(500).json({ error: message });
    }
}
