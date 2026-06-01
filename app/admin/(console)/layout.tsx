import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolvePlatformAdmin } from "../../../lib/auth/platform-admin";
import { AdminSignOut } from "./_components/AdminSignOut";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Platform admin — Missed Calls Dental",
  robots: { index: false, follow: false },
};

// Guarded layout for the platform admin console. `/admin/login` lives OUTSIDE
// this route group, so it is not guarded here (no redirect loop). Unauthenticated
// visitors go to the login page; authenticated-but-unauthorized users get a clean
// denial (not a loop back to login).
export default async function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await resolvePlatformAdmin();
  if (!admin.ok) {
    if (admin.reason === "no_session") {
      redirect("/admin/login");
    }
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--space-6)" }}>
        <section className="card card-pad" style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 className="t-h3">Access denied</h1>
          <p className="t-body" style={{ marginTop: "var(--space-3)" }}>
            This account is not authorized for platform admin access.
          </p>
          <p style={{ marginTop: "var(--space-5)" }}>
            <a className="link" href="/admin/login">Use a different account →</a>
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <div className="adm-brand">Missed Calls Dental · Admin</div>
        <nav className="adm-nav" aria-label="Admin sections">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/clinics">Clinics</Link>
          <Link href="/admin/audit">Audit</Link>
        </nav>
        <div className="adm-topbar-right">
          <span className="t-helper adm-who">{admin.email}</span>
          <AdminSignOut />
        </div>
      </header>
      <main className="adm-main">{children}</main>
    </div>
  );
}
