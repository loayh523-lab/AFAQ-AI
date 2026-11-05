import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const apiKey = process.env.AFAQ_PROVIDER_API_KEY || process.env.OPENAI_API_KEY;
  const endpoint = process.env.AFAQ_PROVIDER_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.AFAQ_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    return NextResponse.json(
      { error: "خدمة آفاق لم تُفعّل بعد. يرجى المحاولة لاحقاً." },
      { status: 503 },
    );
  }

  let payload: { messages?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 48_000) {
      return NextResponse.json({ error: "الرسالة طويلة جداً." }, { status: 413 });
    }
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "تعذّر قراءة الطلب." }, { status: 400 });
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0 || payload.messages.length > 24) {
    return NextResponse.json({ error: "سجل المحادثة غير صالح." }, { status: 400 });
  }

  const messages: ChatMessage[] = [];
  for (const item of payload.messages) {
    if (!item || typeof item !== "object") {
      return NextResponse.json({ error: "رسالة غير صالحة." }, { status: 400 });
    }
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim() || content.length > 12_000) {
      return NextResponse.json({ error: "محتوى الرسالة غير صالح." }, { status: 400 });
    }
    messages.push({ role, content });
  }

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "أنت آفاق، مساعد عربي ذكي ودقيق. أجب بلغة المستخدم. كن واضحاً، ولا تختلق الحقائق. عند كتابة البرامج قدّم حلولاً عملية واختبر الافتراضات.",
          },
          ...messages,
        ],
        temperature: 0.65,
        max_tokens: 1800,
      }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      console.error("AI provider request failed", upstream.status);
      return NextResponse.json(
        { error: upstream.status === 429 ? "آفاق مشغول حالياً. حاول بعد قليل." : "تعذّر الوصول إلى خدمة الذكاء الاصطناعي حالياً." },
        { status: upstream.status === 429 ? 429 : 502 },
      );
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return NextResponse.json({ error: "لم تُرجع الخدمة إجابة نصية." }, { status: 502 });
    }
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("AI provider connection error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "تعذّر الاتصال بآفاق. تحقق من الإنترنت وحاول مجدداً." }, { status: 502 });
  }
}
