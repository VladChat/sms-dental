"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./AccountUI";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { NumberTypeChooser } from "./NumberTypeChooser";
import { OwnerNumberSearch } from "./OwnerNumberSearch";
import type {
  AssignedBusinessNumberSummary,
  OwnerNumberEntitlement,
  SmsStatus,
} from "./account-types";
import {
  assignedNumberBillingLabel,
  billingConfig,
  formatUsdFromCents,
} from "../../../../config/billing.config";

const BASE_MONTHLY = formatUsdFromCents(billingConfig.basePlan.monthlyUnitAmountCents);
const ADDITIONAL_MONTHLY = formatUsdFromCents(
  billingConfig.additionalBusinessNumber.monthlyUnitAmountCents,
);
const ADD_NUMBER_TOTAL_MONTHLY = formatUsdFromCents(
  billingConfig.basePlan.monthlyUnitAmountCents +
    billingConfig.additionalBusinessNumber.monthlyUnitAmountCents,
);

const LOCAL_NOTICE =
  "Local number billing is not configured yet. No charge was made.";

const TAG_ROW: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--space-2)",
  marginTop: "var(--space-2)",
};

export function AssignedNumberCard({
  assignedNumbers,
  smsStatus,
  areaCode,
  postalCode,
  hasPaymentMethod,
  entitlement,
  onGoToBilling,
  onStartPaidPlan,
  startingPaidPlan,
  paidPlanPending,
  paidPlanError,
  onPurchased,
}: {
  assignedNumbers: AssignedBusinessNumberSummary[];
  smsStatus: SmsStatus;
  areaCode: string | null;
  postalCode: string | null;
  hasPaymentMethod: boolean;
  entitlement: OwnerNumberEntitlement;
  onGoToBilling: () => void;
  onStartPaidPlan: () => void | Promise<void>;
  startingPaidPlan: boolean;
  paidPlanPending: boolean;
  paidPlanError: string | null;
  onPurchased: (n: AssignedBusinessNumberSummary) => void;
}) {
  const showEmpty = assignedNumbers.length === 0;

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      {showEmpty && (
        <div className="acct-number">
          <p className="t-body" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
            Not assigned yet
          </p>
        </div>
      )}

      {assignedNumbers.map((n) => (
        <AssignedRow key={n.id} n={n} smsStatus={smsStatus} />
      ))}

      <NumberAction
        hasPaymentMethod={hasPaymentMethod}
        entitlement={entitlement}
        areaCode={areaCode}
        postalCode={postalCode}
        onGoToBilling={onGoToBilling}
        onStartPaidPlan={onStartPaidPlan}
        startingPaidPlan={startingPaidPlan}
        paidPlanPending={paidPlanPending}
        paidPlanError={paidPlanError}
        onPurchased={onPurchased}
      />
    </div>
  );
}

function AssignedRow({
  n,
  smsStatus,
}: {
  n: AssignedBusinessNumberSummary;
  smsStatus: SmsStatus;
}) {
  const router = useRouter();
  const isLocal = n.numberType === "local";
  const scheduled = n.removalStatus === "scheduled";
  // Restore is allowed only while still scheduled, before Twilio release, and
  // before the estimated release deadline (permanentRemovalAt) passes. Mirrors the
  // server-side rule in restoreScheduledPhoneNumber().
  const restoreOpen =
    scheduled &&
    n.twilioReleaseStatus !== "released" &&
    n.permanentRemovalAt !== null &&
    new Date(n.permanentRemovalAt).getTime() > Date.now();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeAcknowledged, setRemoveAcknowledged] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreAcknowledged, setRestoreAcknowledged] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"remove" | "restore" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runAction(action: "remove" | "restore") {
    setLoadingAction(action);
    setActionError(null);
    try {
      const res = await fetch(`/api/account/phone-numbers/${n.id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        setActionError(json?.error?.message ?? "Could not update this number. Please try again.");
        setLoadingAction(null);
        return;
      }
      setConfirmRemove(false);
      setConfirmRestore(false);
      setLoadingAction(null);
      router.refresh();
    } catch {
      setActionError("Could not update this number. Please try again.");
      setLoadingAction(null);
    }
  }

  return (
    <div className="acct-number" key={n.id}>
      <span className="t-eyebrow">Phone number</span>
      <p className="t-h3 t-mono" style={{ margin: "var(--space-1) 0 0" }}>{formatUsPhone(n.phoneNumber)}</p>
      <div style={TAG_ROW}>
        <span className={`badge ${isLocal ? "badge-neutral" : "badge-info"}`}>
          {isLocal ? "Local" : "Toll-free"}
        </span>
        {scheduled && <span className="badge badge-warning">Removal scheduled</span>}
      </div>

      <dl className="acct-num-status">
        <Row label="Calls">
          {n.isActive && !scheduled ? <StatusBadge kind="active" /> : <StatusBadge kind="not_active" />}
        </Row>
        <Row label="Texting">
          {smsStatus === "active" && !scheduled ? <StatusBadge kind="active" /> : <StatusBadge kind="waiting" />}
        </Row>
        <Row label="Billing">
          <span className="t-small" style={{ color: "var(--text-muted)" }}>
            {scheduled ? "Updates next cycle" : assignedNumberBillingLabel(n.numberType, n.billingClass)}
          </span>
        </Row>
      </dl>

      {scheduled ? (
        <>
          <p className="t-small" style={{ margin: "var(--space-2) 0 0", color: "var(--text-muted)" }}>
            Calls and texts are no longer routed to your clinic.
          </p>
          {restoreOpen && n.permanentRemovalAt ? (
            <p className="t-small" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
              Restore available until {formatShortDate(n.permanentRemovalAt)}.
            </p>
          ) : (
            <p className="t-small" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
              Restore window has closed. Permanent release is pending.
            </p>
          )}
        </>
      ) : !n.isActive && (
        <p className="t-small" style={{ margin: "var(--space-2) 0 0", color: "var(--text-muted)" }}>
          This number is still assigned to your clinic and counts toward your account limit.
        </p>
      )}

      {scheduled && restoreOpen && !confirmRestore && (
        <div className="acct-num-sep">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setActionError(null);
              setRestoreAcknowledged(false);
              setConfirmRestore(true);
            }}
            disabled={loadingAction !== null}
          >
            Restore number
          </button>
        </div>
      )}

      {scheduled && restoreOpen && confirmRestore && (
        <div className="acct-cand-actions acct-num-sep">
          <div className="acct-consent">
            <div>
              <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>
                Restore number
              </p>
              <p className="t-body" style={{ margin: "var(--space-2) 0 0", fontWeight: 700 }}>
                Calls and texts will route to your clinic again.
              </p>
              <p className="t-small" style={{ margin: "var(--space-2) 0 0", color: "var(--text-secondary)" }}>
                Billing will include this number again next cycle.
              </p>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={restoreAcknowledged}
                onChange={(e) => setRestoreAcknowledged(e.target.checked)}
                disabled={loadingAction === "restore"}
              />
              <span>I understand and want to restore this number.</span>
            </label>
          </div>

          <button
            type="button"
            className="btn btn-primary acct-primary-action"
            onClick={() => void runAction("restore")}
            disabled={!restoreAcknowledged || loadingAction !== null}
            aria-busy={loadingAction === "restore"}
          >
            {loadingAction === "restore" ? "Restoring..." : "Restore number"}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ justifySelf: "center" }}
            onClick={() => {
              setConfirmRestore(false);
              setRestoreAcknowledged(false);
              setActionError(null);
            }}
            disabled={loadingAction !== null}
          >
            Cancel
          </button>

          {actionError && (
            <div className="alert alert-error" role="alert" aria-live="polite">
              <span>{actionError}</span>
            </div>
          )}
        </div>
      )}

      {!scheduled && !confirmRemove && (
        <div className="acct-num-sep">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setActionError(null);
              setRemoveAcknowledged(false);
              setConfirmRemove(true);
            }}
            disabled={loadingAction !== null}
          >
            Remove number
          </button>
        </div>
      )}

      {actionError && !confirmRemove && !confirmRestore && (
        <div className="alert alert-error" role="alert" aria-live="polite" style={{ marginTop: "var(--space-2)" }}>
          <span>{actionError}</span>
        </div>
      )}

      {!scheduled && confirmRemove && (
        <div className="acct-cand-actions acct-num-sep">
          <div className="acct-consent is-danger">
            <div>
              <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>
                Remove number
              </p>
              <p className="t-body" style={{ margin: "var(--space-2) 0 0", fontWeight: 700 }}>
                Calls and texts will stop routing to your clinic immediately.
              </p>
              <p className="t-small" style={{ margin: "var(--space-2) 0 0", color: "var(--text-secondary)" }}>
                Billing updates next cycle.
              </p>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={removeAcknowledged}
                onChange={(e) => setRemoveAcknowledged(e.target.checked)}
                disabled={loadingAction === "remove"}
              />
              <span>I understand and want to remove this number.</span>
            </label>
          </div>

          <button
            type="button"
            className="btn btn-danger acct-primary-action"
            onClick={() => void runAction("remove")}
            disabled={!removeAcknowledged || loadingAction !== null}
            aria-busy={loadingAction === "remove"}
          >
            {loadingAction === "remove" ? "Removing..." : "Remove number"}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ justifySelf: "center" }}
            onClick={() => {
              setConfirmRemove(false);
              setRemoveAcknowledged(false);
              setActionError(null);
            }}
            disabled={loadingAction !== null}
          >
            Cancel
          </button>

          {actionError && (
            <div className="alert alert-error" role="alert" aria-live="polite">
              <span>{actionError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="acct-num-status-row">
      <dt className="t-small">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

type FlowStep =
  | { step: "idle" }
  | { step: "choose" }
  | { step: "search"; type: "toll_free" | "local" };

function NumberAction({
  hasPaymentMethod,
  entitlement,
  areaCode,
  postalCode,
  onGoToBilling,
  onStartPaidPlan,
  startingPaidPlan,
  paidPlanPending,
  paidPlanError,
  onPurchased,
}: {
  hasPaymentMethod: boolean;
  entitlement: OwnerNumberEntitlement;
  areaCode: string | null;
  postalCode: string | null;
  onGoToBilling: () => void;
  onStartPaidPlan: () => void | Promise<void>;
  startingPaidPlan: boolean;
  paidPlanPending: boolean;
  paidPlanError: string | null;
  onPurchased: (n: AssignedBusinessNumberSummary) => void;
}) {
  const reason = entitlement.blockReason;
  const [flow, setFlow] = useState<FlowStep>({ step: "idle" });
  const [showPaidPlanConfirm, setShowPaidPlanConfirm] = useState(false);

  useEffect(() => {
    setShowPaidPlanConfirm(false);
  }, [reason]);

  // ── Type-independent hard blocks: no purchase of any kind is possible ────────
  if (reason === "payment_method_required" || !hasPaymentMethod) {
    return (
      <div className="acct-callout">
        <p className="t-body" style={{ margin: 0, fontWeight: 700 }}>Add a payment method to get your business number</p>
        <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
          A payment method is required before your first number. You won&apos;t be charged today.
        </p>
        <div style={{ marginTop: "var(--space-2)" }}>
          <button type="button" className="btn btn-primary acct-primary-action" onClick={onGoToBilling}>Add payment method</button>
        </div>
      </div>
    );
  }
  if (reason === "number_purchases_revoked") {
    return <Note text="New number purchases are disabled for this account. Contact support." />;
  }
  if (reason === "number_limit_reached") {
    return <Note text="You have reached your current business-number limit. Contact support to request a higher limit." />;
  }
  if (reason === "purchase_in_progress") {
    return <Note text="A number purchase is in progress. This page will update once it finishes." />;
  }
  if (reason === "billing_configuration_missing") {
    return <Note text="Adding numbers is temporarily unavailable. Please try again later." />;
  }

  // ── Otherwise the add-number flow is available ──────────────────────────────
  // reason may still be paid_plan_required / subscription_not_active, which only
  // blocks paid number assignment (handled inside the type branches).
  const tollFreeNeedsPaidPlan =
    reason === "paid_plan_required" || reason === "subscription_not_active";
  const localNeedsPaidPlan = tollFreeNeedsPaidPlan;

  if (flow.step === "idle") {
    return (
      <button type="button" className="btn btn-primary acct-primary-action" onClick={() => setFlow({ step: "choose" })}>
        Add a number
      </button>
    );
  }

  if (flow.step === "choose") {
    return (
      <NumberTypeChooser
        onChoose={(type) => setFlow({ step: "search", type })}
        onCancel={() => setFlow({ step: "idle" })}
      />
    );
  }

  // flow.step === "search"
  if (flow.type === "toll_free") {
    if (tollFreeNeedsPaidPlan) {
      return (
        <div className="acct-callout">
          <div className="acct-search-head">
            <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>Additional toll-free number</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlow({ step: "choose" })}>Back</button>
          </div>
          {reason === "subscription_not_active" ? (
            <>
              <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
                Your subscription is not active. Update billing to add another number.
              </p>
              <div style={{ marginTop: "var(--space-2)" }}>
                <button type="button" className="btn btn-primary acct-primary-action" onClick={onGoToBilling}>Go to billing</button>
              </div>
            </>
          ) : (
            <>
              <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
                {entitlement.isTrialing
                  ? "An additional toll-free number is available after you start the paid plan."
                  : "Start the paid plan to add another toll-free number."}
              </p>
              {paidPlanPending && (
                <div className="alert alert-info" role="status" aria-live="polite" style={{ marginTop: "var(--space-2)" }}>
                  <span>Your paid plan is being confirmed. This can take a few seconds.</span>
                </div>
              )}
              {paidPlanError && (
                <div className="alert alert-error" role="alert" aria-live="polite" style={{ marginTop: "var(--space-2)" }}>
                  <span>{paidPlanError}</span>
                </div>
              )}
              <div style={{ marginTop: "var(--space-2)" }}>
                <button
                  type="button"
                  className="btn btn-primary acct-primary-action"
                  onClick={() => setShowPaidPlanConfirm(true)}
                  disabled={startingPaidPlan || paidPlanPending}
                  aria-busy={startingPaidPlan || paidPlanPending}
                >
                  Start paid plan
                </button>
              </div>
              {showPaidPlanConfirm && (
                <AddPhoneNumberConfirmation
                  onClose={() => setShowPaidPlanConfirm(false)}
                  onContinue={() => void onStartPaidPlan()}
                  starting={startingPaidPlan}
                  pending={paidPlanPending}
                  error={paidPlanError}
                />
              )}
            </>
          )}
        </div>
      );
    }

    return (
      <OwnerNumberSearch
        numberType="toll_free"
        tollFreeSlotClass={entitlement.nextSlotClass}
        purchaseEnabled
        localNotice={null}
        onPurchased={onPurchased}
        onBack={() => setFlow({ step: "choose" })}
      />
    );
  }

  // flow.type === "local"
  if (localNeedsPaidPlan) {
    return (
      <div className="acct-callout">
        <div className="acct-search-head">
          <p className="t-small" style={{ margin: 0, fontWeight: 700 }}>Local number</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlow({ step: "choose" })}>Back</button>
        </div>
        {reason === "subscription_not_active" ? (
          <>
            <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
              Your subscription is not active. Update billing to assign a local number.
            </p>
            <div style={{ marginTop: "var(--space-2)" }}>
              <button type="button" className="btn btn-primary acct-primary-action" onClick={onGoToBilling}>Go to billing</button>
            </div>
          </>
        ) : (
          <>
            <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>
              Start the paid plan to assign a local number.
            </p>
            {paidPlanError && (
              <div className="alert alert-error" role="alert" aria-live="polite" style={{ marginTop: "var(--space-2)" }}>
                <span>{paidPlanError}</span>
              </div>
            )}
            <div style={{ marginTop: "var(--space-2)" }}>
              <button
                type="button"
                className="btn btn-primary acct-primary-action"
                onClick={() => setShowPaidPlanConfirm(true)}
                disabled={startingPaidPlan || paidPlanPending}
                aria-busy={startingPaidPlan || paidPlanPending}
              >
                Start paid plan
              </button>
            </div>
            {showPaidPlanConfirm && (
              <AddPhoneNumberConfirmation
                onClose={() => setShowPaidPlanConfirm(false)}
                onContinue={() => void onStartPaidPlan()}
                starting={startingPaidPlan}
                pending={paidPlanPending}
                error={paidPlanError}
              />
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <OwnerNumberSearch
      numberType="local"
      tollFreeSlotClass="additional"
      purchaseEnabled={entitlement.localBillingConfigured}
      localNotice={entitlement.localBillingConfigured ? null : LOCAL_NOTICE}
      initialAreaCode={areaCode}
      initialPostalCode={postalCode}
      onPurchased={onPurchased}
      onBack={() => setFlow({ step: "choose" })}
    />
  );
}

function AddPhoneNumberConfirmation({
  onClose,
  onContinue,
  starting,
  pending,
  error,
}: {
  onClose: () => void;
  onContinue: () => void;
  starting: boolean;
  pending: boolean;
  error: string | null;
}) {
  return (
    <ConfirmationDialog
      title="Add toll-free number"
      description="Adding another toll-free number will end your free trial and start your paid plan."
      summaryLabel="Billing summary"
      summaryRows={[
        { label: "Standard Plan", value: `${BASE_MONTHLY}/month` },
        { label: "Additional toll-free number", value: `${ADDITIONAL_MONTHLY}/month` },
        { label: "Total", value: `${ADD_NUMBER_TOTAL_MONTHLY}/month`, emphasis: true },
      ]}
      checkboxRequired
      checkboxLabel={`I understand my saved payment method will be charged ${ADD_NUMBER_TOTAL_MONTHLY}/month.`}
      primaryLabel="Continue"
      secondaryLabel="Cancel"
      loading={starting}
      pending={pending}
      error={error}
      onConfirm={onContinue}
      onCancel={onClose}
    />
  );
}


function Note({ text }: { text: string }) {
  return (
    <div className="acct-callout">
      <p className="t-small" style={{ margin: 0, color: "var(--text-secondary)" }}>{text}</p>
    </div>
  );
}

// Format a +1NXXNXXXXXX number as (NXX) NXX-XXXX for display; pass through otherwise.
function formatUsPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
