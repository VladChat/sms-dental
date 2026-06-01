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

// Public marketing site origin. The app login page mirrors the marketing
// sign-in design while keeping the real authentication logic here.
const SITE = "https://missedcallsdental.com";

export default async function LoginPage() {
  const access = await resolveAuthClinicAccess();
  if (access.ok) {
    redirect(routeForRole(access.membership.role));
  }

  const year = new Date().getFullYear();

  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <div className="auth-topbar-inner">
          <a className="auth-brand" href={SITE} aria-label="Missed Calls Dental home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.webp" alt="" width={32} height={32} />
            <span className="auth-brand-name">Missed Calls Dental</span>
          </a>
          <nav className="auth-nav" aria-label="Site">
            <a className="auth-nav-link" href={`${SITE}/#how-it-works`}>How it works</a>
            <a className="auth-nav-link" href={`${SITE}/#pricing`}>Pricing</a>
            <a className="auth-nav-cta" href={`${SITE}/#start-trial`}>Start trial</a>
          </nav>
        </div>
      </header>

      <main className="auth-main">
        <section className="card auth-card">
          <h1 className="t-h2">Sign in</h1>
          <p className="t-small auth-card-sub">Welcome back. Sign in to your office account.</p>
          <LoginForm />
          <p className="auth-card-foot t-small">
            Need an account? <a className="link" href={`${SITE}/#start-trial`}>Start trial</a>
          </p>
        </section>
      </main>

      <footer className="auth-footer">
        <div className="auth-footer-inner">
          <span className="t-helper">© {year} Missed Calls Dental</span>
          <nav className="auth-footer-nav" aria-label="Legal">
            <a href={`${SITE}/privacy.html`}>Privacy Policy</a>
            <a href={`${SITE}/terms.html`}>Terms of Service</a>
            <a href={`${SITE}/sms-consent.html`}>SMS Terms</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
