# SMS Approval Field Mapping

Status: Active
Last updated: 2026-05-28

Canonical mapping between the customer-facing onboarding UI, internal storage,
and the messaging/carrier approval ("A2P") submission fields. This is the
source of truth for which values the customer enters versus which the system
generates. See also `A2P-10DLC-COMPLIANCE-READINESS.md` and
`ONBOARDING-WORKFLOW-BUILD-GUIDE.md`.

Principles:

- Collect the minimum required data from the customer. No duplicate fields, no
  "nice to have" fields.
- If a value can be generated safely from business data + product context, the
  system generates it — the customer does not type it.
- Customer-facing UI never shows external provider/brand names or backend
  technical systems. The customer-facing section name remains
  "A2P Approval Information".

## Business Type enum (exact values)

Stored and submitted letter-for-letter. The UI shows a friendly label but the
stored/submitted value is always the enum value.

| Enum value (stored/submitted) | UI label                       |
|-------------------------------|--------------------------------|
| `PRIVATE_PROFIT` (default)    | Private company (for-profit)   |
| `PUBLIC_PROFIT`               | Public company (for-profit)    |
| `NON_PROFIT`                  | Non-profit                     |
| `SOLE_PROPRIETOR`             | Individual / sole owner        |
| `GOVERNMENT`                  | Government                     |

Default/preferred for a normal private dental clinic: `PRIVATE_PROFIT`.
Never convert to `LLC` / `Corporation` / `Partnership` / `Other` — those are
not valid values.

## Step 1 — Business Information (customer-entered)

| UI label             | Internal field (clinics.*) | Approval field            | Source            |
|----------------------|----------------------------|---------------------------|-------------------|
| Clinic name          | `name`                     | BusinessName (DBA)        | Customer          |
| Legal business name  | `legal_business_name`      | LegalBusinessName         | Customer          |
| Business Type        | `business_type`            | BusinessType (enum above) | Customer          |
| EIN                  | `ein_tax_id`               | BusinessRegistrationNumber| Customer          |
| Main office phone    | `main_phone`               | BusinessContactPhone      | Customer          |
| Street address       | `street_address`           | BusinessStreet            | Customer          |
| Address line 2       | `address_line2`            | BusinessStreetSecondary   | Customer (optional)|
| City                 | `city`                     | BusinessCity              | Customer          |
| State                | `state_region`             | BusinessStateProvince     | Customer          |
| ZIP code             | `postal_code`              | BusinessPostalCode        | Customer          |
| Website              | `website`                  | BusinessWebsite           | Customer (optional)|

Notes:

- Clinic name / main office phone / ZIP are first captured on "Create office
  profile" and are pre-filled here. They are not collected twice — Business
  Information is the single canonical edit location.
- The label is `EIN`, not `EIN / Tax ID`.

## Step 2 — A2P Approval Information (customer-entered)

| UI label   | Internal field            | Approval field        | Source   |
|------------|---------------------------|-----------------------|----------|
| First name | `a2p_rep_first_name`      | RepresentativeFirstName | Customer |
| Last name  | `a2p_rep_last_name`       | RepresentativeLastName  | Customer |
| Email      | `a2p_rep_email`           | RepresentativeEmail     | Customer |
| Phone      | `a2p_rep_phone`           | RepresentativePhone     | Customer |
| Authorization checkbox | `a2p_authorized` | (attestation)        | Customer |

Removed from the customer-editable form (do NOT collect from the customer):

- Business title → system-generated (`a2p_rep_business_title` = `Owner`).
- Use case → system-generated (see below).
- Sample message → system-generated (see below).

## System-generated / hidden values (never customer-editable)

These are generated from business data + product context. They are shown to the
customer only as read-only context where helpful, never as editable inputs.

| Approval field            | Value                                                         |
|---------------------------|---------------------------------------------------------------|
| BusinessRegistrationAuthority | `EIN`                                                     |
| BusinessRegistrationCountry   | `US`                                                      |
| BusinessCountry               | `US`                                                      |
| UseCaseCategories             | `CUSTOMER_CARE`                                           |
| UseCaseSummary                | Generated missed-call follow-up explanation              |
| ProductionMessageSample       | Generated from clinic name                               |
| OptInType                     | System value                                             |
| MessageVolume                 | System estimate                                          |
| AdditionalInformation         | Generated compliance explanation                         |
| HelpMessageSample             | Generated                                                |
| OptInKeywords                 | `START`                                                  |
| PrivacyPolicyUrl              | Generated `/business/{slug}/privacy`                     |
| TermsAndConditionsUrl         | Generated `/business/{slug}/sms-terms`                   |
| AgeGatedContent               | `false`                                                  |
| Representative title          | `Owner` (system default)                                 |

## Generated compliance pages

The setup UI shows these as a "Generated compliance pages" card with
View / Copy link actions (not raw path pills):

- Business profile — `/business/{slug}`
- Privacy policy — `/business/{slug}/privacy`
- SMS terms — `/business/{slug}/sms-terms`

All three pages render from one source of truth (the `clinics` row) — business
name, legal name, phone, and address are not stored separately per page.
