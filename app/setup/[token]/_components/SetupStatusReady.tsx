type Props = {
  clinicName: string;
  mainPhone: string | null;
  officeTextingNumber: string | null;
};

export function SetupStatusReady({
  clinicName,
  mainPhone,
  officeTextingNumber,
}: Props) {
  return (
    <section className="card card-pad">
      <p className="t-eyebrow">{clinicName}</p>
      <h2 className="t-h3" style={{ marginTop: "var(--space-2)" }}>
        Your office texting number is ready
      </h2>
      <p className="t-mono" style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--primary)", margin: "var(--space-2) 0 var(--space-4)" }}>
        {officeTextingNumber ?? "Pending"}
      </p>

      <p className="t-body">
        Use this number for missed-call forwarding or tracking. Your existing office phone
        number does not change.
      </p>

      <div className="card card-pad" style={{ marginTop: "var(--space-4)", boxShadow: "none", background: "var(--surface-2)" }}>
        <h3 className="t-h4">SMS recovery status</h3>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Off by default. Texting stays off until approval completes — you’re not billed during
          this step. We’ll guide you through the checks before go-live.
        </p>
      </div>

      <div className="card card-pad" style={{ marginTop: "var(--space-4)", boxShadow: "none" }}>
        <h3 className="t-h4">Forwarding instructions</h3>
        <p className="t-small" style={{ marginTop: "var(--space-2)" }}>
          Your existing office phone number stays exactly the same. To recover missed calls,
          forward unanswered or busy calls from your main office number
          {mainPhone ? ` (${mainPhone})` : ""} to your office texting number
          {officeTextingNumber ? ` (${officeTextingNumber})` : ""}.
        </p>
      </div>

      <div className="card card-pad" style={{ marginTop: "var(--space-4)", boxShadow: "none" }}>
        <h3 className="t-h4">What to check</h3>
        <ol className="t-small" style={{ margin: "var(--space-2) 0 0", paddingLeft: "var(--space-5)", display: "grid", gap: "var(--space-1)" }}>
          <li>Forward no-answer and busy calls from your main office number to the texting number.</li>
          <li>Make a test call.</li>
          <li>Confirm caller ID is preserved.</li>
          <li>Confirm the call is recorded.</li>
        </ol>
      </div>
    </section>
  );
}
