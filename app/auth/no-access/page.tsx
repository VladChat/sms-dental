import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign-in required - Missed Calls Dental",
  description: "This account does not have an assigned app role yet.",
  robots: { index: false, follow: false },
};

export default function AuthNoAccessPage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--space-6)" }}>
      <section className="card card-pad" style={{ width: "100%", maxWidth: 560 }}>
        <h1 className="t-h3">Account access not configured yet</h1>
        <p className="t-body" style={{ marginTop: "var(--space-3)" }}>
          Your password was updated, but this account does not have an assigned app role yet.
          Use the sign-in path that matches your role, or contact support if you think this is incorrect.
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-5)" }}>
          <a className="btn btn-primary" href="/admin/login">Platform admin sign in</a>
          <a className="btn btn-secondary" href="/login">Clinic sign in</a>
        </div>
      </section>
    </main>
  );
}

