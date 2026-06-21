import { NextRequest, NextResponse } from "next/server";
import { contentTypeFor } from "@/lib/quiz-inject";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves an uploaded quiz/page from the public Supabase Storage bucket,
// proxied under a clean URL on our own domain so:
//  - relative assets (img/...) resolve under /q/<slug>/
//  - SVG <use href="#id"> fragments keep working (no <base> tag)
//  - UTM/cid query params survive (the tracker reads them from this URL)
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string; path?: string[] } }
) {
  const { slug, path } = params;
  const segments = path || [];

  if (segments.some((s) => s === ".." || s.includes("\\"))) {
    return new NextResponse("Bad path", { status: 400 });
  }

  const url = new URL(req.url);
  const isIndex = segments.length === 0;

  // Force trailing slash on the index so relative paths resolve to /q/<slug>/.
  if (isIndex && !url.pathname.endsWith("/")) {
    return NextResponse.redirect(
      new URL(url.pathname + "/" + url.search, url.origin),
      308
    );
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supaUrl) return new NextResponse("Misconfigured", { status: 500 });

  const rel = isIndex ? "index.html" : segments.join("/");
  const target = `${supaUrl}/storage/v1/object/public/quizzes/${encodeURIComponent(
    slug
  )}/${rel.split("/").map(encodeURIComponent).join("/")}`;

  const upstream = await fetch(target, { cache: "no-store" });
  if (!upstream.ok) {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  const ct = contentTypeFor(rel);
  const headers = new Headers();
  headers.set("Content-Type", ct);
  // index: always fresh (so re-uploads show immediately). assets: cache hard.
  headers.set(
    "Cache-Control",
    isIndex
      ? "no-cache, must-revalidate"
      : "public, max-age=3600, s-maxage=86400"
  );

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, { status: 200, headers });
}
