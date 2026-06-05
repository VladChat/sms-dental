import Link from "next/link";
import { getAdminClinicDetail } from "../../../../../../../lib/db/admin/clinics";
import { getTwilioNumberPurchaseMode } from "../../../../../../../lib/env";
import { phoneAreaCode } from "../../../../../../../lib/twilio/numbers";
import { AdminPhoneNumberManager } from "../../_components/AdminPhoneNumberManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Dedicated admin add-number screen. Lives under the `(console)` route group, so
// the platform-admin guard in app/admin/(console)/layout.tsx applies. Server
// data-loader only: it loads the clinic + phone-search defaults and renders the
// search/assignment client UI. The existing purchase gate is enforced in the API.
export default async function AdminAddNumberPage({
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

  // Prefilled defaults only (never a hidden restriction): preferred area code,
  // else derived from a US main phone (+1AAA…). No hardcoded area codes.
  const derivedAreaCode = d.mainPhone ? phoneAreaCode(d.mainPhone) ?? "" : "";
  const defaults = {
    areaCode: d.preferredAreaCode ?? derivedAreaCode,
    postal: d.postalCode ?? "",
  };

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <header>
        <p className="t-small">
          <Link className="link" href={`/admin/clinics/${d.id}`}>← Phone number</Link>
        </p>
        <h1 className="t-h2" style={{ marginTop: "var(--space-1)" }}>Add a number</h1>
        <p className="t-small" style={{ color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
          {d.name}
        </p>
      </header>

      <section className="card card-pad">
        <AdminPhoneNumberManager
          clinicId={d.id}
          purchaseEnabled={getTwilioNumberPurchaseMode() !== "disabled"}
          defaults={defaults}
        />
      </section>
    </div>
  );
}
