import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };
type Attachment = { name: string; type: string; data: string };

const RESPONSE_GUIDANCE: Record<string, string> = {
  concise: "اكتب بإيجاز من دون حذف الخطوات الضرورية.",
  balanced: "قدّم إجابة واضحة ومتوازنة، واستخدم الأمثلة عندما تفيد.",
  detailed: "اشرح بالتفصيل وبترتيب منطقي، مع أمثلة وخطوات قابلة للتطبيق.",
};

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function friendlyGatewayError(status: number) {
  if (status === 401 || status === 403) return "تعذّر توثيق خدمة الذكاء الاصطناعي. إعداد الاتصال على الخادم يحتاج إلى مراجعة.";
  if (status === 402) return "رصيد خدمة الذكاء الاصطناعي غير متاح حالياً. راجع إعدادات الخدمة.";
  if (status === 429) return "وصلنا إلى حد الطلبات مؤقتاً. انتظر قليلاً ثم أعد المحاولة.";
  if (status === 413) return "حجم الملفات المرفقة أكبر من الحد المسموح.";
  if (status >= 500) return "خدمة الذكاء الاصطناعي تواجه مشكلة مؤقتة. حاول مرة ثانية بعد قليل.";
  return "لم نتمكن من إكمال الطلب. راجع الرسالة وحاول مجدداً.";
}

function collectCitations(item: any) {
  const found: Array<{ title: string; url: string }> = [];
  for (const part of item?.content ?? []) {
    for (const annotation of part?.annotations ?? []) {
      const citation = annotation?.url_citation ?? annotation;
      if (typeof citation?.url === "string" && /^https?:\/\//i.test(citation.url)) {
        found.push({
          title: typeof citation.title === "string" && citation.title.trim() ? citation.title : citation.url,
          url: citation.url,
        });
      }
    }
  }
  return found;
}

type ContainerArtifact = { containerId: string; fileId: string; filename: string };

function collectFileArtifacts(item: any): ContainerArtifact[] {
  const found: ContainerArtifact[] = [];
  for (const part of item?.content ?? []) {
    for (const annotation of part?.annotations ?? []) {
      const citation = annotation?.container_file_citation ?? annotation;
      const isFileCitation =
        annotation?.type === "container_file_citation" ||
        annotation?.type === "file_citation" ||
        typeof citation?.container_id === "string";
      if (!isFileCitation) continue;
      if (
        typeof citation?.container_id === "string" &&
        typeof citation?.file_id === "string"
      ) {
        found.push({
          containerId: citation.container_id,
          fileId: citation.file_id,
          filename: typeof citation.filename === "string" ? citation.filename : "AFAQ-output",
        });
      }
    }
  }
  return found;
}

function signedFileUrl(origin: string, artifact: ContainerArtifact, secret: string) {
  const expires = Math.floor(Date.now() / 1000) + 15 * 60;
  const filename = artifact.filename.replace(/[\\/\\r\\n\\0]/g, "_").slice(0, 120) || "AFAQ-output";
  const payload = [artifact.containerId, artifact.fileId, filename, String(expires)].join("\\n");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  const query = new URLSearchParams({ filename, expires: String(expires), signature });
  return {
    name: filename,
    url: `${origin}/api/files/${encodeURIComponent(artifact.containerId)}/${encodeURIComponent(artifact.fileId)}?${query.toString()}`,
    expiresAt: expires,
  };
}

export async function POST(request: NextRequest) {
  // Vercel Functions pass OIDC through this request header. The environment
  // variable is retained as a fallback for local/dev and build environments.
  const gatewayToken =
    request.headers.get("x-vercel-oidc-token") ||
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN;

  if (!gatewayToken) {
    return NextResponse.json(
      { error: "خدمة آفاق غير مهيأة على الخادم بعد." },
      { status: 503 },
    );
  }

  let payload: {
    messages?: unknown;
    attachments?: unknown;
    preferences?: { responseStyle?: unknown; webSearch?: unknown; generateImage?: unknown };
  };

  try {
    const raw = await request.text();
    if (raw.length > 28_000_000) {
      return NextResponse.json({ error: friendlyGatewayError(413) }, { status: 413 });
    }
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "تعذّر قراءة الطلب. حاول إرسال الرسالة مرة ثانية." }, { status: 400 });
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0 || payload.messages.length > 30) {
    return NextResponse.json({ error: "سجل المحادثة غير صالح." }, { status: 400 });
  }

  const messages: ChatMessage[] = [];
  for (const item of payload.messages) {
    if (!item || typeof item !== "object") {
      return NextResponse.json({ error: "توجد رسالة غير صالحة في المحادثة." }, { status: 400 });
    }
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (
      (role !== "user" && role !== "assistant") ||
      typeof content !== "string" ||
      !content.trim() ||
      content.length > 16_000
    ) {
      return NextResponse.json({ error: "محتوى إحدى الرسائل غير صالح أو طويل جداً." }, { status: 400 });
    }
    messages.push({ role, content });
  }

  const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
  if (lastUserIndex < 0 || lastUserIndex !== messages.length - 1) {
    return NextResponse.json({ error: "يجب أن تنتهي المحادثة برسالة جديدة منك." }, { status: 400 });
  }

  const attachments: Attachment[] = [];
  if (payload.attachments !== undefined) {
    if (!Array.isArray(payload.attachments) || payload.attachments.length > 6) {
      return NextResponse.json({ error: "يمكن إرفاق ستة ملفات كحد أقصى في الرسالة." }, { status: 400 });
    }
    let totalBytes = 0;
    for (const value of payload.attachments) {
      if (!value || typeof value !== "object") {
        return NextResponse.json({ error: "تعذّر قراءة أحد الملفات المرفقة." }, { status: 400 });
      }
      const file = value as Partial<Attachment>;
      if (
        typeof file.name !== "string" ||
        typeof file.type !== "string" ||
        typeof file.data !== "string" ||
        !file.data.startsWith("data:") ||
        file.data.length > 14_000_000
      ) {
        return NextResponse.json({ error: "أحد الملفات غير صالح أو حجمه كبير." }, { status: 400 });
      }

      const mimeType = file.type.toLowerCase().split(";")[0];
      const isImage = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType);
      if (!isImage && !ALLOWED_FILE_TYPES.has(mimeType)) {
        return NextResponse.json(
          { error: "هذا النوع من الملفات غير مدعوم حالياً. جرّب PDF أو Word أو PowerPoint أو Excel أو صورة أو ملف نصي." },
          { status: 415 },
        );
      }

      const encoded = file.data.slice(file.data.indexOf(",") + 1);
      const estimatedBytes = Math.floor((encoded.length * 3) / 4);
      totalBytes += estimatedBytes;
      if (estimatedBytes > 10_000_000 || totalBytes > 20_000_000) {
        return NextResponse.json({ error: friendlyGatewayError(413) }, { status: 413 });
      }
      attachments.push({ name: file.name.slice(0, 180), type: mimeType, data: file.data });
    }
  }

  const style = payload.preferences?.responseStyle;
  const styleInstruction =
    typeof style === "string" && style in RESPONSE_GUIDANCE
      ? RESPONSE_GUIDANCE[style]
      : RESPONSE_GUIDANCE.balanced;

  const tools: Array<Record<string, unknown>> = [
    { type: "code_interpreter", container: { type: "auto", memory_limit: "1g" } },
  ];
  if (payload.preferences?.webSearch === true) {
    tools.push({ type: "web_search" });
  }
  if (payload.preferences?.generateImage === true) {
    tools.push({
      type: "image_generation",
      model: process.env.AFAQ_IMAGE_MODEL || "gpt-image-2.5-flare",
      size: "1024x1024",
      quality: "medium",
    });
  }

  const input = messages.map((message, index) => {
    if (index !== lastUserIndex || attachments.length === 0) {
      return { role: message.role, content: message.content };
    }

    const parts: Array<Record<string, unknown>> = [
      { type: "input_text", text: message.content },
    ];
    for (const file of attachments) {
      if (file.type.startsWith("image/")) {
        parts.push({ type: "input_image", image_url: file.data, detail: "high" });
      } else {
        parts.push({
          type: "input_file",
          filename: file.name,
          file_data: file.data,
          ...(file.type === "application/pdf" ? { detail: "high" } : {}),
        });
      }
    }
    return { role: "user", content: parts };
  });

  const model = process.env.AFAQ_MODEL || "openai/gpt-6.1-sol";
  const artifactDownloadsEnabled = Boolean(process.env.OPENAI_API_KEY || process.env.AFAQ_OPENAI_API_KEY);

  try {
    const upstream = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        model,
        instructions: [
          "أنت AFAQ AI، مساعد عربي متعدد القدرات. أجب بلغة المستخدم وبأسلوب طبيعي وواضح، لا تكرر التحية ولا تتحدث عن نفسك بلا داعٍ.",
          "افهم المطلوب قبل الإجابة. في الرياضيات والعلوم اعرض القانون والتعويض والخطوات والوحدات ثم تحقق من النتيجة. في الواجبات علّم المستخدم ولا تخترع معلومات.",
          "في البرمجة اكتب حلولاً قابلة للتشغيل، واذكر الملفات والخطوات والاختبارات عند الحاجة. عند تحليل صورة أو ملف استند إلى محتواه فعلاً واذكر أي جزء غير واضح.",
          "عند استخدام البحث أدرج مصادر واضحة داخل الإجابة. لا تدّعِ أنك بحثت إذا لم تستخدم أداة البحث.",
          "عند الحاجة إلى حسابات أو تحليل بيانات أو فحص ملفات، استخدم python tool (أداة Python) ونفّذ الحساب فعلياً قبل عرض النتيجة. لا تتظاهر بتشغيل كود لم يتم تشغيله.",
          "عندما يطلب المستخدم ملفاً قابلاً للتنزيل مثل PDF أو DOCX أو XLSX أو PPTX، أنشئ الملف فعلياً باستخدام python tool.",
          artifactDownloadsEnabled
            ? "تنزيل الملفات مفعّل: عند إنشاء ملف، تأكد من إخراج الملف كملف في حاوية Python كي يظهر رابط تنزيل فعلي."
            : "تنزيل الملفات غير مهيأ على الخادم حالياً: لا تدّعِ إرفاق ملف أو توفير رابط تنزيل. وضّح أن التنزيل يحتاج إلى إعداد مفتاح OpenAI الخاص بالخادم.",

          "إذا طُلب إنشاء صورة فاستخدم أداة توليد الصور عندما تكون مفعّلة. لا تقل إنك أنشأت صورة ما لم تُرجع الأداة صورة فعلية.",
          "لا تختلق مصادر أو نتائج تنفيذ. إذا لم تتمكن من تنفيذ شيء، قل ذلك بوضوح.",
          styleInstruction,
        ].join("\n"),
        reasoning: { effort: process.env.AFAQ_REASONING_EFFORT || "medium" },
        input,
        tools,
        ...(payload.preferences?.generateImage === true ? { tool_choice: { type: "image_generation" } } : {}),
        max_output_tokens: 6000,
        stream: true,
      }),
      signal: AbortSignal.timeout(55_000),
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      const errorBody = await upstream.json().catch(() => null);
      console.error("AFAQ AI Gateway error", upstream.status, errorBody?.error?.code ?? "gateway_error");
      return NextResponse.json(
        { error: friendlyGatewayError(upstream.status) },
        { status: upstream.status === 429 ? 429 : upstream.status === 413 ? 413 : 502 },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";
        const citations: Array<{ title: string; url: string }> = [];
        const fileArtifacts: ContainerArtifact[] = [];
        const seenImageCalls = new Set<string>();
        let streamFailure = "";
        let closed = false;

        const emit = (event: Record<string, unknown>) => {
          if (closed) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        const handleEvent = (line: string) => {
          if (!line.startsWith("data:")) return;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") return;
          let event: any;
          try { event = JSON.parse(raw); } catch { return; }

          if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
            answer += event.delta;
            emit({ type: "delta", text: event.delta });
          }

          if (event.type === "response.output_item.done") {
            const item = event.item;
            if (item?.type === "image_generation_call" && typeof item.result === "string") {
              const imageKey = typeof item.id === "string" ? item.id : item.result.slice(0, 48);
              if (!seenImageCalls.has(imageKey)) {
                seenImageCalls.add(imageKey);
                emit({ type: "image", data: item.result, mimeType: "image/png" });
              }
            }
            if (item?.type === "message") {
              citations.push(...collectCitations(item));
              fileArtifacts.push(...collectFileArtifacts(item));
            }
          }

          if (event.type === "response.completed") {
            for (const item of event.response?.output ?? []) {
              if (item?.type === "message") {
                citations.push(...collectCitations(item));
                fileArtifacts.push(...collectFileArtifacts(item));
              }
              if (item?.type === "image_generation_call" && typeof item.result === "string") {
                const imageKey = typeof item.id === "string" ? item.id : item.result.slice(0, 48);
                if (!seenImageCalls.has(imageKey)) {
                  seenImageCalls.add(imageKey);
                  emit({ type: "image", data: item.result, mimeType: "image/png" });
                }
              }
            }
          }

          if (event.type === "response.failed" || event.type === "error") {
            streamFailure = "تعذّر إكمال الرد من خدمة الذكاء الاصطناعي. أعد المحاولة.";
            emit({ type: "error", message: streamFailure });
          }
        };

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newline = buffer.indexOf("\n");
            while (newline !== -1) {
              const line = buffer.slice(0, newline).replace(/\r$/, "");
              buffer = buffer.slice(newline + 1);
              handleEvent(line);
              newline = buffer.indexOf("\n");
            }
          }
          if (buffer.trim()) handleEvent(buffer.trim());
          if (!streamFailure) {
            const apiKey = process.env.OPENAI_API_KEY || process.env.AFAQ_OPENAI_API_KEY;
            const files = apiKey
              ? fileArtifacts
                  .filter((artifact, index, all) =>
                    all.findIndex((other) => other.containerId === artifact.containerId && other.fileId === artifact.fileId) === index
                  )
                  .map((artifact) => signedFileUrl(request.nextUrl.origin, artifact, apiKey))
              : [];
            emit({
              type: "done",
              answer,
              citations: citations.filter((citation, index, all) =>
                all.findIndex((other) => other.url === citation.url) === index
              ),
              files,
              fileDownloadsConfigured: Boolean(apiKey),
            });
          }
        } catch (error) {
          console.error("AFAQ stream error", error instanceof Error ? error.message : "unknown");
          emit({ type: "error", message: "انقطع الاتصال أثناء إنشاء الرد. أعد المحاولة." });
        } finally {
          closed = true;
          reader.releaseLock();
          controller.close();
        }
      },
      cancel() {
        upstream.body?.cancel().catch(() => undefined);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("AFAQ upstream request failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: "تعذّر الاتصال بخدمة آفاق. تأكد من الاتصال بالإنترنت وحاول مجدداً." },
      { status: 502 },
    );
  }
}
