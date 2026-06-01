import { getDb } from "../client";
import {
  listActiveMembershipsForClinic,
} from "../clinic-memberships";
import { listProfilesByIds } from "../profiles";
import {
  maskPhone,
  type AdminClinicDetail,
  type AdminClinicFilters,
  type AdminClinicListItem,
} from "./types";

type ClinicListRow = {
  id: string;
  name: string;
  owner_contact_email: string | null;
  is_active: boolean;
  sms_recovery_enabled: boolean;
  billing_status: string;
  setup_status: string;
  sms_status: string;
  local_number_status: string;
  created_at: Date;
  updated_at: Date;
  assigned_phone: string | null;
};

// Cross-tenant clinic list with optional server-side search/filters.
export async function listAdminClinics(
  filters: AdminClinicFilters = {},
  limit = 200,
): Promise<AdminClinicListItem[]> {
  const sql = getDb();
  const searchLike =
    filters.search && filters.search.trim() ? `%${filters.search.trim()}%` : null;
  const active = filters.active ?? null;
  const sms = filters.sms ?? null;
  const phone = filters.phone ?? null;

  const rows = await sql<ClinicListRow[]>`
    select
      c.id, c.name, c.owner_contact_email, c.is_active, c.sms_recovery_enabled,
      c.billing_status, c.setup_status, c.sms_status, c.local_number_status,
      c.created_at, c.updated_at,
      (select cpn.phone_number from public.clinic_phone_numbers cpn
        where cpn.clinic_id = c.id and cpn.is_active = true
        order by cpn.created_at asc limit 1) as assigned_phone
    from public.clinics c
    where (${searchLike}::text is null
        or c.name ilike ${searchLike}
        or coalesce(c.owner_contact_email, '') ilike ${searchLike})
      and (${active}::boolean is null or c.is_active = ${active})
      and (${sms}::boolean is null or c.sms_recovery_enabled = ${sms})
      and (${phone}::boolean is null or (exists (
            select 1 from public.clinic_phone_numbers cpn2
            where cpn2.clinic_id = c.id and cpn2.is_active = true
          )) = ${phone})
    order by c.created_at desc
    limit ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    ownerEmail: r.owner_contact_email,
    isActive: r.is_active,
    smsRecoveryEnabled: r.sms_recovery_enabled,
    hasAssignedNumber: Boolean(r.assigned_phone),
    assignedPhoneMasked: maskPhone(r.assigned_phone),
    billingStatus: r.billing_status,
    setupStatus: r.setup_status,
    smsStatus: r.sms_status,
    localNumberStatus: r.local_number_status,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }));
}

type ClinicDetailRow = {
  id: string;
  name: string;
  slug: string | null;
  is_active: boolean;
  sms_recovery_enabled: boolean;
  legal_business_name: string | null;
  business_type: string | null;
  ein_tax_id: string | null;
  main_phone: string | null;
  street_address: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string;
  website: string | null;
  business_info_completed: boolean;
  owner_contact_email: string | null;
  owner_contact_name: string | null;
  billing_status: string;
  trial_started_at: Date | null;
  trial_ends_at: Date | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  local_number_status: string;
  sms_status: string;
  a2p_info_completed: boolean;
  a2p_authorized: boolean;
  a2p_rep_email: string | null;
  setup_status: string;
  admin_internal_note: string | null;
  admin_provisioning_status: string | null;
  admin_provisioning_note: string | null;
  created_at: Date;
  updated_at: Date;
  assigned_phone: string | null;
  opt_out_count: string;
};

export async function getAdminClinicDetail(
  clinicId: string,
): Promise<AdminClinicDetail | null> {
  const sql = getDb();
  const rows = await sql<ClinicDetailRow[]>`
    select
      c.id, c.name, c.slug, c.is_active, c.sms_recovery_enabled,
      c.legal_business_name, c.business_type, c.ein_tax_id, c.main_phone,
      c.street_address, c.address_line2, c.city, c.state_region, c.postal_code,
      c.country, c.website, c.business_info_completed,
      c.owner_contact_email, c.owner_contact_name,
      c.billing_status, c.trial_started_at, c.trial_ends_at,
      c.stripe_customer_id, c.stripe_subscription_id,
      c.local_number_status, c.sms_status, c.a2p_info_completed, c.a2p_authorized,
      c.a2p_rep_email, c.setup_status,
      c.admin_internal_note, c.admin_provisioning_status, c.admin_provisioning_note,
      c.created_at, c.updated_at,
      (select cpn.phone_number from public.clinic_phone_numbers cpn
        where cpn.clinic_id = c.id and cpn.is_active = true
        order by cpn.created_at asc limit 1) as assigned_phone,
      (select count(*) from public.opt_outs o
        where o.clinic_id = c.id and o.opted_back_in_at is null)::text as opt_out_count
    from public.clinics c
    where c.id = ${clinicId}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;

  const memberships = await listActiveMembershipsForClinic(clinicId).catch(() => []);
  const profiles = await listProfilesByIds(memberships.map((m) => m.profile_id)).catch(() => []);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const members = memberships
    .map((m) => ({
      email: (byId.get(m.profile_id)?.email ?? "").toLowerCase(),
      role: m.role,
      status: m.status,
    }))
    .filter((m) => m.email.length > 0);

  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    isActive: r.is_active,
    smsRecoveryEnabled: r.sms_recovery_enabled,
    legalBusinessName: r.legal_business_name,
    businessType: r.business_type,
    einProvided: Boolean(r.ein_tax_id && r.ein_tax_id.trim().length > 0),
    mainPhoneMasked: maskPhone(r.main_phone),
    street: r.street_address,
    addressLine2: r.address_line2,
    city: r.city,
    stateRegion: r.state_region,
    postalCode: r.postal_code,
    country: r.country,
    website: r.website,
    businessInfoCompleted: r.business_info_completed,
    ownerContactEmail: r.owner_contact_email,
    ownerContactName: r.owner_contact_name,
    members,
    billingStatus: r.billing_status,
    trialStartedAt: r.trial_started_at ? r.trial_started_at.toISOString() : null,
    trialEndsAt: r.trial_ends_at ? r.trial_ends_at.toISOString() : null,
    stripeCustomerPresent: Boolean(r.stripe_customer_id),
    stripeSubscriptionPresent: Boolean(r.stripe_subscription_id),
    localNumberStatus: r.local_number_status,
    assignedPhoneMasked: maskPhone(r.assigned_phone),
    hasAssignedNumber: Boolean(r.assigned_phone),
    smsStatus: r.sms_status,
    a2pInfoCompleted: r.a2p_info_completed,
    a2pAuthorized: r.a2p_authorized,
    a2pRepProvided: Boolean(r.a2p_rep_email),
    setupStatus: r.setup_status,
    adminInternalNote: r.admin_internal_note,
    adminProvisioningStatus: r.admin_provisioning_status,
    adminProvisioningNote: r.admin_provisioning_note,
    optOutCount: Number(r.opt_out_count ?? 0),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}
