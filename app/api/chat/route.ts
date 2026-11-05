import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { messages?: ChatMessage[]; provider?: string };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length || messages.length > 40 || messages.some(m => !['user','assistant'].includes(m.role) || typeof m.content !== 'string')) {
      return NextResponse.json({ error: 'أرسل رسائل صالحة (حتى 40 رسالة).' }, { status: 400 });
    }
    const provider = body.provider === 'openai' ? 'openai' : 'gemini';
    const system = 'You are AFAQ AI, a helpful and accurate AI assistant. Reply in the user’s language. For Arabic, use clear natural Arabic. Be honest about uncertainty. For coding tasks, provide complete practical solutions.';

    if (provider === 'gemini') {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return NextResponse.json({ error: 'أضف GEMINI_API_KEY في إعدادات Environment Variables حتى يعمل النموذج.' }, { status: 503 });
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.7, maxOutputTokens: 8192 } }),
      });
      const data = await response.json();
      if (!response.ok) return NextResponse.json({ error: data?.error?.message || 'تعذر الاتصال بـ Gemini.' }, { status: response.status });
      const answer = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('');
      if (!answer) return NextResponse.json({ error: 'لم يرجع النموذج إجابة. جرّب مرة أخرى.' }, { status: 502 });
      return NextResponse.json({ answer, provider: 'gemini', model });
    }

    const key = process.env.AI_API_KEY;
    if (!key) return NextResponse.json({ error: 'أضف AI_API_KEY في إعدادات Environment Variables.' }, { status: 503 });
    const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = process.env.AI_MODEL || 'gpt-4o-mini';
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages], temperature: 0.7 }),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data?.error?.message || 'تعذر الاتصال بمزود النموذج.' }, { status: response.status });
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer) return NextResponse.json({ error: 'استجابة النموذج غير متوقعة.' }, { status: 502 });
    return NextResponse.json({ answer, provider: 'openai-compatible', model });
  } catch {
    return NextResponse.json({ error: 'حدث خطأ غير متوقع. حاول مرة أخرى.' }, { status: 500 });
  }
}
