import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type ChatMessage = { role: "user" | "assistant"; content: string };

const RESPONSE_GUIDANCE: Record<string, string> = {
  concise: "قدّم إجابة مختصرة ومباشرة مع الاحتفاظ بالمعلومة الضرورية.",
  balanced: "قدّم إجابة متوازنة ومنظمة مع أمثلة عند الحاجة.",
  detailed: "قدّم شرحاً مفصلاً ومنظماً وخطوات واضحة وأمثلة عند الحاجة.",
};

export async function POST(request: NextRequest) {
  const gatewayToken = process.env.VERCEL_OIDC_TOKEN;
  const endpoint = "https://ai-gateway.vercel.sh/v1/chat/completions";
  const model = process.env.AFAQ_MODEL || "nvidia/nemotron-3.5-lightning-free";

  if (!gatewayToken) {
    return NextResponse.json(
      { error: "خدمة آفاق لم تُفعّل على الخادم بعد. حاول لاحقاً." },
      { status: 503 },
    );
  }

  let payload: { messages?: unknown; preferences?: { responseStyle?: unknown } };
  try {
    const raw = await request.text();
    if (raw.length > 128_000) {
      return NextResponse.json({ error: "الطلب طويل جداً." }, { status: 413 });
    }
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "تعذّر قراءة الطلب." }, { status: 400 });
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0 || payload.messages.length > 20) {
    return NextResponse.json({ error: "سجل المحادثة غير صالح." }, { status: 400 });
  }

  const messages: ChatMessage[] = [];
  for (const item of payload.messages) {
    if (!item || typeof item !== "object") {
      return NextResponse.json({ error: "رسالة غير صالحة." }, { status: 400 });
    }
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim() || content.length > 10_000) {
      return NextResponse.json({ error: "محتوى الرسالة غير صالح." }, { status: 400 });
    }
    messages.push({ role, content });
  }

  if (messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "يجب أن تنتهي المحادثة برسالة من المستخدم." }, { status: 400 });
  }

  const style = payload.preferences?.responseStyle;
  const styleInstruction = typeof style === "string" && style in RESPONSE_GUIDANCE
    ? RESPONSE_GUIDANCE[style]
    : RESPONSE_GUIDANCE.balanced;

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `أنت آفاق، مساعد عربي ذكي ودقيق. أجب بلغة المستخدم. كن واضحاً ولا تختلق الحقائق. عند كتابة البرامج قدّم حلولاً عملية قابلة للاختبار. ${styleInstruction}`,
          },
          ...messages,
        ],
        temperature: 0.65,
        max_tokens: 3000,
      }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      console.error("AI Gateway request failed", upstream.status, data?.error?.code ?? "provider_error");
      return NextResponse.json(
        { error: upstream.status === 429 ? "آفاق مشغول حالياً. حاول بعد قليل." : upstream.status === 402 ? "خدمة الذكاء الاصطناعي غير متاحة حالياً على الخادم." : "تعذّر الوصول إلى خدمة الذكاء الاصطناعي حالياً." },
        { status: upstream.status === 429 ? 429 : 502 },
      );
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return NextResponse.json({ error: "لم تُرجع الخدمة إجابة نصية." }, { status: 502 });
    }
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("AI Gateway connection error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "تعذّر الاتصال بآفاق. تحقق من الإنترنت وحاول مجدداً." }, { status: 502 });
  }
}
