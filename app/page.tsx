export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: "var(--content)",
        margin: "0 auto",
        padding: "var(--space-16) var(--space-6)",
      }}
    >
      <p className="t-eyebrow" style={{ marginBottom: "var(--space-3)" }}>
        Missed Calls Dental
      </p>
      <h1 className="t-h1" style={{ marginBottom: "var(--space-3)" }}>
        Bring missed callers back to book appointments.
      </h1>
      <p className="t-body-lg" style={{ marginTop: 0 }}>
        This is the application surface for Missed Calls Dental. Office setup opens from the
        secure link we email you.
      </p>
      <p className="t-body">
        The public website is served at{" "}
        <a className="link" href="https://missedcallsdental.com" rel="noreferrer">
          missedcallsdental.com
        </a>
        .
      </p>
    </main>
  );
}
