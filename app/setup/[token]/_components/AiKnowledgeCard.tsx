"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Field, SelectField } from "./AccountUI";
import type { BusinessProfileFields } from "./account-types";
// Type-only import: erased at compile time, so no server/DB code is bundled.
import type { AiFactsView } from "../../../../lib/db/ai-knowledge";
import {
  DEFAULT_PREFERRED_TIME_QUESTION,
  HOURS_TIMEZONES,
  MAX_CUSTOM_LABEL_LENGTH,
  MAX_INSURANCE_PLANS_PER_CLINIC,
  MAX_POLICY_TEXT_LENGTH,
  MAX_PREFERRED_TIME_QUESTION_LENGTH,
  MAX_PRICING_POLICY_LENGTH,
  MAX_SERVICES_PER_CLINIC,
} from "../../../../config/ai-front-desk-facts.config";

// AI Front Desk Knowledge — structured clinic facts the owner reviews and
// approves. Facts-first accordion UI: website loader on top, then business
// profile facts, hours, appointments, insurance, services, payment, policies.
// Address/website stay owned by Business profile; this card only reads them.
// Owner-facing copy stays short and plain — no technical wording.

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // show Monday first

type HoursDayState = { weekday: number; closed: boolean; opensAt: string; closesAt: string };
type CatalogItemState = {
  key: string;
  label: string;
  selected: boolean;
  isCustom: boolean;
  suggested: boolean;
  // Added locally and not saved yet (persists on Save, not before).
  pending?: boolean;
};

type SaveState = { saving: boolean; error: string | null; saved: boolean };
const IDLE_SAVE: SaveState = { saving: false, error: null, saved: false };

type LoadState = "loading" | "signin_required" | "error" | "ready";

// Outcome of the latest "Load website information" click. `loaded` is false
// for both "nothing useful found" and "site unreachable" — the owner sees one
// neutral message either way.
type ScanResultState = { loaded: boolean; reviewNotes: string | null } | null;

export function AiKnowledgeCard({
  businessProfile,
  onGoToBusinessProfile,
}: {
  businessProfile: BusinessProfileFields;
  onGoToBusinessProfile: () => void;
}) {
  const [load, setLoad] = useState<LoadState>("loading");

  const [timezone, setTimezone] = useState<string>("America/Chicago");
  const [hoursDays, setHoursDays] = useState<HoursDayState[]>([]);
  const [hoursSuggested, setHoursSuggested] = useState(false);
  const [hoursPersisted, setHoursPersisted] = useState(false);

  const [services, setServices] = useState<CatalogItemState[]>([]);
  const [insurance, setInsurance] = useState<CatalogItemState[]>([]);
  const [removedServiceKeys, setRemovedServiceKeys] = useState<string[]>([]);
  const [removedInsuranceKeys, setRemovedInsuranceKeys] = useState<string[]>([]);
  const [newServiceLabel, setNewServiceLabel] = useState("");
  const [newInsuranceLabel, setNewInsuranceLabel] = useState("");

  const [appointments, setAppointments] = useState({
    acceptingNewPatients: false,
    cleaningAppointments: false,
    sameDayAppointments: false,
    emergencyAppointments: false,
    rescheduleCancelRequests: false,
    preferredTimeQuestion: DEFAULT_PREFERRED_TIME_QUESTION,
    suggested: false,
  });

  const [payment, setPayment] = useState({
    paymentPlans: false,
    financing: false,
    carecredit: false,
    membershipPlan: false,
    pricingPolicy: "",
    suggested: false,
  });

  const [policies, setPolicies] = useState({
    newPatientForms: "",
    whatToBring: "",
    cancellationPolicy: "",
    languagesText: "",
    parkingNotes: "",
    accessibilityNotes: "",
    suggested: false,
  });

  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResultState>(null);

  function saveState(section: string): SaveState {
    return saveStates[section] ?? IDLE_SAVE;
  }
  function setSave(section: string, state: SaveState) {
    setSaveStates((prev) => ({ ...prev, [section]: state }));
  }

  function applyFacts(facts: AiFactsView) {
    setTimezone(facts.hours.timezone);
    setHoursDays(
      facts.hours.days.map((day) => ({
        weekday: day.weekday,
        closed: day.closed,
        opensAt: day.opensAt ?? "",
        closesAt: day.closesAt ?? "",
      })),
    );
    setHoursSuggested(facts.hours.suggested);
    setHoursPersisted(facts.hours.persisted);
    setServices(facts.services);
    setInsurance(facts.insurancePlans);
    setRemovedServiceKeys([]);
    setRemovedInsuranceKeys([]);
    setAppointments({
      acceptingNewPatients: facts.appointments.acceptingNewPatients ?? false,
      cleaningAppointments: facts.appointments.cleaningAppointments ?? false,
      sameDayAppointments: facts.appointments.sameDayAppointments ?? false,
      emergencyAppointments: facts.appointments.emergencyAppointments ?? false,
      rescheduleCancelRequests: facts.appointments.rescheduleCancelRequests ?? false,
      preferredTimeQuestion: facts.appointments.preferredTimeQuestion,
      suggested: facts.appointments.suggested,
    });
    setPayment({
      paymentPlans: facts.payment.paymentPlans ?? false,
      financing: facts.payment.financing ?? false,
      carecredit: facts.payment.carecredit ?? false,
      membershipPlan: facts.payment.membershipPlan ?? false,
      pricingPolicy: facts.payment.pricingPolicy ?? "",
      suggested: facts.payment.suggested,
    });
    setPolicies({
      newPatientForms: facts.policies.newPatientForms ?? "",
      whatToBring: facts.policies.whatToBring ?? "",
      cancellationPolicy: facts.policies.cancellationPolicy ?? "",
      languagesText: facts.policies.languages.join(", "),
      parkingNotes: facts.policies.parkingNotes ?? "",
      accessibilityNotes: facts.policies.accessibilityNotes ?? "",
      suggested: facts.policies.suggested,
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/account/ai-knowledge", { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setLoad("signin_required");
          return;
        }
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; facts?: AiFactsView }
          | null;
        if (cancelled) return;
        if (!res.ok || !json?.ok || !json.facts) {
          setLoad("error");
          return;
        }
        applyFacts(json.facts);
        setLoad("ready");
      } catch {
        if (!cancelled) setLoad("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function postSection(
    section: string,
    path: string,
    body: unknown,
  ): Promise<AiFactsView | null> {
    setSave(section, { saving: true, error: null, saved: false });
    try {
      const res = await fetch(`/api/account/ai-knowledge/${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; facts?: AiFactsView; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok || !json.facts) {
        setSave(section, {
          saving: false,
          error: json?.error?.message ?? "Could not save. Please try again.",
          saved: false,
        });
        return null;
      }
      setSave(section, { saving: false, error: null, saved: true });
      return json.facts;
    } catch {
      setSave(section, { saving: false, error: "Could not save. Please try again.", saved: false });
      return null;
    }
  }

  // ------------------------------------------------------------ section saves

  async function saveHours() {
    for (const day of hoursDays) {
      if (!day.closed && (!day.opensAt || !day.closesAt)) {
        setSave("hours", {
          saving: false,
          error: "Add open and close times, or mark the day closed.",
          saved: false,
        });
        return;
      }
    }
    const facts = await postSection("hours", "hours", {
      timezone,
      days: hoursDays.map((day) =>
        day.closed
          ? { weekday: day.weekday, closed: true, intervals: [] }
          : {
              weekday: day.weekday,
              closed: false,
              intervals: [{ opensAt: day.opensAt, closesAt: day.closesAt }],
            },
      ),
    });
    if (facts) {
      setHoursSuggested(facts.hours.suggested);
      setHoursPersisted(facts.hours.persisted);
    }
  }

  // One Save persists the whole list: checked/unchecked entries, newly added
  // custom items, and removed custom items.
  async function saveCatalogSection(section: "services" | "insurance") {
    const items = section === "services" ? services : insurance;
    const removed = section === "services" ? removedServiceKeys : removedInsuranceKeys;
    const facts = await postSection(section, section, {
      selections: items
        .filter((item) => !item.pending)
        .map((item) => ({ key: item.key, selected: item.selected })),
      customToAdd: items
        .filter((item) => item.pending)
        .map((item) => ({ label: item.label, selected: item.selected })),
      customToRemove: removed,
    });
    if (facts) {
      if (section === "services") {
        setServices(facts.services);
        setRemovedServiceKeys([]);
      } else {
        setInsurance(facts.insurancePlans);
        setRemovedInsuranceKeys([]);
      }
    }
  }

  // Adding only updates the visible list; nothing is stored until Save.
  function addCustomLocally(section: "services" | "insurance") {
    const [label, items, max] =
      section === "services"
        ? [newServiceLabel.trim().replace(/\s+/g, " "), services, MAX_SERVICES_PER_CLINIC]
        : [newInsuranceLabel.trim().replace(/\s+/g, " "), insurance, MAX_INSURANCE_PLANS_PER_CLINIC];
    if (label.length === 0) return;
    if (items.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
      setSave(section, { saving: false, error: `“${label}” is already in the list.`, saved: false });
      return;
    }
    if (items.length >= max) {
      setSave(section, {
        saving: false,
        error: `You can list up to ${max} ${section === "services" ? "services" : "insurance plans"}.`,
        saved: false,
      });
      return;
    }
    const newItem: CatalogItemState = {
      key: `pending:${label.toLowerCase()}`,
      label,
      selected: true,
      isCustom: true,
      suggested: false,
      pending: true,
    };
    if (section === "services") {
      setServices((prev) => [...prev, newItem]);
      setNewServiceLabel("");
    } else {
      setInsurance((prev) => [...prev, newItem]);
      setNewInsuranceLabel("");
    }
    setSave(section, IDLE_SAVE);
  }

  // Remove is for custom items only. Pending items vanish locally; existing
  // custom items are deleted when the owner clicks Save.
  function removeCustomLocally(section: "services" | "insurance", item: CatalogItemState) {
    if (!item.isCustom) return;
    if (section === "services") {
      setServices((prev) => prev.filter((s) => s.key !== item.key));
      if (!item.pending) setRemovedServiceKeys((prev) => [...prev, item.key]);
    } else {
      setInsurance((prev) => prev.filter((p) => p.key !== item.key));
      if (!item.pending) setRemovedInsuranceKeys((prev) => [...prev, item.key]);
    }
    setSave(section, IDLE_SAVE);
  }

  async function saveAppointments() {
    const facts = await postSection("appointments", "appointments", {
      acceptingNewPatients: appointments.acceptingNewPatients,
      cleaningAppointments: appointments.cleaningAppointments,
      sameDayAppointments: appointments.sameDayAppointments,
      emergencyAppointments: appointments.emergencyAppointments,
      rescheduleCancelRequests: appointments.rescheduleCancelRequests,
      preferredTimeQuestion: appointments.preferredTimeQuestion,
    });
    if (facts) setAppointments((prev) => ({ ...prev, suggested: facts.appointments.suggested }));
  }

  async function savePayment() {
    const facts = await postSection("payment", "payment", {
      paymentPlans: payment.paymentPlans,
      financing: payment.financing,
      carecredit: payment.carecredit,
      membershipPlan: payment.membershipPlan,
      pricingPolicy: payment.pricingPolicy,
    });
    if (facts) setPayment((prev) => ({ ...prev, suggested: facts.payment.suggested }));
  }

  async function savePolicies() {
    const facts = await postSection("policies", "policies", {
      newPatientForms: policies.newPatientForms,
      whatToBring: policies.whatToBring,
      cancellationPolicy: policies.cancellationPolicy,
      languages: policies.languagesText
        .split(",")
        .map((language) => language.trim())
        .filter((language) => language.length > 0),
      parkingNotes: policies.parkingNotes,
      accessibilityNotes: policies.accessibilityNotes,
    });
    if (facts) setPolicies((prev) => ({ ...prev, suggested: facts.policies.suggested }));
  }

  async function loadWebsiteInformation() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/account/ai-knowledge/scan-website", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            facts?: AiFactsView;
            scan?: { loaded?: boolean; reviewNotes?: string | null };
          }
        | null;
      if (!res.ok || !json?.ok || !json.facts) {
        // Neutral state — never technical error text for the owner.
        setScanResult({ loaded: false, reviewNotes: null });
        return;
      }
      applyFacts(json.facts);
      setScanResult({
        loaded: json.scan?.loaded === true,
        reviewNotes: json.scan?.reviewNotes ?? null,
      });
    } catch {
      setScanResult({ loaded: false, reviewNotes: null });
    } finally {
      setScanning(false);
    }
  }

  // ------------------------------------------------------------------ render

  if (load === "signin_required") {
    return (
      <div className="alert alert-info" role="status">
        <span>Please sign in with your owner or admin account to manage this section.</span>
      </div>
    );
  }
  if (load === "error") {
    return (
      <div className="alert alert-error" role="alert">
        <span>We couldn’t load this section. Please refresh and try again.</span>
      </div>
    );
  }
  if (load === "loading") {
    return (
      <p className="t-small" role="status" aria-live="polite">Loading…</p>
    );
  }

  const website = businessProfile.website.trim();
  const hasAddress = businessProfile.streetAddress.trim().length > 0 && businessProfile.city.trim().length > 0;
  const anyServiceSuggested = services.some((item) => item.suggested);
  const anyInsuranceSuggested = insurance.some((item) => item.suggested);
  const selectedServiceCount = services.filter((item) => item.selected).length;
  const selectedInsuranceCount = insurance.filter((item) => item.selected).length;

  return (
    <div className="aifacts-stack">
      <div className="acct-callout" role="note">
        <p className="t-body" style={{ fontWeight: 700, margin: 0 }}>
          Add what AI can safely say to patients.
        </p>
        <p className="t-small" style={{ margin: 0 }}>
          Questions AI cannot answer go to someone in your office. AI never gives medical advice.
        </p>
      </div>

      {/* -------------------------------------------------------- website */}
      <section className="aifacts-acc" aria-labelledby="aifacts-website-title" style={{ padding: "var(--space-4) var(--space-5) var(--space-5)" }}>
        <h3 id="aifacts-website-title" className="t-h4" style={{ marginBottom: "var(--space-2)" }}>Website</h3>
        {website ? (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <p className="t-small" style={{ overflowWrap: "anywhere", fontWeight: 600, margin: 0 }}>{website}</p>
            <p className="t-small" style={{ margin: 0 }}>
              We can try to load basic information from your website. You can review everything
              before saving.
            </p>
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={loadWebsiteInformation}
                disabled={scanning}
              >
                {scanning ? "Loading…" : "Load website information"}
              </button>
              {scanning && (
                <span className="t-small" role="status" aria-live="polite">
                  Loading website information…
                </span>
              )}
            </div>
            {scanResult && scanResult.loaded && (
              <div className="alert alert-success" role="status">
                <span>
                  Website information loaded. Review the highlighted sections and save what is
                  correct.
                  {scanResult.reviewNotes ? ` ${scanResult.reviewNotes}` : ""}
                </span>
              </div>
            )}
            {scanResult && !scanResult.loaded && (
              <div className="alert alert-info" role="status">
                <span>No website information was loaded. You can fill in the sections below.</span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <p className="t-small" style={{ margin: 0 }}>
              Add a website in Business profile to load information from it.
            </p>
            <p style={{ margin: 0 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onGoToBusinessProfile}>
                Edit Business profile
              </button>
            </p>
          </div>
        )}
      </section>

      {/* ------------------------------------------------ business profile */}
      <Accordion title="Business profile facts" defaultOpen>
        <p className="t-small">Office address from Business profile.</p>
        <dl style={{ margin: 0 }}>
          <FactRow label="Clinic name" value={businessProfile.name} />
          <FactRow label="Main office phone" value={businessProfile.mainPhone} />
          <FactRow
            label="Address"
            value={
              hasAddress
                ? [
                    businessProfile.streetAddress,
                    businessProfile.addressLine2,
                    `${businessProfile.city}, ${businessProfile.stateRegion} ${businessProfile.postalCode}`.trim(),
                  ]
                    .filter((part) => part && part.trim().length > 0)
                    .join(", ")
                : ""
            }
          />
          <FactRow label="Website" value={website} />
        </dl>
        {(!hasAddress || !website) && (
          <p className="t-small">
            {!hasAddress && !website
              ? "Add your address and website in Business profile."
              : !hasAddress
                ? "Add your address in Business profile."
                : "Add your website in Business profile."}
          </p>
        )}
        <p style={{ margin: 0 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onGoToBusinessProfile}>
            Edit Business profile
          </button>
        </p>
      </Accordion>

      {/* ---------------------------------------------------------- hours */}
      <Accordion
        title="Hours & location"
        badge={hoursSuggested ? "Review" : undefined}
        meta={hoursPersisted ? undefined : "Needs setup"}
      >
        <p className="t-small">Set normal office hours.</p>
        {hoursSuggested && (
          <p className="t-small" style={{ fontWeight: 600 }}>
            We found hours on your website. Review and save them.
          </p>
        )}
        <div style={{ maxWidth: 320 }}>
          <SelectField
            label="Time zone"
            name="aifacts-timezone"
            value={timezone}
            onChange={setTimezone}
            options={HOURS_TIMEZONES.map((tz) => ({ value: tz.value, label: tz.label }))}
          />
        </div>
        <div>
          {WEEKDAY_ORDER.map((weekday) => {
            const day = hoursDays.find((d) => d.weekday === weekday);
            if (!day) return null;
            return (
              <div key={weekday} className="aifacts-hours-row">
                <span className="t-label">{WEEKDAY_LABELS[weekday]}</span>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={day.closed}
                    onChange={(e) =>
                      setHoursDays((prev) =>
                        prev.map((d) =>
                          d.weekday === weekday
                            ? {
                                ...d,
                                closed: e.target.checked,
                                opensAt: e.target.checked ? "" : d.opensAt || "08:00",
                                closesAt: e.target.checked ? "" : d.closesAt || "17:00",
                              }
                            : d,
                        ),
                      )
                    }
                  />
                  <span>Closed</span>
                </label>
                {!day.closed && (
                  <div className="aifacts-hours-times">
                    <label className="sr-only" htmlFor={`aifacts-open-${weekday}`}>
                      {WEEKDAY_LABELS[weekday]} opening time
                    </label>
                    <input
                      id={`aifacts-open-${weekday}`}
                      type="time"
                      className="input"
                      value={day.opensAt}
                      onChange={(e) =>
                        setHoursDays((prev) =>
                          prev.map((d) => (d.weekday === weekday ? { ...d, opensAt: e.target.value } : d)),
                        )
                      }
                    />
                    <span className="t-small">to</span>
                    <label className="sr-only" htmlFor={`aifacts-close-${weekday}`}>
                      {WEEKDAY_LABELS[weekday]} closing time
                    </label>
                    <input
                      id={`aifacts-close-${weekday}`}
                      type="time"
                      className="input"
                      value={day.closesAt}
                      onChange={(e) =>
                        setHoursDays((prev) =>
                          prev.map((d) => (d.weekday === weekday ? { ...d, closesAt: e.target.value } : d)),
                        )
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <SectionSave section="hours" state={saveState("hours")} onSave={saveHours} />
      </Accordion>

      {/* --------------------------------------------------- appointments */}
      <Accordion title="Appointments" badge={appointments.suggested ? "Review" : undefined}>
        <p className="t-small">Choose appointment requests your office handles.</p>
        <div className="aifacts-check-grid">
          <CheckOption
            label="Accepting new patients"
            checked={appointments.acceptingNewPatients}
            onChange={(v) => setAppointments((prev) => ({ ...prev, acceptingNewPatients: v }))}
          />
          <CheckOption
            label="Cleaning appointments"
            checked={appointments.cleaningAppointments}
            onChange={(v) => setAppointments((prev) => ({ ...prev, cleaningAppointments: v }))}
          />
          <CheckOption
            label="Same-day appointments"
            checked={appointments.sameDayAppointments}
            onChange={(v) => setAppointments((prev) => ({ ...prev, sameDayAppointments: v }))}
          />
          <CheckOption
            label="Emergency appointments"
            checked={appointments.emergencyAppointments}
            onChange={(v) => setAppointments((prev) => ({ ...prev, emergencyAppointments: v }))}
          />
          <CheckOption
            label="Reschedule/cancel requests"
            checked={appointments.rescheduleCancelRequests}
            onChange={(v) => setAppointments((prev) => ({ ...prev, rescheduleCancelRequests: v }))}
          />
        </div>
        <Field
          label="Preferred first time question"
          name="aifacts-preferred-time"
          value={appointments.preferredTimeQuestion}
          onChange={(v) => {
            if (v.length <= MAX_PREFERRED_TIME_QUESTION_LENGTH) {
              setAppointments((prev) => ({ ...prev, preferredTimeQuestion: v }));
            }
          }}
          helper="Asked when a patient wants to book."
        />
        <SectionSave section="appointments" state={saveState("appointments")} onSave={saveAppointments} />
      </Accordion>

      {/* ------------------------------------------------------ insurance */}
      <Accordion
        title="Insurance"
        badge={anyInsuranceSuggested ? "Review" : undefined}
        meta={`${selectedInsuranceCount} selected`}
      >
        <p className="t-small">Select insurance plans your office accepts.</p>
        <CatalogChecklist
          idPrefix="aifacts-ins"
          items={insurance}
          onToggle={(key, selected) =>
            setInsurance((prev) => prev.map((item) => (item.key === key ? { ...item, selected } : item)))
          }
          onRemove={(item) => removeCustomLocally("insurance", item)}
        />
        <AddCustomRow
          label="Add insurance"
          inputId="aifacts-add-insurance"
          value={newInsuranceLabel}
          onChange={setNewInsuranceLabel}
          onAdd={() => addCustomLocally("insurance")}
          disabled={saveState("insurance").saving}
        />
        <SectionSave
          section="insurance"
          state={saveState("insurance")}
          onSave={() => saveCatalogSection("insurance")}
        />
      </Accordion>

      {/* ------------------------------------------------------- services */}
      <Accordion
        title="Services"
        badge={anyServiceSuggested ? "Review" : undefined}
        meta={`${selectedServiceCount} selected`}
      >
        <p className="t-small">Select services your office offers.</p>
        <CatalogChecklist
          idPrefix="aifacts-svc"
          items={services}
          onToggle={(key, selected) =>
            setServices((prev) => prev.map((item) => (item.key === key ? { ...item, selected } : item)))
          }
          onRemove={(item) => removeCustomLocally("services", item)}
        />
        <AddCustomRow
          label="Add service"
          inputId="aifacts-add-service"
          value={newServiceLabel}
          onChange={setNewServiceLabel}
          onAdd={() => addCustomLocally("services")}
          disabled={saveState("services").saving}
        />
        <SectionSave
          section="services"
          state={saveState("services")}
          onSave={() => saveCatalogSection("services")}
        />
      </Accordion>

      {/* -------------------------------------------------------- payment */}
      <Accordion title="Payment" badge={payment.suggested ? "Review" : undefined}>
        <p className="t-small">Add payment options patients may ask about.</p>
        <div className="aifacts-check-grid">
          <CheckOption
            label="Payment plans"
            checked={payment.paymentPlans}
            onChange={(v) => setPayment((prev) => ({ ...prev, paymentPlans: v }))}
          />
          <CheckOption
            label="Financing"
            checked={payment.financing}
            onChange={(v) => setPayment((prev) => ({ ...prev, financing: v }))}
          />
          <CheckOption
            label="CareCredit"
            checked={payment.carecredit}
            onChange={(v) => setPayment((prev) => ({ ...prev, carecredit: v }))}
          />
          <CheckOption
            label="Membership plan"
            checked={payment.membershipPlan}
            onChange={(v) => setPayment((prev) => ({ ...prev, membershipPlan: v }))}
          />
        </div>
        <LabeledTextarea
          id="aifacts-pricing-policy"
          label="Pricing policy"
          optional
          value={payment.pricingPolicy}
          maxLength={MAX_PRICING_POLICY_LENGTH}
          onChange={(v) => setPayment((prev) => ({ ...prev, pricingPolicy: v }))}
          helper="Optional. A short note, not exact prices."
        />
        <SectionSave section="payment" state={saveState("payment")} onSave={savePayment} />
      </Accordion>

      {/* ------------------------------------------------ office policies */}
      <Accordion title="Office policies" badge={policies.suggested ? "Review" : undefined}>
        <p className="t-small">Add basic office rules patients may ask about.</p>
        <LabeledTextarea
          id="aifacts-new-patient-forms"
          label="New patient forms"
          optional
          value={policies.newPatientForms}
          maxLength={MAX_POLICY_TEXT_LENGTH}
          onChange={(v) => setPolicies((prev) => ({ ...prev, newPatientForms: v }))}
        />
        <LabeledTextarea
          id="aifacts-what-to-bring"
          label="What to bring"
          optional
          value={policies.whatToBring}
          maxLength={MAX_POLICY_TEXT_LENGTH}
          onChange={(v) => setPolicies((prev) => ({ ...prev, whatToBring: v }))}
        />
        <LabeledTextarea
          id="aifacts-cancellation"
          label="Cancellation policy"
          optional
          value={policies.cancellationPolicy}
          maxLength={MAX_POLICY_TEXT_LENGTH}
          onChange={(v) => setPolicies((prev) => ({ ...prev, cancellationPolicy: v }))}
        />
        <Field
          label="Languages"
          name="aifacts-languages"
          value={policies.languagesText}
          onChange={(v) => setPolicies((prev) => ({ ...prev, languagesText: v }))}
          optional
          placeholder="English, Spanish"
          helper="Select languages your office supports, separated by commas."
        />
        <LabeledTextarea
          id="aifacts-parking"
          label="Parking notes"
          optional
          value={policies.parkingNotes}
          maxLength={MAX_POLICY_TEXT_LENGTH}
          onChange={(v) => setPolicies((prev) => ({ ...prev, parkingNotes: v }))}
        />
        <LabeledTextarea
          id="aifacts-accessibility"
          label="Accessibility notes"
          optional
          value={policies.accessibilityNotes}
          maxLength={MAX_POLICY_TEXT_LENGTH}
          onChange={(v) => setPolicies((prev) => ({ ...prev, accessibilityNotes: v }))}
        />
        <SectionSave section="policies" state={saveState("policies")} onSave={savePolicies} />
      </Accordion>
    </div>
  );
}

// ------------------------------------------------------------ small pieces

function Accordion({
  title,
  badge,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  // Short muted summary shown in the header (e.g. "3 selected").
  meta?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  // Controlled <details> so React re-renders never snap a section back open.
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className="aifacts-acc"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>
        <span className="aifacts-acc-title">
          <h3 className="t-h4" style={{ font: "inherit", margin: 0 }}>{title}</h3>
          {badge && <span className="badge badge-info">{badge}</span>}
          {meta && <span className="t-small" style={{ fontWeight: 400 }}>· {meta}</span>}
        </span>
      </summary>
      <div className="aifacts-acc-body">{children}</div>
    </details>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="acct-statusrow">
      <dt className="t-small" style={{ color: "var(--text-secondary)" }}>{label}</dt>
      <dd className="t-small" style={{ margin: 0, textAlign: "right", overflowWrap: "anywhere" }}>
        {value.trim().length > 0 ? value : "—"}
      </dd>
    </div>
  );
}

function CheckOption({
  label,
  checked,
  onChange,
  suggested = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  suggested?: boolean;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {suggested && (
          <span className="t-helper" style={{ display: "block" }}>Suggested from your website</span>
        )}
      </span>
    </label>
  );
}

function CatalogChecklist({
  idPrefix,
  items,
  onToggle,
  onRemove,
}: {
  idPrefix: string;
  items: CatalogItemState[];
  onToggle: (key: string, selected: boolean) => void;
  // Custom items only; default catalog items can only be unchecked.
  onRemove: (item: CatalogItemState) => void;
}) {
  return (
    <div className="aifacts-check-grid" role="group" aria-label="Options">
      {items.map((item) => (
        <span
          key={`${idPrefix}-${item.key}`}
          style={{ display: "inline-flex", alignItems: "flex-start", gap: "var(--space-2)" }}
        >
          <CheckOption
            label={item.label}
            checked={item.selected}
            onChange={(v) => onToggle(item.key, v)}
            suggested={item.suggested && item.selected}
          />
          {item.isCustom && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label={`Remove ${item.label}`}
              onClick={() => onRemove(item)}
              style={{ flex: "0 0 auto" }}
            >
              Remove
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function AddCustomRow({
  label,
  inputId,
  value,
  onChange,
  onAdd,
  disabled,
}: {
  label: string;
  inputId: string;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  disabled: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="aifacts-addrow">
        <input
          id={inputId}
          className="input"
          value={value}
          maxLength={MAX_CUSTOM_LABEL_LENGTH}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (value.trim().length > 0) onAdd();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onAdd}
          disabled={disabled || value.trim().length === 0}
        >
          Add
        </button>
      </div>
      <p className="helper">Added items are saved when you click Save.</p>
    </div>
  );
}

function LabeledTextarea({
  id,
  label,
  value,
  onChange,
  maxLength,
  optional = false,
  helper,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  optional?: boolean;
  helper?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {optional && <span className="t-helper"> (optional)</span>}
      </label>
      <textarea
        id={id}
        className="textarea"
        rows={2}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
      {helper && <p className="helper">{helper}</p>}
    </div>
  );
}

function SectionSave({
  section,
  state,
  onSave,
}: {
  section: string;
  state: SaveState;
  onSave: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={onSave}
        disabled={state.saving}
        data-section={section}
      >
        {state.saving ? "Saving…" : "Save"}
      </button>
      {state.saved && !state.error && (
        <span className="t-small acct-savebar-status" role="status" aria-live="polite">Saved</span>
      )}
      {state.error && (
        <span className="t-small" role="alert" style={{ color: "var(--error-text)" }}>{state.error}</span>
      )}
    </div>
  );
}
