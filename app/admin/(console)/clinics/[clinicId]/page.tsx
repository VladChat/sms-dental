import Link from "next/link";
import { getAdminClinicDetail } from "../../../../../lib/db/admin/clinics";
import { listAdminAuditEvents } from "../../../../../lib/db/admin/audit";
import { getClinicEvents } from "../../../../../lib/db/admin/events";
import { getAppDomainsSafe, getSmsRecoveryConfig, getTwilioNumberPurchaseMode } from "../../../../../lib/env";
import { phoneAreaCode } from "../../../../../lib/twilio/numbers";
import { buildA2pReviewPackage } from "../../../../../lib/a2p/review-package";
import { AdminClinicConsole } from "./_components/AdminClinicConsole";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server data-loader. All cross-tenant reads happen here (service-role DB + env);
// the editable, tabbed console is the client component AdminClinicConsole, which
// receives only serializable data. No mutations occur on load.
export default async function AdminClinicDetailPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const d = await getAdminClinicDetail(clinicId).catch(() => null);

  if (!d) {
    return (
      <section className="card card-pad">
        <h1 className="t-h3">Clinic not found</h1>
        <p style={{ marginTop: "var(--space-4)" }}>
          <Link className="link" href="/admin/clinics">← Back to clinics</Link>
        </p>
      </section>
    );
  }

  const [activityRows, events, a2pReview] = await Promise.all([
    listAdminAuditEvents({ clinicId: d.id }, 5).catch(() => []),
    getClinicEvents(d.id, 5).catch(() => ({ calls: [], messages: [] })),
    buildA2pReviewPackage(d.id),
  ]);

  const recentActivity = activityRows.map((e) => ({
    id: e.id,
    action: e.action,
    adminEmail: e.admin_email,
    createdAt: new Date(e.created_at).toISOString(),
  }));

  // Prefilled add-number search defaults (never a hidden restriction): preferred
  // area code, else derived from a US main phone (+1AAA…). No hardcoded codes.
  const derivedAreaCode = d.mainPhone ? phoneAreaCode(d.mainPhone) ?? "" : "";
  const phoneDefaults = {
    areaCode: d.preferredAreaCode ?? derivedAreaCode,
    postal: d.postalCode ?? "",
  };

  return (
    <AdminClinicConsole
      data={{
        detail: d,
        smsMode: getSmsRecoveryConfig().mode, // mode only — never the allowlist
        appBaseUrl: getAppDomainsSafe()?.appBaseUrl ?? "",
        purchaseEnabled: getTwilioNumberPurchaseMode() !== "disabled",
        phoneDefaults,
        recentActivity,
        events,
        a2pReview,
      }}
    />
  );
}
