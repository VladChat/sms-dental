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
  return { title: `SMS Terms — ${name}` };
}

export default async function BusinessSmsTermsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clinic = await findClinicBySlug(slug);
  if (!clinic) notFound();

  return (
    <PublicShell businessName={clinic.name}>
      <h1 style={h1Style}>SMS Terms</h1>
      <p style={pStyle}>
        These terms describe the missed-call text follow-up program operated by {clinic.name},
        with Missed Calls Dental (Dental SMS) acting as the technology and service provider.
      </p>

      <h2 style={h2Style}>Program description</h2>
      <p style={pStyle}>
        If you call {clinic.name} and we are unable to answer, we may send you a text message so
        our team can follow up about your call and help you. Messages relate only to your contact
        with our office.
      </p>

      <h2 style={h2Style}>Consent</h2>
      <p style={pStyle}>
        By texting our office or continuing a conversation after our follow-up message, you agree
        to receive text messages related to your inquiry. Consent is not a condition of any
        purchase.
      </p>

      <h2 style={h2Style}>Message frequency &amp; cost</h2>
      <p style={pStyle}>
        Message frequency varies based on your interaction with our office. Message and data rates
        may apply, depending on your mobile carrier and plan.
      </p>

      <h2 style={h2Style}>Opt-out &amp; help</h2>
      <p style={pStyle}>
        Reply STOP at any time to opt out of further messages. Reply HELP for help. After you send
        STOP, we will not send further texts unless you opt back in.
      </p>

      <h2 style={h2Style}>Privacy</h2>
      <p style={pStyle}>
        See our <a href={`/business/${slug}/privacy`} style={linkStyle}>Privacy Policy</a> for how
        we handle your information.
      </p>
    </PublicShell>
  );
}
