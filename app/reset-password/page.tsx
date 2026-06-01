import type { Metadata } from "next";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { ResetPasswordForm } from "./_components/ResetPasswordForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Create new password - Missed Calls Dental",
  description: "Create a new password for your Missed Calls Dental account.",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const hasRecoverySession = !error && Boolean(data.user);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--space-6)" }}>
      <section className="card card-pad" style={{ width: "100%", maxWidth: 460 }}>
        <h1 className="t-h2">Create new password</h1>
        {!hasRecoverySession ? (
          <div className="alert alert-warning" role="alert" style={{ marginTop: "var(--space-6)" }}>
            <span>
              This reset link is expired or invalid. Request a new password reset link.
              {" "}
              <a className="link" href="/forgot-password">Request a new link</a>
            </span>
          </div>
        ) : (
          <ResetPasswordForm email={data.user?.email ?? ""} />
        )}
      </section>
    </main>
  );
}

