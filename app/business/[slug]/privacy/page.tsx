import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findClinicBySlug } from "../../../../lib/db/clinics";
import { PublicShell, h1Style, h2Style, pStyle, linkStyle } from "../_components/Shell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await findClinicBySlug(slug);
  const name = clinic?.name ?? "Business";
  return { title: `Privacy Policy — ${name}` };
}

export default async function BusinessPrivacyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clinic = await findClinicBySlug(slug);
  if (!clinic) notFound();

  return (
    <PublicShell businessName={clinic.name}>
      <h1 style={h1Style}>Privacy Policy</h1>
      <p style={pStyle}>
        This policy explains how {clinic.name} (&ldquo;we&rdquo;) handles information in connection
        with our missed-call text follow-up program. Missed Calls Dental (Dental SMS) acts as our
        technology and service provider.
      </p>

      <h2 style={h2Style}>Information we collect</h2>
      <p style={pStyle}>
        When you call our office and we miss your call, we collect your phone number and the
        content of any text messages you exchange with us so our team can follow up. We do not
        sell your information.
      </p>

      <h2 style={h2Style}>How we use information</h2>
      <p style={pStyle}>
        We use your phone number and message content only to respond to your contact with our
        office and to operate the missed-call follow-up program. We do not use it for unrelated
        marketing.
      </p>

      <h2 style={h2Style}>Sharing</h2>
      <p style={pStyle}>
        We share information with our technology and service provider (Missed Calls Dental /
        Dental SMS) and with the messaging carriers needed to deliver texts. We may disclose
        information where required by law.
      </p>

      <h2 style={h2Style}>Your choices</h2>
      <p style={pStyle}>
        Reply STOP at any time to opt out of text messages. Reply HELP for help. Message and data
        rates may apply.
      </p>

      <h2 style={h2Style}>Contact</h2>
      <p style={pStyle}>
        {clinic.main_phone ? <>You can reach our office at {clinic.main_phone}. </> : null}
        See also our <a href={`/business/${slug}/sms-terms`} style={linkStyle}>SMS Terms</a>.
      </p>
    </PublicShell>
  );
}
