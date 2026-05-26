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
    <section
      style={{
        padding: 24,
        borderRadius: 14,
        border: "1px solid #99f6e4",
        background: "#f0fdfa",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#0d9488",
          fontSize: 12,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {clinicName}
      </p>
      <h2
        style={{
          margin: "6px 0 8px",
          fontSize: 22,
          color: "#111827",
          letterSpacing: "-.018em",
        }}
      >
        Your office texting number is ready
      </h2>
      <p style={{ margin: "0 0 12px", color: "#0f766e", fontSize: 18, fontWeight: 600 }}>
        {officeTextingNumber ?? "Pending"}
      </p>

      <p style={{ color: "#374151", margin: "12px 0" }}>
        Use this number for missed-call forwarding or tracking. Your existing office phone
        number does not change.
      </p>

      <div
        style={{
          marginTop: 12,
          padding: 14,
          borderRadius: 12,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, color: "#111827" }}>
          SMS recovery status
        </h3>
        <p style={{ margin: "6px 0 0", color: "#4b5563", fontSize: 14 }}>
          Off by default. Live SMS stays disabled until compliance approval, QA passes, and
          owner approval. We&rsquo;ll guide you through QA before go-live.
        </p>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, color: "#111827" }}>
          Forwarding instructions
        </h3>
        <p style={{ margin: "6px 0 0", color: "#374151", fontSize: 14 }}>
          Your existing office phone number does not change. To recover missed calls, forward
          unanswered or busy calls from your main office number
          {mainPhone ? ` (${mainPhone})` : ""} to your office texting number
          {officeTextingNumber ? ` (${officeTextingNumber})` : ""}.
        </p>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, color: "#111827" }}>QA checklist</h3>
        <ol style={{ margin: "8px 0 0", paddingLeft: 18, color: "#374151", fontSize: 14 }}>
          <li>Configure no-answer and busy forwarding from the main office phone number to the office texting number.</li>
          <li>Make a test call.</li>
          <li>Confirm caller ID is preserved.</li>
          <li>Confirm the call is recorded.</li>
          <li>Complete SMS QA before go-live.</li>
        </ol>
      </div>
    </section>
  );
}
