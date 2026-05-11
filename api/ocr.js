import { requireSession } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireSession(req, res);
  if (!user) return;

  const { image, kind } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image' });
  if (typeof image !== 'string' || image.length > 3_000_000) {
    return res.status(413).json({ error: 'Image payload too large' });
  }

  const isDrink = kind === 'drink';
  const prompt = isDrink
    ? `You are a nutrition label parser for beverages. Extract nutrition facts from this image and return ONLY a valid JSON object with these exact keys (use null if not found):
{
  "serving": "serving size as a string e.g. 240ml or 12 fl oz",
  "calories": number or null,
  "sugars": number or null,
  "carbs": number or null,
  "sodium": number or null,
  "caffeine": number in mg or null,
  "protein": number or null
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
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          temperature: 0,
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
            ],
          }],
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq API error:', response.status, err);
      return res.status(502).json({ error: `Groq ${response.status}: ${err.slice(0, 200)}` });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return res.status(502).json({ error: 'No JSON in response' });

    const parsed = JSON.parse(json);
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
