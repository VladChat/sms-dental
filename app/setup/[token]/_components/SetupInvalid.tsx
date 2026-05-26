type Reason = "not_found" | "expired" | "completed" | "cancelled" | "invalid_format";

export function SetupInvalid({ reason }: { reason: Reason }) {
  return (
    <section
      style={{
        padding: 24,
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20, color: "#111827" }}>
        Setup link not available
      </h2>
      <p style={{ marginTop: 12, color: "#374151" }}>
        {reason === "completed"
          ? "This setup has already been completed."
          : "This setup link is invalid or expired. Please request a new setup link."}
      </p>
      <p style={{ marginTop: 20 }}>
        <a
          href="https://missedcallsdental.com/"
          style={{
            color: "#0d9488",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Request a new setup link →
        </a>
      </p>
    </section>
  );
}
