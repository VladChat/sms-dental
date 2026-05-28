import {
  searchAvailableLocalNumbers,
  type AvailableNumber,
} from "../twilio/numbers";
import { phoneAreaCode } from "../twilio/numbers";
import {
  setLocalNumberStatus,
  type ClinicOnboardingRow,
} from "../db/clinics";

// Automatic local-number preparation for the Business Profile flow.
//
// The customer never picks a number from a catalog. After the office profile
// is created we automatically search for the best local U.S. candidate near
// the clinic's ZIP code (falling back to the area code of the main phone).
//
// SAFETY: this is read-only. It NEVER purchases or reserves a live Twilio
// number. Reservation/purchase stays behind the existing purchase gate
// (TWILIO_NUMBER_PURCHASE_ENABLED) + explicit owner approval in the purchase
// route. While the gate is disabled, we only confirm a candidate exists and
// keep the customer-facing status at "preparing".

export type LocalNumberPrepResult = {
  candidate: AvailableNumber | null;
};

export async function prepareLocalNumber(
  clinic: ClinicOnboardingRow,
): Promise<LocalNumberPrepResult> {
  const areaCode = clinic.main_phone
    ? phoneAreaCode(clinic.main_phone) ?? undefined
    : undefined;
  const postalCode = clinic.postal_code ?? undefined;

  let candidate: AvailableNumber | null = null;
  try {
    // Prefer ZIP-scoped results; if none, retry with just the area code.
    let numbers = await searchAvailableLocalNumbers({
      country: "US",
      areaCode,
      inPostalCode: postalCode,
      limit: 5,
    });
    if (numbers.length === 0 && (areaCode || postalCode)) {
      numbers = await searchAvailableLocalNumbers({
        country: "US",
        areaCode,
        limit: 5,
      });
    }
    candidate = numbers[0] ?? null;
  } catch {
    // Twilio search is best-effort here. A failure must not block office
    // profile creation; the status simply stays "preparing".
    candidate = null;
  }

  // We do not reserve or purchase here. Status stays "preparing" until the
  // purchase gate is enabled and the owner explicitly approves a purchase.
  await setLocalNumberStatus(clinic.id, "preparing");

  return { candidate };
}
