import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findClinicBySlug } from "../../../lib/db/clinics";
import { PublicShell, formatAddress, h1Style, h2Style, pStyle, linkStyle } from "./_components/Shell";

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
  return {
    title: `${name} — Missed-call text follow-up`,
    description: `Missed-call SMS follow-up program for ${name}.`,
  };
}

export default async function BusinessPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clinic = await findClinicBySlug(slug);
  if (!clinic) notFound();

  const address = formatAddress({
    street: clinic.street_address,
    city: clinic.city,
    state: clinic.state_region,
    zip: clinic.postal_code,
  });

  return (
    <PublicShell businessName={clinic.name}>
      <h1 style={h1Style}>{clinic.name}</h1>

      <h2 style={h2Style}>Business information</h2>
      <p style={pStyle}>
        Public name: {clinic.name}
        {clinic.legal_business_name ? (
          <>
            <br />
            Legal business name: {clinic.legal_business_name}
          </>
        ) : null}
        {address ? (
          <>
            <br />
            Address: {address}
          </>
        ) : null}
        {clinic.main_phone ? (
          <>
            <br />
            Phone: {clinic.main_phone}
          </>
        ) : null}
        {clinic.website ? (
          <>
            <br />
            Website:{" "}
            <a href={clinic.website} style={linkStyle} rel="noopener noreferrer">
              {clinic.website}
            </a>
          </>
        ) : null}
      </p>

      <h2 style={h2Style}>How we use SMS</h2>
      <p style={pStyle}>
        When you call {clinic.name} and we miss your call, we may send you a text message so our
        team can follow up and help you. Messages relate only to your contact with our office.
      </p>

      <h2 style={h2Style}>Opt-out and help</h2>
      <p style={pStyle}>
        Reply STOP at any time to opt out of text messages. Reply HELP for help. Message and data
        rates may apply. Message frequency varies based on your interaction with our office.
      </p>

      <h2 style={h2Style}>Policies</h2>
      <p style={pStyle}>
        <a href={`/business/${slug}/privacy`} style={linkStyle}>Privacy Policy</a>
        {"  ·  "}
        <a href={`/business/${slug}/sms-terms`} style={linkStyle}>SMS Terms</a>
      </p>
    </PublicShell>
  );
}
