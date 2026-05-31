import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveAuthClinicAccess, routeForRole } from "../../lib/auth/access";
import { LoginForm } from "./_components/LoginForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Sign in — Missed Calls Dental",
  description: "Sign in to your Missed Calls Dental account.",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const access = await resolveAuthClinicAccess();
  if (access.ok) {
    redirect(routeForRole(access.membership.role));
  }

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--space-6)" }}>
      <section className="card card-pad" style={{ width: "100%", maxWidth: 460 }}>
        <p className="t-eyebrow">Owner login</p>
        <h1 className="t-h2" style={{ marginTop: "var(--space-2)" }}>Sign in</h1>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Access your account dashboard and workspace preview.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
