export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "64px 24px",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Missed Calls Dental</h1>
      <p style={{ color: "#4b5563", marginTop: 0 }}>
        Backend foundation — placeholder. The clinic dashboard will be built
        here in future milestones.
      </p>
      <p style={{ color: "#4b5563" }}>
        The public marketing website is served separately at{" "}
        <a
          href="https://missedcallsdental.com"
          style={{ color: "#1d4ed8" }}
          rel="noreferrer"
        >
          missedcallsdental.com
        </a>
        .
      </p>
    </main>
  );
}
