import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

function contentType(filename: string) {
  const extension = filename.toLowerCase().split(".").pop();
  const types: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    csv: "text/csv; charset=utf-8",
    txt: "text/plain; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    json: "application/json",
    zip: "application/zip",
  };
  return types[extension || ""] || "application/octet-stream";
}

function safeFilename(value: string) {
  return value.replace(/[\\/\\r\\n\\0"]/g, "_").slice(0, 120) || "AFAQ-output";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ containerId: string; fileId: string }> },
) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AFAQ_OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "تنزيل الملفات غير مهيأ بعد على خادم آفاق." },
      { status: 503 },
    );
  }

  const secret = apiKey;
  const { containerId, fileId } = await context.params;
  if (
    !/^[A-Za-z0-9_-]{5,160}$/.test(containerId) ||
    !/^[A-Za-z0-9_-]{5,160}$/.test(fileId)
  ) {
    return NextResponse.json({ error: "رابط الملف غير صالح." }, { status: 400 });
  }

  const query = request.nextUrl.searchParams;
  const filename = safeFilename(query.get("filename") || "AFAQ-output");
  const expires = Number(query.get("expires"));
  const signature = query.get("signature") || "";
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires < now || expires > now + 16 * 60) {
    return NextResponse.json(
      { error: "انتهت صلاحية رابط الملف. أنشئ الملف مرة ثانية." },
      { status: 410 },
    );
  }

  const payload = [containerId, fileId, filename, String(expires)].join("\\n");
  const expected = createHmac("sha256", secret).update(payload).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return NextResponse.json({ error: "توقيع رابط الملف غير صالح." }, { status: 403 });
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: "توقيع رابط الملف غير صالح." }, { status: 403 });
  }

  try {
    const upstream = await fetch(
      `https://api.openai.com/v1/containers/${encodeURIComponent(containerId)}/files/${encodeURIComponent(fileId)}/content`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      },
    );

    if (!upstream.ok || !upstream.body) {
      console.error("AFAQ file download failed", upstream.status);
      return NextResponse.json(
        { error: upstream.status === 404 ? "الملف لم يعد متاحاً في بيئة التنفيذ." : "تعذّر تنزيل الملف من الخدمة." },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const asciiFilename = filename.replace(/[^A-Za-z0-9._-]/g, "_");
    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType(filename),
        "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("AFAQ file proxy error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: "انقطع الاتصال أثناء تنزيل الملف. حاول مجدداً." },
      { status: 502 },
    );
  }
}
