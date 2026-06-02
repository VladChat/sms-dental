import type { AvailableNumber } from "../twilio/numbers";
import {
  buildLocalNumberSearchPlan,
  runLocalNumberSearchPlan,
  type LocalNumberSearchPlanResult,
} from "../twilio/local-number-search-plan";
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
  attemptLabel: string | null;
  numbers: AvailableNumber[];
};

export async function prepareLocalNumber(
  clinic: ClinicOnboardingRow,
): Promise<LocalNumberPrepResult> {
  let result: LocalNumberSearchPlanResult = {
    candidate: null,
    attemptLabel: null,
    numbers: [],
  };
  try {
    result = await runLocalNumberSearchPlan(
      buildLocalNumberSearchPlan({
        country: clinic.country,
        mainPhone: clinic.main_phone,
        postalCode: clinic.postal_code,
        stateRegion: clinic.state_region,
      }),
    );
  } catch {
    // Twilio search is best-effort here. A failure must not block office
    // profile creation; the status simply stays "preparing".
    result = { candidate: null, attemptLabel: null, numbers: [] };
  }

  // We do not reserve or purchase here. Status stays "preparing" until the
  // purchase gate is enabled and the owner explicitly approves a purchase.
  await setLocalNumberStatus(clinic.id, "preparing");

  return result;
}
