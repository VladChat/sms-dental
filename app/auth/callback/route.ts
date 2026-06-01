import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestUrl = req.nextUrl;
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return redirectToLoginWithError(requestUrl);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToLoginWithError(requestUrl);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}

function getSafeNextPath(next: string | null): string {
  if (!next) return "/account";
  if (!next.startsWith("/") || next.startsWith("//")) return "/account";
  if (next.includes("\\") || next.includes("\r") || next.includes("\n")) return "/account";
  return next;
}

function redirectToLoginWithError(url: URL): NextResponse {
  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("error", "invalid_or_expired_link");
  return NextResponse.redirect(loginUrl);
}

