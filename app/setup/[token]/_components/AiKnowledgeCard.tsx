"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Field, SelectField, StatusBadge } from "./AccountUI";
import type { BusinessProfileFields } from "./account-types";
// Type-only import: erased at compile time, so no server/DB code is bundled.
import type { AiFactsView } from "../../../../lib/db/ai-knowledge";
import {
  FINANCING_DEFAULTS,
  HOURS_TIMEZONES,
  MAX_CUSTOM_LABEL_LENGTH,
  MAX_FINANCING_OPTIONS_PER_CLINIC,
  MAX_INSURANCE_PLANS_PER_CLINIC,
  MAX_LANGUAGE_LENGTH,
  MAX_LANGUAGES,
  MAX_POLICY_TEXT_LENGTH,
  MAX_SERVICES_PER_CLINIC,
} from "../../../../config/ai-front-desk-facts.config";

// AI Front Desk Knowledge — structured clinic facts the owner reviews and
// approves. Facts-first accordion UI: website loader on top, then read-only
// business profile facts and the editable sections (hours, insurance,
// services, languages, payment methods, financing, office policies).
//
// Review lifecycle: every editable section shows "Needs review" until its
// first successful Save, then a green "Complete" badge. A saved section locks
// (fields read-only, Save replaced by Edit) until the owner clicks Edit —
// the same lock/edit interaction as the Business profile form. Review state
// persists server-side (clinic_ai_knowledge_section_reviews) and survives
// reloads; website-scan drafts re-open only the affected sections.
//
// Appointment request collection is explained in the intro card and is not
// owner-configured — there is no Appointments section here.
// Address/website stay owned by Business profile; this card only reads them.

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // show Monday first

// Owner-reviewable sections (matches the server's section_key vocabulary).
// Business profile facts and the website loader are intentionally absent.
type AiEditableSection =
  | "hours"
  | "insurance"
  | "services"
  | "languages"
  | "payment_methods"
  | "financing"
  | "office_policies";

type ReviewedState = Record<AiEditableSection, boolean>;

const NOT_REVIEWED: ReviewedState = {
  hours: false,
  insurance: false,
  services: false,
  languages: false,
  payment_methods: false,
  financing: false,
  office_policies: false,
};

function reviewedFromFacts(facts: AiFactsView): ReviewedState {
  return {
    hours: facts.reviewedSections.hours,
    insurance: facts.reviewedSections.insurance,
    services: facts.reviewedSections.services,
    languages: facts.reviewedSections.languages,
    payment_methods: facts.reviewedSections.paymentMethods,
    financing: facts.reviewedSections.financing,
    office_policies: facts.reviewedSections.officePolicies,
  };
}

type HoursDayState = { weekday: number; closed: boolean; opensAt: string; closesAt: string };
type CatalogItemState = {
  key: string;
  label: string;
  selected: boolean;
  isCustom: boolean;
  suggested: boolean;
  // Added locally and not saved yet (persists on Save, not before).
  pending?: boolean;
  // Always-on, non-removable (e.g. English in Languages).
  locked?: boolean;
};

type SaveState = { saving: boolean; error: string | null };
const IDLE_SAVE: SaveState = { saving: false, error: null };

type LoadState = "loading" | "signin_required" | "error" | "ready";

// Outcome of the latest "Load website information" click. `loaded` is false
// for both "nothing useful found" and "site unreachable" — the owner sees one
// neutral message either way.
type ScanResultState = { loaded: boolean; reviewNotes: string | null } | null;

export function AiKnowledgeCard({
  businessProfile,
  onGoToBusinessProfile,
  apiBasePath = "/api/account/ai-knowledge",
}: {
  businessProfile: BusinessProfileFields;
  onGoToBusinessProfile: () => void;
  // Base path for the AI Knowledge API. Owner /account uses the default;
  // the platform-admin console passes /api/admin/clinics/{clinicId}/ai-knowledge.
  // The route shapes (GET base, POST base/<section>, POST base/scan-website)
  // are identical, so the same component drives both.
  apiBasePath?: string;
}) {
  const [load, setLoad] = useState<LoadState>("loading");

  const [timezone, setTimezone] = useState<string>("America/Chicago");
  const [hoursDays, setHoursDays] = useState<HoursDayState[]>([]);
  const [hoursSuggested, setHoursSuggested] = useState(false);

  const [services, setServices] = useState<CatalogItemState[]>([]);
  const [insurance, setInsurance] = useState<CatalogItemState[]>([]);
  const [removedServiceKeys, setRemovedServiceKeys] = useState<string[]>([]);
  const [removedInsuranceKeys, setRemovedInsuranceKeys] = useState<string[]>([]);
  const [newServiceLabel, setNewServiceLabel] = useState("");
  const [newInsuranceLabel, setNewInsuranceLabel] = useState("");

  const [languages, setLanguages] = useState<CatalogItemState[]>([]);
  const [newLanguageLabel, setNewLanguageLabel] = useState("");

  const [paymentMethods, setPaymentMethods] = useState({
    cash: false,
    creditDebitCards: false,
    personalChecks: false,
    hsaFsaCards: false,
    bankTransferAch: false,
  });

  const [financingDefaults, setFinancingDefaults] = useState({
    inOfficePaymentPlans: false,
    carecredit: false,
    alphaeonCredit: false,
    membershipPlan: false,
  });
  const [financingOptions, setFinancingOptions] = useState<CatalogItemState[]>([]);
  const [removedFinancingKeys, setRemovedFinancingKeys] = useState<string[]>([]);
  const [newFinancingLabel, setNewFinancingLabel] = useState("");

  const [policies, setPolicies] = useState({
    newPatientForms: "",
    whatToBring: "",
    cancellationPolicy: "",
    parkingNotes: "",
    accessibilityNotes: "",
  });

  // Review lifecycle: `reviewed` comes from the server and survives reloads;
  // `editing` is the owner's local "Edit" unlock per section.
  const [reviewed, setReviewed] = useState<ReviewedState>(NOT_REVIEWED);
  const [editing, setEditing] = useState<Partial<Record<AiEditableSection, boolean>>>({});

  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResultState>(null);

  function saveState(section: AiEditableSection): SaveState {
    return saveStates[section] ?? IDLE_SAVE;
  }
  function setSave(section: AiEditableSection, state: SaveState) {
    setSaveStates((prev) => ({ ...prev, [section]: state }));
  }

  // A reviewed section is locked (read-only, Edit shown) until the owner
  // clicks Edit. An unreviewed section is always editable.
  function isLocked(section: AiEditableSection): boolean {
    return reviewed[section] && editing[section] !== true;
  }
  // Header badge follows the visible mode, never just the stored review flag:
  // a reviewed section re-opened via Edit shows "Needs review" + Save, so
  // "Complete" and a Save button can never appear together.
  function sectionStatus(section: AiEditableSection): "needs_review" | "complete" {
    return reviewed[section] && isLocked(section) ? "complete" : "needs_review";
  }
  function startEditing(section: AiEditableSection) {
    setEditing((prev) => ({ ...prev, [section]: true }));
    setSave(section, IDLE_SAVE);
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
    setServices(facts.services);
    setInsurance(facts.insurancePlans);
    setLanguages(facts.languages.items);
    setRemovedServiceKeys([]);
    setRemovedInsuranceKeys([]);
    setPaymentMethods({
      cash: facts.payment.methods.cash ?? false,
      creditDebitCards: facts.payment.methods.creditDebitCards ?? false,
      personalChecks: facts.payment.methods.personalChecks ?? false,
      hsaFsaCards: facts.payment.methods.hsaFsaCards ?? false,
      bankTransferAch: facts.payment.methods.bankTransferAch ?? false,
    });
    setFinancingDefaults({
      inOfficePaymentPlans: facts.payment.financing.inOfficePaymentPlans ?? false,
      carecredit: facts.payment.financing.carecredit ?? false,
      alphaeonCredit: facts.payment.financing.alphaeonCredit ?? false,
      membershipPlan: facts.payment.financing.membershipPlan ?? false,
    });
    setFinancingOptions(facts.payment.financing.customOptions);
    setRemovedFinancingKeys([]);
    setPolicies({
      newPatientForms: facts.policies.newPatientForms ?? "",
      whatToBring: facts.policies.whatToBring ?? "",
      cancellationPolicy: facts.policies.cancellationPolicy ?? "",
      parkingNotes: facts.policies.parkingNotes ?? "",
      accessibilityNotes: facts.policies.accessibilityNotes ?? "",
    });
    setReviewed(reviewedFromFacts(facts));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiBasePath, { credentials: "include" });
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

  // POST one section save. On success the server marks the section reviewed,
  // so the section returns to locked/Complete mode (Save becomes Edit).
  async function postSection(
    section: AiEditableSection,
    path: string,
    body: unknown,
  ): Promise<AiFactsView | null> {
    setSave(section, { saving: true, error: null });
    try {
      const res = await fetch(`${apiBasePath}/${path}`, {
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
        });
        return null;
      }
      setSave(section, IDLE_SAVE);
      setReviewed(reviewedFromFacts(json.facts));
      setEditing((prev) => ({ ...prev, [section]: false }));
      return json.facts;
    } catch {
      setSave(section, { saving: false, error: "Could not save. Please try again." });
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
    if (facts) setHoursSuggested(facts.hours.suggested);
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
      setSave(section, { saving: false, error: `“${label}” is already in the list.` });
      return;
    }
    if (items.length >= max) {
      setSave(section, {
        saving: false,
        error: `You can list up to ${max} ${section === "services" ? "services" : "insurance plans"}.`,
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

  async function savePaymentMethodsSection() {
    await postSection("payment_methods", "payment", {
      paymentMethods: {
        creditDebitCards: paymentMethods.creditDebitCards,
        hsaFsaCards: paymentMethods.hsaFsaCards,
        personalChecks: paymentMethods.personalChecks,
        cash: paymentMethods.cash,
        bankTransferAch: paymentMethods.bankTransferAch,
      },
    });
  }

  // One Save persists the whole Financing & plans section: the default
  // booleans, newly added custom options, removed custom options, and the
  // checked/unchecked state of existing custom options.
  async function saveFinancing() {
    const facts = await postSection("financing", "payment", {
      financing: {
        inOfficePaymentPlans: financingDefaults.inOfficePaymentPlans,
        carecredit: financingDefaults.carecredit,
        alphaeonCredit: financingDefaults.alphaeonCredit,
        membershipPlan: financingDefaults.membershipPlan,
        selections: financingOptions
          .filter((item) => !item.pending)
          .map((item) => ({ key: item.key, selected: item.selected })),
        customToAdd: financingOptions
          .filter((item) => item.pending)
          .map((item) => ({ label: item.label, selected: item.selected })),
        customToRemove: removedFinancingKeys,
      },
    });
    if (facts) {
      setFinancingDefaults({
        inOfficePaymentPlans: facts.payment.financing.inOfficePaymentPlans ?? false,
        carecredit: facts.payment.financing.carecredit ?? false,
        alphaeonCredit: facts.payment.financing.alphaeonCredit ?? false,
        membershipPlan: facts.payment.financing.membershipPlan ?? false,
      });
      setFinancingOptions(facts.payment.financing.customOptions);
      setRemovedFinancingKeys([]);
    }
  }

  // Adding only updates the visible list; nothing is stored until Save.
  function addFinancingLocally() {
    const label = newFinancingLabel.trim().replace(/\s+/g, " ");
    if (label.length === 0) return;
    const takenLabels = [
      ...FINANCING_DEFAULTS.map((option) => option.label),
      ...financingOptions.map((item) => item.label),
    ];
    if (takenLabels.some((existing) => existing.toLowerCase() === label.toLowerCase())) {
      setSave("financing", { saving: false, error: `“${label}” is already in the list.` });
      return;
    }
    if (financingOptions.length >= MAX_FINANCING_OPTIONS_PER_CLINIC) {
      setSave("financing", {
        saving: false,
        error: `You can list up to ${MAX_FINANCING_OPTIONS_PER_CLINIC} financing options.`,
      });
      return;
    }
    setFinancingOptions((prev) => [
      ...prev,
      {
        key: `pending:${label.toLowerCase()}`,
        label,
        selected: true,
        isCustom: true,
        suggested: false,
        pending: true,
      },
    ]);
    setNewFinancingLabel("");
    setSave("financing", IDLE_SAVE);
  }

  // Remove is for custom options only. Pending items vanish locally; existing
  // custom options are deleted when the owner clicks Save.
  function removeFinancingLocally(item: CatalogItemState) {
    if (!item.isCustom) return;
    setFinancingOptions((prev) => prev.filter((o) => o.key !== item.key));
    if (!item.pending) setRemovedFinancingKeys((prev) => [...prev, item.key]);
    setSave("financing", IDLE_SAVE);
  }

  async function savePolicies() {
    await postSection("office_policies", "policies", {
      newPatientForms: policies.newPatientForms,
      whatToBring: policies.whatToBring,
      cancellationPolicy: policies.cancellationPolicy,
      parkingNotes: policies.parkingNotes,
      accessibilityNotes: policies.accessibilityNotes,
    });
  }

  // Languages save the full selected list; the server always re-adds English.
  async function saveLanguages() {
    const facts = await postSection("languages", "languages", {
      languages: languages.filter((item) => item.selected).map((item) => item.label),
    });
    if (facts) setLanguages(facts.languages.items);
  }

  function addLanguageLocally() {
    const label = newLanguageLabel.trim().replace(/\s+/g, " ");
    if (label.length === 0) return;
    if (label.length > MAX_LANGUAGE_LENGTH) {
      setSave("languages", {
        saving: false,
        error: `Keep each language under ${MAX_LANGUAGE_LENGTH} characters.`,
      });
      return;
    }
    if (languages.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
      setSave("languages", { saving: false, error: `“${label}” is already in the list.` });
      return;
    }
    if (languages.length >= MAX_LANGUAGES) {
      setSave("languages", { saving: false, error: `List up to ${MAX_LANGUAGES} languages.` });
      return;
    }
    setLanguages((prev) => [
      ...prev,
      {
        key: `pending:${label.toLowerCase()}`,
        label,
        selected: true,
        isCustom: true,
        suggested: false,
        pending: true,
      },
    ]);
    setNewLanguageLabel("");
    setSave("languages", IDLE_SAVE);
  }

  function removeLanguageLocally(item: CatalogItemState) {
    if (!item.isCustom || item.locked) return;
    setLanguages((prev) => prev.filter((l) => l.key !== item.key));
    setSave("languages", IDLE_SAVE);
  }

  async function loadWebsiteInformation() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch(`${apiBasePath}/scan-website`, {
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
  const hoursLocked = isLocked("hours");
  const insuranceLocked = isLocked("insurance");
  const servicesLocked = isLocked("services");
  const languagesLocked = isLocked("languages");
  const paymentMethodsLocked = isLocked("payment_methods");
  const financingLocked = isLocked("financing");
  const policiesLocked = isLocked("office_policies");

  return (
    <div className="aifacts-stack">
      <div className="acct-callout aifacts-intro" role="note">
        <p className="aifacts-intro-title">Add what AI can safely say to patients.</p>
        <div className="aifacts-intro-body">
          <p>AI collects appointment requests. Your office confirms appointments.</p>
          <p>Questions AI cannot answer go to someone in your office.</p>
          <p>AI never gives medical advice.</p>
        </div>
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
      <Accordion title="Business profile facts">
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
      <Accordion title="Hours & location" status={sectionStatus("hours")}>
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
            readOnly={hoursLocked}
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
                    disabled={hoursLocked}
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
                      disabled={hoursLocked}
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
                      disabled={hoursLocked}
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
        <SectionReviewActions
          section="hours"
          locked={hoursLocked}
          state={saveState("hours")}
          onEdit={() => startEditing("hours")}
          onSave={saveHours}
        />
      </Accordion>

      {/* ------------------------------------------------------ insurance */}
      <Accordion title="Insurance" status={sectionStatus("insurance")}>
        <p className="t-small">Select insurance plans your office accepts.</p>
        <CatalogChecklist
          idPrefix="aifacts-ins"
          items={insurance}
          disabled={insuranceLocked}
          onToggle={(key, selected) =>
            setInsurance((prev) => prev.map((item) => (item.key === key ? { ...item, selected } : item)))
          }
          onRemove={(item) => removeCustomLocally("insurance", item)}
        />
        {!insuranceLocked && (
          <AddCustomRow
            label="Add insurance"
            inputId="aifacts-add-insurance"
            value={newInsuranceLabel}
            onChange={setNewInsuranceLabel}
            onAdd={() => addCustomLocally("insurance")}
            disabled={saveState("insurance").saving}
          />
        )}
        <SectionReviewActions
          section="insurance"
          locked={insuranceLocked}
          state={saveState("insurance")}
          onEdit={() => startEditing("insurance")}
          onSave={() => saveCatalogSection("insurance")}
        />
      </Accordion>

      {/* ------------------------------------------------------- services */}
      <Accordion title="Services" status={sectionStatus("services")}>
        <p className="t-small">Select services your office offers.</p>
        <CatalogChecklist
          idPrefix="aifacts-svc"
          items={services}
          disabled={servicesLocked}
          onToggle={(key, selected) =>
            setServices((prev) => prev.map((item) => (item.key === key ? { ...item, selected } : item)))
          }
          onRemove={(item) => removeCustomLocally("services", item)}
        />
        {!servicesLocked && (
          <AddCustomRow
            label="Add service"
            inputId="aifacts-add-service"
            value={newServiceLabel}
            onChange={setNewServiceLabel}
            onAdd={() => addCustomLocally("services")}
            disabled={saveState("services").saving}
          />
        )}
        <SectionReviewActions
          section="services"
          locked={servicesLocked}
          state={saveState("services")}
          onEdit={() => startEditing("services")}
          onSave={() => saveCatalogSection("services")}
        />
      </Accordion>

      {/* ------------------------------------------------------ languages */}
      <Accordion title="Languages" status={sectionStatus("languages")}>
        <p className="t-small">Select languages your office supports.</p>
        <CatalogChecklist
          idPrefix="aifacts-lang"
          items={languages}
          disabled={languagesLocked}
          onToggle={(key, selected) =>
            setLanguages((prev) => prev.map((item) => (item.key === key ? { ...item, selected } : item)))
          }
          onRemove={removeLanguageLocally}
        />
        {!languagesLocked && (
          <AddCustomRow
            label="Add language"
            inputId="aifacts-add-language"
            value={newLanguageLabel}
            onChange={setNewLanguageLabel}
            onAdd={addLanguageLocally}
            disabled={saveState("languages").saving}
          />
        )}
        <SectionReviewActions
          section="languages"
          locked={languagesLocked}
          state={saveState("languages")}
          onEdit={() => startEditing("languages")}
          onSave={saveLanguages}
        />
      </Accordion>

      {/* ------------------------------------------------ payment methods */}
      <Accordion title="Payment methods" status={sectionStatus("payment_methods")}>
        <p className="t-small">Select payment methods your office accepts.</p>
        {/* Fixed list in this exact order — no custom payment methods. */}
        <div className="aifacts-check-grid">
          <CheckOption
            label="Credit/debit cards"
            checked={paymentMethods.creditDebitCards}
            disabled={paymentMethodsLocked}
            onChange={(v) => setPaymentMethods((prev) => ({ ...prev, creditDebitCards: v }))}
          />
          <CheckOption
            label="HSA/FSA cards"
            checked={paymentMethods.hsaFsaCards}
            disabled={paymentMethodsLocked}
            onChange={(v) => setPaymentMethods((prev) => ({ ...prev, hsaFsaCards: v }))}
          />
          <CheckOption
            label="Personal checks"
            checked={paymentMethods.personalChecks}
            disabled={paymentMethodsLocked}
            onChange={(v) => setPaymentMethods((prev) => ({ ...prev, personalChecks: v }))}
          />
          <CheckOption
            label="Cash"
            checked={paymentMethods.cash}
            disabled={paymentMethodsLocked}
            onChange={(v) => setPaymentMethods((prev) => ({ ...prev, cash: v }))}
          />
          <CheckOption
            label="Bank transfer / ACH"
            checked={paymentMethods.bankTransferAch}
            disabled={paymentMethodsLocked}
            onChange={(v) => setPaymentMethods((prev) => ({ ...prev, bankTransferAch: v }))}
          />
        </div>
        <SectionReviewActions
          section="payment_methods"
          locked={paymentMethodsLocked}
          state={saveState("payment_methods")}
          onEdit={() => startEditing("payment_methods")}
          onSave={savePaymentMethodsSection}
        />
      </Accordion>

      {/* --------------------------------------------------- financing & plans */}
      <Accordion title="Financing & plans" status={sectionStatus("financing")}>
        <p className="t-small">Select financing options your office offers.</p>
        <div className="aifacts-check-grid" role="group" aria-label="Financing options">
          <CheckOption
            label="In-office payment plans"
            checked={financingDefaults.inOfficePaymentPlans}
            disabled={financingLocked}
            onChange={(v) => setFinancingDefaults((prev) => ({ ...prev, inOfficePaymentPlans: v }))}
          />
          <CheckOption
            label="CareCredit"
            checked={financingDefaults.carecredit}
            disabled={financingLocked}
            onChange={(v) => setFinancingDefaults((prev) => ({ ...prev, carecredit: v }))}
          />
          <CheckOption
            label="Alphaeon Credit"
            checked={financingDefaults.alphaeonCredit}
            disabled={financingLocked}
            onChange={(v) => setFinancingDefaults((prev) => ({ ...prev, alphaeonCredit: v }))}
          />
          <CheckOption
            label="Membership plan"
            checked={financingDefaults.membershipPlan}
            disabled={financingLocked}
            onChange={(v) => setFinancingDefaults((prev) => ({ ...prev, membershipPlan: v }))}
          />
          {financingOptions.map((item) => (
            <div key={`aifacts-fin-${item.key}`} className="aifacts-check-cell">
              <CheckOption
                label={item.label}
                checked={item.selected}
                disabled={financingLocked}
                onChange={(v) =>
                  setFinancingOptions((prev) =>
                    prev.map((o) => (o.key === item.key ? { ...o, selected: v } : o)),
                  )
                }
              />
              {item.isCustom && !financingLocked && (
                <button
                  type="button"
                  className="aifacts-remove"
                  aria-label={`Remove ${item.label}`}
                  onClick={() => removeFinancingLocally(item)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {!financingLocked && (
          <AddCustomRow
            label="Add financing option"
            inputId="aifacts-add-financing"
            value={newFinancingLabel}
            onChange={setNewFinancingLabel}
            onAdd={addFinancingLocally}
            disabled={saveState("financing").saving}
          />
        )}
        <SectionReviewActions
          section="financing"
          locked={financingLocked}
          state={saveState("financing")}
          onEdit={() => startEditing("financing")}
          onSave={saveFinancing}
        />
      </Accordion>

      {/* ------------------------------------------------ office policies */}
      <Accordion title="Office policies" status={sectionStatus("office_policies")}>
        <p className="t-small">Add basic office rules patients may ask about.</p>
        <Field
          label="Form link"
          name="aifacts-new-patient-forms"
          value={policies.newPatientForms}
          onChange={(v) => setPolicies((prev) => ({ ...prev, newPatientForms: v }))}
          optional
          readOnly={policiesLocked}
          placeholder="https://yourpractice.com/new-patient-forms"
          helper="A link to your new patient forms, if you have one."
        />
        <LabeledTextarea
          id="aifacts-what-to-bring"
          label="What to bring"
          optional
          value={policies.whatToBring}
          maxLength={MAX_POLICY_TEXT_LENGTH}
          readOnly={policiesLocked}
          placeholder="Photo ID, insurance card, list of medications"
          onChange={(v) => setPolicies((prev) => ({ ...prev, whatToBring: v }))}
        />
        <LabeledTextarea
          id="aifacts-cancellation"
          label="Cancellation / reschedule policy"
          optional
          value={policies.cancellationPolicy}
          maxLength={MAX_POLICY_TEXT_LENGTH}
          readOnly={policiesLocked}
          placeholder="Example: Please call our office to cancel or reschedule your appointment."
          onChange={(v) => setPolicies((prev) => ({ ...prev, cancellationPolicy: v }))}
        />
        <LabeledTextarea
          id="aifacts-parking"
          label="Parking notes"
          optional
          value={policies.parkingNotes}
          maxLength={MAX_POLICY_TEXT_LENGTH}
          readOnly={policiesLocked}
          placeholder="Example: Free parking is available behind the building."
          onChange={(v) => setPolicies((prev) => ({ ...prev, parkingNotes: v }))}
        />
        <LabeledTextarea
          id="aifacts-accessibility"
          label="Accessibility notes"
          optional
          value={policies.accessibilityNotes}
          maxLength={MAX_POLICY_TEXT_LENGTH}
          readOnly={policiesLocked}
          onChange={(v) => setPolicies((prev) => ({ ...prev, accessibilityNotes: v }))}
        />
        <SectionReviewActions
          section="office_policies"
          locked={policiesLocked}
          state={saveState("office_policies")}
          onEdit={() => startEditing("office_policies")}
          onSave={savePolicies}
        />
      </Accordion>
    </div>
  );
}

// ------------------------------------------------------------ small pieces

function Accordion({
  title,
  status,
  defaultOpen = false,
  children,
}: {
  title: string;
  // Review lifecycle badge: yellow "Needs review" before the owner saves the
  // section, green "Complete" after. Omitted for read-only sections.
  status?: "needs_review" | "complete";
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
          {status && <ReviewStatusBadge status={status} />}
        </span>
      </summary>
      <div className="aifacts-acc-body">{children}</div>
    </details>
  );
}

// Review badge with owner help: the yellow "Needs review" badge carries a
// short tooltip (hover via title, keyboard via tabIndex + aria-label) so the
// owner knows what to do next. Scoped to AI Knowledge only — the shared
// StatusBadge stays untouched.
const NEEDS_REVIEW_HELP = "Review this section and click Save to mark it complete.";

function ReviewStatusBadge({ status }: { status: "needs_review" | "complete" }) {
  if (status === "complete") {
    return <StatusBadge kind="complete" />;
  }
  return (
    <span
      className="aifacts-review-badge-help"
      title={NEEDS_REVIEW_HELP}
      aria-label={`Needs review. ${NEEDS_REVIEW_HELP}`}
      tabIndex={0}
    >
      <StatusBadge kind="needs_setup" label="Needs review" />
    </span>
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
  locked = false,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  // Always-on, non-editable (e.g. English in Languages).
  locked?: boolean;
  // Section is in reviewed/locked mode — checkbox is read-only without the
  // "Locked" tag.
  disabled?: boolean;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        disabled={locked || disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {locked && <span className="aifacts-lock">Locked</span>}
      </span>
    </label>
  );
}

function CatalogChecklist({
  idPrefix,
  items,
  onToggle,
  onRemove,
  disabled = false,
}: {
  idPrefix: string;
  items: CatalogItemState[];
  onToggle: (key: string, selected: boolean) => void;
  // Custom items only; default catalog items can only be unchecked.
  onRemove: (item: CatalogItemState) => void;
  // Reviewed/locked mode: checkboxes read-only, remove buttons hidden.
  disabled?: boolean;
}) {
  return (
    <div className="aifacts-check-grid" role="group" aria-label="Options">
      {items.map((item) => (
        <div key={`${idPrefix}-${item.key}`} className="aifacts-check-cell">
          <CheckOption
            label={item.label}
            checked={item.selected}
            onChange={(v) => onToggle(item.key, v)}
            locked={item.locked}
            disabled={disabled}
          />
          {item.isCustom && !item.locked && !disabled && (
            <button
              type="button"
              className="aifacts-remove"
              aria-label={`Remove ${item.label}`}
              onClick={() => onRemove(item)}
            >
              ×
            </button>
          )}
        </div>
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
  readOnly = false,
  helper,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  optional?: boolean;
  // Locked/read-only mode: value stays visible but not editable.
  readOnly?: boolean;
  helper?: string;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {optional && <span className="t-helper"> (optional)</span>}
      </label>
      <textarea
        id={id}
        className={readOnly ? "textarea acct-readonly" : "textarea"}
        rows={2}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {helper && <p className="helper">{helper}</p>}
    </div>
  );
}

// Save/Edit lifecycle actions for one reviewable section. Unreviewed or
// re-opened sections show Save; a reviewed section locks and shows Edit
// (mirrors the Business profile lock/edit pattern). No permanent "Saved"
// text — the Complete badge and the Edit button are the saved state.
function SectionReviewActions({
  section,
  locked,
  state,
  onEdit,
  onSave,
}: {
  section: AiEditableSection;
  locked: boolean;
  state: SaveState;
  onEdit: () => void;
  onSave: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
      {locked ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onEdit}
          data-section={section}
        >
          Edit
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onSave}
          disabled={state.saving}
          data-section={section}
        >
          {state.saving ? "Saving…" : "Save"}
        </button>
      )}
      {!locked && state.error && (
        <span className="t-small" role="alert" style={{ color: "var(--error-text)" }}>{state.error}</span>
      )}
    </div>
  );
}
