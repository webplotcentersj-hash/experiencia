
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
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: {
                    parts: [{
                        text: "Eres la inteligencia artificial de la nave OMEGA de Plot Center. Tu nombre es PLOT AI. Eres eficiente, servicial y ligeramente misteriosa. Tu objetivo es asistir a la tripulación. Respuestas breves, directas y en estilo 'Sci-Fi'. No uses Markdown."
                    }]
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API Error: ${errorText}`);
        }

        const data = await response.json();
        res.status(200).json(data);

    } catch (error) {
        console.error("Server API Error:", error);
        res.status(500).json({ error: error.message });
    }
}
