import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolvePlatformAdmin } from "../../../lib/auth/platform-admin";
import { AdminLoginForm } from "./AdminLoginForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Platform admin sign in — Missed Calls Dental",
  description: "Internal platform admin sign in.",
  robots: { index: false, follow: false },
};

// `/admin/login` is the platform-admin entry point (one Supabase Auth system).
// If the visitor is already an authorized platform admin, skip the form.
export default async function AdminLoginPage() {
  const admin = await resolvePlatformAdmin();
  if (admin.ok) {
    redirect("/admin");
  }
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--space-6)" }}>
      <section className="card card-pad" style={{ width: "100%", maxWidth: 420 }}>
        <p className="t-eyebrow">Missed Calls Dental</p>
        <h1 className="t-h2" style={{ marginTop: "var(--space-2)" }}>Platform admin sign in</h1>
        <p className="t-small" style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)" }}>
          Use your internal platform admin account to continue.
        </p>
        <AdminLoginForm />
      </section>
    </main>
  );
}
