// Shown when a valid setup link is reopened after the account has already been
// created. No password fields are rendered (so password managers never see a
// new-password form), and there is a single action: sign in.
export function SetupComplete() {
  return (
    <section className="card card-pad">
      <h2 className="t-h3">Account setup is already complete</h2>
      <p className="t-body" style={{ marginTop: "var(--space-3)" }}>
        Sign in to continue to your account.
      </p>
      <p style={{ marginTop: "var(--space-6)" }}>
        <a className="btn btn-primary" href="/login">Sign in</a>
      </p>
    </section>
  );
}
