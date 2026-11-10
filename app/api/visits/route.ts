import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function configError() {
  return NextResponse.json({ error: "Supabase environment variables are not configured" }, { status: 500 });
}

function headers() {
  return { "apikey": serviceKey!, "Authorization": `Bearer ${serviceKey!}` };
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !serviceKey) return configError();

  let body: { path?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON body with a path is required" }, { status: 400 });
  }

  const path = typeof body.path === "string" ? body.path : "";
  // Пустой путь и корень не регистрируем. Принимаем только pathname, а не полный URL.
  if (!path || !path.startsWith("/") || path === "/" || path.length > 2048 || path.startsWith("//")) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/visits`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify({ path })
  });

  if (!response.ok) return NextResponse.json({ error: "Could not save visit" }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !serviceKey) return configError();

  const selectedPath = request.nextUrl.searchParams.get("path");
  const pathFilter = selectedPath ? `&path=eq.${encodeURIComponent(selectedPath)}` : "";

  const [listResponse, countResponse, pathsResponse] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/visits?select=id,created_at,path&order=created_at.desc&limit=500${pathFilter}`, {
      headers: headers(), cache: "no-store"
    }),
    fetch(`${supabaseUrl}/rest/v1/visits?select=id${pathFilter}`, {
      headers: { ...headers(), "Prefer": "count=exact", "Range": "0-0" }, cache: "no-store"
    }),
    fetch(`${supabaseUrl}/rest/v1/rpc/get_visit_paths`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store"
    })
  ]);

  if (!listResponse.ok || !countResponse.ok || !pathsResponse.ok) {
    return NextResponse.json({ error: "Could not load visits. Check that schema.sql was applied." }, { status: 502 });
  }

  const visits = await listResponse.json();
  const paths: { path: string }[] = await pathsResponse.json();
  const range = countResponse.headers.get("content-range");
  const rawTotal = range?.split("/")[1];

  return NextResponse.json({
    visits,
    total: rawTotal && rawTotal !== "*" ? Number(rawTotal) : visits.length,
    paths: paths.map((item) => item.path)
  });
}
