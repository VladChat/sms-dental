import type { Metadata } from "next";
import { ForgotPasswordForm } from "./_components/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset password - Missed Calls Dental",
  description: "Request a password reset link for your Missed Calls Dental account.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--space-6)" }}>
      <section className="card card-pad" style={{ width: "100%", maxWidth: 460 }}>
        <h1 className="t-h2">Reset password</h1>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}

