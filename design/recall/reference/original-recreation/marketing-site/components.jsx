/* Missed Calls Dental — marketing site UI kit components */
const { useState } = React;

/* ---------- Icons (inline, matches MarketingIcons spec) ---------- */
function SunIcon(){return(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>);}
function MoonIcon(){return(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"/></svg>);}
function ClipboardIcon(){return(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3.5" width="14" height="17" rx="2.2"/><path d="M9 3.5h6v3H9z"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="14.5" x2="15" y2="14.5"/><line x1="9" y1="18" x2="13" y2="18"/></svg>);}

/* ---------- Header ---------- */
function Header({ theme, onToggleTheme, onNav, current }) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="brand" onClick={() => onNav("home")} style={{cursor:"pointer"}}>
          <img src="../../assets/logo-mark.webp" alt="" width="40" height="40" />
          <span className="brand-text">
            <span className="brand-name">Missed Calls Dental</span>
            <span className="brand-tag">SMS recovery for missed patient calls</span>
          </span>
        </a>
        <div className="header-end">
          <button className="theme-toggle" type="button" onClick={onToggleTheme}
                  aria-label="Switch theme" title="Switch theme">
            {theme === "dark" ? <SunIcon/> : <MoonIcon/>}
          </button>
          <nav className="site-nav" aria-label="Main navigation">
            <a className="nav-link" onClick={() => onNav("home", "how-it-works")}>How it works</a>
            <a className="nav-link" onClick={() => onNav("home", "start-trial")}>Pricing</a>
            <div className="auth-group">
              <a className={"auth-link" + (current==="signin"?" ":"")} onClick={() => onNav("signin")}>Sign in</a>
              <a className="auth-link auth-link--primary" onClick={() => onNav("home", "start-trial")}>Start trial</a>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section className="section">
      <div className="container hero">
        <h1>Bring missed callers back to book appointments.</h1>
        <p>Text missed callers right away, collect key details, and help your front desk keep new and existing patients from slipping away.</p>
        <figure className="workflow">
          <img className="workflow-image" src="../../assets/hero-workflow-visual.webp"
               alt="Workflow: a missed call is detected, the recovery system sends an SMS, the patient replies, and the front desk schedules the appointment." />
        </figure>
      </div>
    </section>
  );
}

/* ---------- How it works ---------- */
function HowItWorks() {
  const thread = [
    ["clinic","Clinic","Hi, this is Bright Smile Dental. Sorry we missed your call. How can we help? Reply STOP to opt out."],
    ["patient","Patient","Hi, I’d like to schedule a cleaning."],
    ["clinic","Clinic","Sure — can I have your name, and what day or time usually works best for you?"],
    ["patient","Patient","John Doe. Tuesday morning if possible."],
    ["clinic","Clinic","Thanks, John. Our front desk will follow up to help schedule your cleaning."],
  ];
  const fields = [["Name","John Doe"],["Phone","555-0123-1234"],["Request","Schedule cleaning"],["Preferred time","Tuesday morning"]];
  return (
    <section className="section" id="how-it-works">
      <div className="container">
        <div className="section-head">
          <h2>How it works</h2>
          <p>A simple flow from missed call to front-desk-ready patient details.</p>
        </div>
        <ol className="steps">
          <li>Missed call detected.</li>
          <li>Key details collected.</li>
          <li>Front desk gets info to follow up.</li>
        </ol>
        <div className="recovery-grid">
          <article className="recovery-card">
            <header>
              <p className="recovery-eyebrow">Example recovery conversation</p>
              <h3>A missed caller, brought back by SMS</h3>
            </header>
            <p className="recovery-intro">This is an example of how a missed caller can be brought back into the conversation by SMS.</p>
            <div className="thread">
              {thread.map(([who,label,text],i)=>(
                <div className={"bubble "+who} key={i}><small>{label}</small>{text}</div>
              ))}
            </div>
          </article>
          <article className="recovery-card patient-card">
            <header className="patient-card__head">
              <span className="patient-card__icon"><ClipboardIcon/></span>
              <div className="patient-card__heading">
                <p className="recovery-eyebrow">Front-desk summary</p>
                <h3>Patient request</h3>
              </div>
            </header>
            <dl className="patient-fields">
              {fields.map(([k,v])=>(
                <div className="patient-field" key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
              <div className="patient-field"><dt>Priority</dt><dd><span className="badge badge--routine">Routine</span></dd></div>
            </dl>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ---------- Pricing ---------- */
function Pricing({ onSubmit }) {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  function submit(e){
    e.preventDefault();
    if(!email.trim()){ setErr("Please enter your work email."); return; }
    setErr(""); setSending(true);
    setTimeout(()=>{ setSending(false); onSubmit(email); }, 700);
  }
  return (
    <section className="section" id="start-trial">
      <div className="container">
        <div className="section-head"><h2>Pricing</h2></div>
        <article className="conversion-card">
          <div className="conversion-row conversion-row--plan">
            <div className="price-headline">
              <span className="trial-badge">14-day <strong>FREE</strong> trial</span>
              <span className="price-lockup"><span className="price-amount">$99</span><span className="price-period">/month</span></span>
            </div>
            <p className="includes-label">Includes</p>
            <ul className="includes">
              <li>Automatic SMS system</li>
              <li>Virtual phone number</li>
              <li>Front-desk notification</li>
            </ul>
          </div>
          <div className="conversion-row conversion-row--form">
            <div className="conversion-form-head">
              <h3>Set up your account in minutes.</h3>
              <p>Enter your work email to get your setup link.</p>
            </div>
            <form className="form" onSubmit={submit} noValidate>
              <div className="field">
                <label htmlFor="work-email">Work email</label>
                <input id="work-email" type="email" placeholder="you@youroffice.com"
                       value={email} onChange={e=>{setEmail(e.target.value);setErr("");}} spellCheck="false" />
              </div>
              {err && <div className="form-error">{err}</div>}
              <button type="submit" className="btn btn-primary" disabled={sending}>
                {sending ? "Sending…" : "Send setup link"}
              </button>
            </form>
            <p className="form-foot">Already have an account? <a onClick={()=>onSubmit(null,"signin")}>Sign in</a></p>
          </div>
        </article>
      </div>
    </section>
  );
}

/* ---------- Sign in ---------- */
function SignIn({ onBack }) {
  const [err, setErr] = useState(false);
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <h1>Sign in</h1>
          <p>Welcome back. Sign in to your office account.</p>
        </div>
        <div className="form-shell">
          <form className="form" onSubmit={e=>{e.preventDefault();setErr(true);}} noValidate>
            <div className="field"><label htmlFor="email">Email</label>
              <input id="email" type="email" placeholder="you@youroffice.com" spellCheck="false" /></div>
            <div className="field"><label htmlFor="password">Password</label>
              <input id="password" type="password" placeholder="Your password" /></div>
            {err && <div className="form-error">Incorrect email or password. Please try again.</div>}
            <button type="submit" className="btn btn-primary">Sign in</button>
          </form>
          <p className="form-foot">Need an account? <a onClick={onBack}>Start trial</a></p>
        </div>
      </div>
    </section>
  );
}

/* ---------- Confirm ---------- */
function Confirm({ email, onBack }) {
  return (
    <section className="section">
      <div className="container" style={{textAlign:"center",maxWidth:520,margin:"0 auto"}}>
        <div className="form-shell" style={{textAlign:"center",justifyItems:"center"}}>
          <span className="patient-card__icon" style={{width:"3.2rem",height:"3.2rem",borderRadius:"999px"}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:"1.5rem",height:"1.5rem"}}><path d="M5 12.5l4 4 10-10"/></svg>
          </span>
          <h2>Check your inbox</h2>
          <p style={{color:"var(--muted-2)"}}>We sent a setup link{email?<> to <strong style={{color:"var(--text)"}}>{email}</strong></>:""}. Open it to finish setting up your office in minutes.</p>
          <button className="btn btn-ghost" onClick={onBack}>Back to home</button>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <span className="footer-copy">© {new Date().getFullYear()} Missed Calls Dental</span>
        <nav className="footer-nav" aria-label="Legal navigation">
          <a>Privacy Policy</a><a>Terms of Service</a><a>SMS Terms</a>
        </nav>
      </div>
    </footer>
  );
}

Object.assign(window, { Header, Hero, HowItWorks, Pricing, SignIn, Confirm, Footer });
