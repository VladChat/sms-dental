type Reason =
  | "not_found"
  | "expired"
  | "completed"
  | "cancelled"
  | "invalid_format"
  | "no_session";

export function SetupInvalid({ reason }: { reason: Reason }) {
  return (
    <section className="card card-pad">
      <h2 className="t-h3">
        {reason === "no_session" ? "Open your account" : "Setup link not available"}
      </h2>
      <p className="t-body" style={{ marginTop: "var(--space-3)" }}>
        {reason === "no_session"
          ? "Please open your setup link from your email to access your account."
          : reason === "completed"
            ? "This setup has already been completed."
            : "This setup link is invalid or expired. Please request a new setup link."}
      </p>
      <p style={{ marginTop: "var(--space-5)" }}>
        <a className="link" href="https://missedcallsdental.com/">
          Request a new setup link →
        </a>
      </p>
    </section>
  );
}
