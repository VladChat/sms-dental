import {
  searchAvailableLocalNumbers,
  type AvailableNumber,
  type SearchAvailableLocalNumbersInput,
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
  attemptLabel: string | null;
  numbers: AvailableNumber[];
};

export type LocalNumberSearchAttempt = {
  label: string;
  input: SearchAvailableLocalNumbersInput;
};

export type LocalNumberSearchPlanResult = {
  candidate: AvailableNumber | null;
  attemptLabel: string | null;
  numbers: AvailableNumber[];
};

const LOCAL_NUMBER_SEARCH_LIMIT = 10;
const RADIUS_SEARCH_MILES = [25, 50, 100] as const;

export async function prepareLocalNumber(
  clinic: ClinicOnboardingRow,
): Promise<LocalNumberPrepResult> {
  let result: LocalNumberSearchPlanResult = {
    candidate: null,
    attemptLabel: null,
    numbers: [],
  };
  try {
    result = await runLocalNumberSearchPlan(buildLocalNumberSearchPlan(clinic));
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

export function buildLocalNumberSearchPlan(
  clinic: ClinicOnboardingRow,
): LocalNumberSearchAttempt[] {
  if (clinic.country !== "US") return [];

  const areaCode = clinic.main_phone
    ? phoneAreaCode(clinic.main_phone) ?? undefined
    : undefined;
  const postalCode = normalizeUsZip(clinic.postal_code);
  const stateRegion = normalizeUsStateRegion(clinic.state_region);
  const zipCoordinates = resolveUsZipCoordinates(postalCode);

  const attempts: LocalNumberSearchAttempt[] = [];

  if (areaCode && postalCode) {
    attempts.push({
      label: "area_code_and_zip",
      input: baseLocalSearchInput({ areaCode, inPostalCode: postalCode }),
    });
  }

  if (postalCode) {
    attempts.push({
      label: "zip_only",
      input: baseLocalSearchInput({ inPostalCode: postalCode }),
    });
  }

  if (areaCode) {
    attempts.push({
      label: "area_code_only",
      input: baseLocalSearchInput({ areaCode }),
    });
  }

  if (zipCoordinates) {
    const nearLatLong = formatNearLatLong(zipCoordinates);
    for (const distance of RADIUS_SEARCH_MILES) {
      attempts.push({
        label: `zip_radius_${distance}_miles`,
        input: baseLocalSearchInput({ nearLatLong, distance }),
      });
    }
  }

  if (stateRegion) {
    attempts.push({
      label: "state_region",
      input: baseLocalSearchInput({ inRegion: stateRegion }),
    });
  }

  return attempts;
}

export async function runLocalNumberSearchPlan(
  attempts: LocalNumberSearchAttempt[],
): Promise<LocalNumberSearchPlanResult> {
  for (const attempt of attempts) {
    let numbers: AvailableNumber[];
    try {
      numbers = await searchAvailableLocalNumbers(attempt.input);
    } catch {
      continue;
    }
    if (numbers.length > 0) {
      return {
        candidate: numbers[0] ?? null,
        attemptLabel: attempt.label,
        numbers,
      };
    }
  }

  return { candidate: null, attemptLabel: null, numbers: [] };
}

function baseLocalSearchInput(
  input: Omit<SearchAvailableLocalNumbersInput, "country" | "limit">,
): SearchAvailableLocalNumbersInput {
  return {
    country: "US",
    ...input,
    limit: LOCAL_NUMBER_SEARCH_LIMIT,
  };
}

function normalizeUsZip(value: string | null): string | undefined {
  const trimmed = value?.trim() ?? "";
  const match = /^(\d{5})(?:-\d{4})?$/.exec(trimmed);
  return match?.[1];
}

function normalizeUsStateRegion(value: string | null): string | undefined {
  const trimmed = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : undefined;
}

type ZipCoordinates = { latitude: number; longitude: number };

function resolveUsZipCoordinates(zip: string | undefined): ZipCoordinates | null {
  if (!zip) return null;
  // Radius fallback intentionally requires a committed ZIP coordinate source.
  // Onboarding must not call an external geocoder or ask the customer for
  // location fields just to run Twilio search.
  return null;
}

function formatNearLatLong(coords: ZipCoordinates): string {
  return `${coords.latitude},${coords.longitude}`;
}
