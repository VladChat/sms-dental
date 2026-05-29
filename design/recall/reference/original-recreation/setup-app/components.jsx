/* Missed Calls Dental — setup app UI kit components (light, utilitarian).
   Visuals lifted from app/setup/[token]/_components/*. */
const { useState } = React;

const S = {
  page:   { maxWidth:720, margin:"0 auto", padding:"48px 24px 80px", lineHeight:1.55, fontFamily:"var(--font)" },
  kicker: { margin:0, color:"#6b7280", fontSize:13, letterSpacing:".14em", textTransform:"uppercase", fontWeight:700 },
  h1:     { margin:"8px 0 0", fontSize:26, color:"#111827", letterSpacing:"-.018em" },
  card:   { padding:24, borderRadius:14, border:"1px solid #e5e7eb", background:"#fff" },
  eyebrow:{ margin:0, color:"#0d9488", fontSize:12, letterSpacing:".14em", textTransform:"uppercase", fontWeight:700 },
  h2:     { margin:"6px 0 8px", fontSize:22, color:"#111827", letterSpacing:"-.018em" },
  helper: { margin:0, color:"#374151" },
  label:  { fontSize:13, fontWeight:600, color:"#111827" },
  input:  { width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #d1d5db", background:"#fff", color:"#111827", font:"inherit", fontSize:15 },
  helperLine:{ margin:0, color:"#6b7280", fontSize:12 },
  primary:{ display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"12px 20px", borderRadius:999, border:"1px solid transparent", background:"#0d9488", color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" },
  secondary:{ display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"10px 16px", borderRadius:999, border:"1px solid #d1d5db", background:"#fff", color:"#111827", fontWeight:600, fontSize:14, cursor:"pointer", height:44 },
  use:    { display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"10px 16px", borderRadius:999, border:"1px solid transparent", background:"#0d9488", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", whiteSpace:"nowrap" },
  footnote:{ margin:"14px 0 0", color:"#6b7280", fontSize:12 },
  alert:  { margin:"12px 0", padding:"10px 12px", borderRadius:10, background:"#fef2f2", border:"1px solid #fecaca", color:"#991b1b", fontSize:14 },
  tabs:   { display:"inline-flex", marginTop:16, padding:4, borderRadius:999, background:"#f1f5f9", border:"1px solid #e2e8f0", gap:4 },
  tab:    { appearance:"none", padding:"8px 14px", borderRadius:999, border:"1px solid transparent", background:"transparent", color:"#475569", fontWeight:600, fontSize:14, cursor:"pointer" },
  tabActive:{ background:"#fff", border:"1px solid #cbd5e1", color:"#0f172a", boxShadow:"0 1px 2px rgba(15,23,42,.08)" },
};

/* ---------- Page shell ---------- */
function PageShell({ step, children }) {
  return (
    <main style={S.page}>
      <header style={{ marginBottom: 20 }}>
        <p style={S.kicker}>Missed Calls Dental</p>
        <h1 style={S.h1}>Office setup</h1>
      </header>
      <Stepper step={step} />
      {children}
    </main>
  );
}

/* ---------- Stepper ---------- */
function Stepper({ step }) {
  const items = ["Office profile", "Texting number", "Ready"];
  return (
    <div style={{ display:"flex", gap:8, alignItems:"center", margin:"0 0 22px", flexWrap:"wrap" }}>
      {items.map((label, i) => {
        const n = i + 1, active = n === step, done = n < step;
        return (
          <React.Fragment key={label}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ width:24, height:24, borderRadius:999, display:"inline-flex", alignItems:"center",
                justifyContent:"center", fontSize:12, fontWeight:700,
                background: done?"#0d9488":active?"#ccfbf1":"#f1f5f9",
                color: done?"#fff":active?"#0d9488":"#94a3b8",
                border:"1px solid "+(done||active?"#99f6e4":"#e2e8f0") }}>
                {done ? "✓" : n}
              </span>
              <span style={{ fontSize:13, fontWeight:600, color: active||done?"#111827":"#94a3b8" }}>{label}</span>
            </div>
            {i < items.length-1 && <span style={{ flex:"0 0 22px", height:1, background:"#e2e8f0" }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---------- Reusable field ---------- */
function Field({ label, name, placeholder, helper, value, onChange, inputMode }) {
  return (
    <div style={{ display:"grid", gap:6, marginBottom:18 }}>
      <label htmlFor={name} style={S.label}>{label}</label>
      <input id={name} name={name} placeholder={placeholder} value={value}
             inputMode={inputMode} onChange={onChange} spellCheck="false" style={S.input} />
      {helper && <p style={S.helperLine}>{helper}</p>}
    </div>
  );
}

/* ---------- Step 1: Clinic form ---------- */
function ClinicForm({ onDone }) {
  const [v, setV] = useState({ name:"", main_phone:"", postal_code:"" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const set = k => e => setV(s => ({ ...s, [k]: e.target.value }));
  function submit(e){
    e.preventDefault();
    if(!v.name || !v.main_phone || !v.postal_code){ setError("Could not save clinic details. Please check your entries."); return; }
    setError(null); setSubmitting(true);
    setTimeout(()=>{ setSubmitting(false); onDone(v); }, 600);
  }
  return (
    <section style={S.card}>
      <h2 style={S.h2}>Create office profile</h2>
      <p style={S.helper}>Three quick details to get your office set up. Your main office number stays the same.</p>
      <form onSubmit={submit} style={{ marginTop:20 }} noValidate>
        <Field label="Clinic name" name="name" placeholder="Bright Smile Dental"
               helper="Enter the public name patients know your office by." value={v.name} onChange={set("name")} />
        <Field label="Main office phone" name="main_phone" placeholder="(224) 555-1234" inputMode="tel"
               helper="Enter the phone number patients currently call." value={v.main_phone} onChange={set("main_phone")} />
        <Field label="ZIP code" name="postal_code" placeholder="60010" inputMode="numeric"
               helper="We’ll use this ZIP code to prepare a local number for your office." value={v.postal_code} onChange={set("postal_code")} />
        {error && <p style={S.alert} role="alert">{error}</p>}
        <button type="submit" disabled={submitting} style={S.primary}>{submitting ? "Creating…" : "Create office profile"}</button>
        <p style={S.footnote}>Automated setup is currently available for U.S. clinics only.</p>
      </form>
    </section>
  );
}

/* ---------- Step 2: Number search ---------- */
const SAMPLE = {
  local: [
    { phone:"(224) 555-0148", loc:"Crystal Lake, IL", type:"Local", rec:true },
    { phone:"(224) 555-0192", loc:"Algonquin, IL", type:"Local", rec:false },
    { phone:"(224) 555-0237", loc:"Lake in the Hills, IL", type:"Local", rec:false },
  ],
  toll_free: [
    { phone:"(833) 555-0110", loc:"Toll-free · United States", type:"Toll-free", rec:true },
    { phone:"(844) 555-0188", loc:"Toll-free · United States", type:"Toll-free", rec:false },
  ],
};
function TypeBadge({ type }) {
  const tf = type === "Toll-free";
  return <span style={{ fontSize:11, letterSpacing:".08em", textTransform:"uppercase", fontWeight:700,
    color: tf?"#1e3a8a":"#334155", background: tf?"#dbeafe":"#f1f5f9",
    border:"1px solid "+(tf?"#bfdbfe":"#e2e8f0"), padding:"2px 8px", borderRadius:999 }}>{type}</span>;
}
function NumberSearch({ clinic, onDone }) {
  const [tab, setTab] = useState("local");
  const [areaCode, setAreaCode] = useState("224");
  const [purchasing, setPurchasing] = useState(null);
  const list = SAMPLE[tab];
  function buy(n){
    setPurchasing(n);
    setTimeout(()=>{ setPurchasing(null); onDone(n); }, 700);
  }
  return (
    <section style={S.card}>
      <p style={S.eyebrow}>Step 2 of 2 · {clinic?.name || "Bright Smile Dental"}</p>
      <h2 style={S.h2}>Choose your office texting number</h2>
      <p style={{ ...S.helper, color:"#374151" }}>This is an additional number for missed-call text follow-ups. It will not replace your existing office phone number.</p>

      <div role="tablist" style={S.tabs}>
        <button role="tab" onClick={()=>setTab("local")} style={{...S.tab, ...(tab==="local"?S.tabActive:{})}}>Local number</button>
        <button role="tab" onClick={()=>setTab("toll_free")} style={{...S.tab, ...(tab==="toll_free"?S.tabActive:{})}}>Toll-free number</button>
      </div>

      {tab === "local" ? (
        <React.Fragment>
          <p style={{ margin:"10px 0 0", color:"#475569", fontSize:14 }}>Looks local to patients near your office.</p>
          <div style={{ marginTop:12, display:"flex", gap:8, alignItems:"end", flexWrap:"wrap" }}>
            <div style={{ display:"grid", gap:6, flex:1, maxWidth:260 }}>
              <label style={S.label}>Area code (United States)</label>
              <input value={areaCode} onChange={e=>setAreaCode(e.target.value.replace(/\D/g,"").slice(0,3))}
                     placeholder="224" inputMode="numeric" style={S.input} />
            </div>
            <button style={S.secondary}>Search</button>
          </div>
          <p style={{ marginTop:8, color:"#6b7280", fontSize:13 }}>Showing local United States numbers for area code {areaCode}.</p>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <p style={{ margin:"10px 0 0", color:"#475569", fontSize:14 }}>Business-style number. SMS use may require toll-free verification before live patient messaging.</p>
          <p style={{ marginTop:10, padding:"10px 12px", borderRadius:10, background:"#f1f5f9", border:"1px solid #cbd5e1", color:"#0f172a", fontSize:13 }}>
            Voice works immediately once assigned. SMS on toll-free numbers requires Twilio toll-free verification before live patient messaging. We’ll cover this step with you before go-live.
          </p>
        </React.Fragment>
      )}

      <div style={{ display:"grid", gap:10, marginTop:16 }}>
        {list.map(n => (
          <article key={n.phone} style={{ padding:14, border:"1px solid #e5e7eb", borderRadius:12, background:"#f9fafb",
            display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            <div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <strong style={{ fontSize:17, color:"#111827" }}>{n.phone}</strong>
                <TypeBadge type={n.type} />
                {n.rec && <span style={{ fontSize:11, letterSpacing:".1em", textTransform:"uppercase", fontWeight:700,
                  color:"#0d9488", background:"#ccfbf1", border:"1px solid #99f6e4", padding:"2px 8px", borderRadius:999 }}>Recommended</span>}
              </div>
              <div style={{ marginTop:4, color:"#4b5563", fontSize:13 }}>{n.loc}</div>
            </div>
            <button onClick={()=>buy(n.phone)} disabled={purchasing!==null} style={S.use}>
              {purchasing===n.phone ? "Assigning…" : "Use this number"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- Step 3: Ready status ---------- */
function InfoBlock({ title, children }) {
  return (
    <div style={{ marginTop:16, padding:14, borderRadius:12, background:"#fff", border:"1px solid #e5e7eb" }}>
      <h3 style={{ margin:0, fontSize:15, color:"#111827" }}>{title}</h3>
      {children}
    </div>
  );
}
function SetupStatusReady({ clinic, number }) {
  const mainPhone = clinic?.main_phone || "(224) 555-1234";
  return (
    <section style={{ padding:24, borderRadius:14, border:"1px solid #99f6e4", background:"#f0fdfa" }}>
      <p style={S.eyebrow}>{clinic?.name || "Bright Smile Dental"}</p>
      <h2 style={S.h2}>Your office texting number is ready</h2>
      <p style={{ margin:"0 0 12px", color:"#0f766e", fontSize:18, fontWeight:600 }}>{number || "(224) 555-0148"}</p>
      <p style={{ color:"#374151", margin:"12px 0" }}>Use this number for missed-call forwarding or tracking. Your existing office phone number does not change.</p>
      <InfoBlock title="SMS recovery status">
        <p style={{ margin:"6px 0 0", color:"#4b5563", fontSize:14 }}>Off by default. Live SMS stays disabled until compliance approval, QA passes, and owner approval. We’ll guide you through QA before go-live.</p>
      </InfoBlock>
      <InfoBlock title="Forwarding instructions">
        <p style={{ margin:"6px 0 0", color:"#374151", fontSize:14 }}>Your existing office phone number does not change. To recover missed calls, forward unanswered or busy calls from your main office number ({mainPhone}) to your office texting number ({number || "(224) 555-0148"}).</p>
      </InfoBlock>
      <InfoBlock title="QA checklist">
        <ol style={{ margin:"8px 0 0", paddingLeft:18, color:"#374151", fontSize:14 }}>
          <li>Configure no-answer and busy forwarding from the main office phone to the texting number.</li>
          <li>Make a test call.</li>
          <li>Confirm caller ID is preserved.</li>
          <li>Confirm the call is recorded.</li>
          <li>Complete SMS QA before go-live.</li>
        </ol>
      </InfoBlock>
    </section>
  );
}

Object.assign(window, { PageShell, Stepper, ClinicForm, NumberSearch, SetupStatusReady });
