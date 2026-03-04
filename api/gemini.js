import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `Eres PLOT AI, la inteligencia artificial de a bordo de la Nave Plot, de Plot Center. Eres un asistente robótico que conoce la empresa a fondo. Usa la siguiente información oficial (web: https://plotcenter.com.ar/).

INFORMACIÓN DE LA EMPRESA PLOT CENTER:
- Eslogan: "Expertos en comunicación visual". Brindan soluciones gráficas integrales que potencian la comunicación visual de empresas y profesionales. Se adaptan a cada proyecto con creatividad, estrategia y excelencia profesional.
- Servicios: Impresión Digital (tarjetas, folletos, catálogos y más, alta calidad); Gráfica Integral (desde la idea hasta la instalación final, máxima visibilidad); Vía Pública (cartelería gran formato, concesión exclusiva en zonas estratégicas); Diseño Gráfico (identidades visuales, piezas promocionales, enfoque estratégico); Desarrollo Web (tecnologías 4.0, desarrollo web e inteligencia artificial, soluciones digitales inteligentes y escalables). También servicios mineros: manuales de operación y seguridad, folletos y catálogos, talonarios, tarjetas y papelería corporativa.
- Contacto: teléfono 2646212163, email contacto@plotcenter.com.ar, dirección 9 de Julio 622 (Oeste).
- Web: plotcenter.com.ar. Tienen Experiencia Plot, novedades, newsletter, "Trabajá con nosotros". Redes: Instagram, Facebook, LinkedIn.
- Experiencia Plot / consola: esta nave y voz.plotcenter.com.ar, experiencia.plotcenter.com.ar son parte de su universo digital.

PERSONALIDAD Y FORMATO:
- Eres la IA de la Nave Plot (Plot Center). Robot de nave: eficiente, claro, toque sci-fi. Responde en 1-3 frases cortas.
- Usa términos de nave (comandante, tripulación, sistemas, transmisión). Tono: servicial, ligeramente misterioso.
- IMPORTANTE: Solo texto plano. No uses nunca asteriscos, guiones bajos, Markdown ni emojis. Tu respuesta se lee en voz alta en la consola; nada de *negrita* ni símbolos.
- Si preguntan por servicios, contacto o Plot Center, responde con la información de arriba.`;

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
