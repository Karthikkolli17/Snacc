export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, kind } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image' });

  const isDrink = kind === 'drink';
  const prompt = isDrink
    ? `You are a nutrition label parser for beverages. Extract nutrition facts from this image and return ONLY a valid JSON object with these exact keys (use null if not found):
{
  "serving": "serving size as a string e.g. 240ml or 12 fl oz",
  "calories": number or null,
  "sugars": number or null,
  "carbs": number or null,
  "sodium": number or null,
  "caffeine": number in mg or null
}
Return only the JSON, no explanation.`
    : `You are a nutrition label parser. Extract all nutrition facts from this image and return ONLY a valid JSON object with these exact keys (use null if not found):
{
  "serving": "serving size as a string e.g. 28g or 1 cup",
  "calories": number or null,
  "fat": number or null,
  "satFat": number or null,
  "sodium": number or null,
  "carbs": number or null,
  "fiber": number or null,
  "sugars": number or null,
  "protein": number or null
}
Return only the JSON, no explanation.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: image } },
            ],
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 256 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini API error:', response.status, err);
      return res.status(502).json({ error: `Gemini ${response.status}: ${err.slice(0, 200)}` });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return res.status(502).json({ error: 'No JSON in response' });

    const parsed = JSON.parse(json);
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
