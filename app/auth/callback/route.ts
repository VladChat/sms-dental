import { NextResponse, type NextRequest } from "next/server";
import { resolvePostAuthRedirectPath } from "../../../lib/auth/post-auth-redirect";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Email OTP types Supabase can issue via token_hash links (recovery, email
// confirmation, magic link, etc.). Declared locally so we don't depend on the
// supabase-js type export; these string literals are structurally compatible
// with verifyOtp's expected union.
type EmailOtpType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email";

const VALID_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function asEmailOtpType(value: string | null): EmailOtpType | null {
  return value !== null && (VALID_OTP_TYPES as readonly string[]).includes(value)
    ? (value as EmailOtpType)
    : null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestUrl = req.nextUrl;
  const params = requestUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const otpType = asEmailOtpType(params.get("type"));
  const nextPath = getSafeNextPath(params.get("next"));

  const supabase = await createSupabaseServerClient();

  // Token-hash flow. Recovery/confirmation emails link first to the app domain
  // (`{{ .SiteURL }}/auth/callback?token_hash=...&type=recovery&next=/reset-password`)
  // so the visible link is branded, not a raw Supabase project-ref URL. Verifying
  // the OTP establishes the session cookies, same as the PKCE exchange below.
  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (error) {
      return redirectToLoginWithError(requestUrl);
    }
    const targetPath =
      nextPath ??
      await resolveRoleAwareFallbackPath(supabase);
    return NextResponse.redirect(new URL(targetPath, requestUrl.origin));
  }

  // PKCE/code flow (kept for existing links and providers).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectToLoginWithError(requestUrl);
    }
    const targetPath =
      nextPath ??
      await resolveRoleAwareFallbackPath(supabase);
    return NextResponse.redirect(new URL(targetPath, requestUrl.origin));
  }

  return redirectToLoginWithError(requestUrl);
}

function getSafeNextPath(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (next.includes("\\") || next.includes("\r") || next.includes("\n")) return null;
  return next;
}

async function resolveRoleAwareFallbackPath(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return "/login";

  return resolvePostAuthRedirectPath({
    id: data.user.id,
    email: data.user.email,
  });
}

function redirectToLoginWithError(url: URL): NextResponse {
  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("error", "invalid_or_expired_link");
  return NextResponse.redirect(loginUrl);
}
