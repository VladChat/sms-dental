import {
  phoneAreaCode,
  searchAvailableLocalNumbers,
  type AvailableNumber,
  type RequiredCapabilities,
  type SearchAvailableLocalNumbersInput,
  type SupportedCountry,
} from "./numbers";

export type LocalNumberSearchAttempt = {
  label: string;
  input: SearchAvailableLocalNumbersInput;
};

export type LocalNumberSearchPlanInput = {
  country?: SupportedCountry | null;
  mainPhone?: string | null;
  areaCode?: string | null;
  postalCode?: string | null;
  stateRegion?: string | null;
  contains?: string | null;
  required?: Partial<RequiredCapabilities>;
  limit?: number;
};

export type LocalNumberSearchPlanResult = {
  candidate: AvailableNumber | null;
  attemptLabel: string | null;
  numbers: AvailableNumber[];
};

const LOCAL_NUMBER_SEARCH_LIMIT = 10;
const RADIUS_SEARCH_MILES = [25, 50, 100] as const;

export function buildLocalNumberSearchPlan(
  input: LocalNumberSearchPlanInput,
): LocalNumberSearchAttempt[] {
  if ((input.country ?? "US") !== "US") return [];

  const areaCode =
    normalizeAreaCode(input.areaCode) ??
    (input.mainPhone ? phoneAreaCode(input.mainPhone) ?? undefined : undefined);
  const postalCode = normalizeUsZip(input.postalCode);
  const stateRegion = normalizeUsStateRegion(input.stateRegion);
  const contains = normalizeContains(input.contains);
  const zipCoordinates = resolveUsZipCoordinates(postalCode);

  const attempts: LocalNumberSearchAttempt[] = [];

  if (areaCode && postalCode) {
    attempts.push({
      label: "area_code_and_zip",
      input: baseLocalSearchInput(input, { areaCode, inPostalCode: postalCode, contains }),
    });
  }

  if (postalCode) {
    attempts.push({
      label: "zip_only",
      input: baseLocalSearchInput(input, { inPostalCode: postalCode, contains }),
    });
  }

  if (areaCode) {
    attempts.push({
      label: "area_code_only",
      input: baseLocalSearchInput(input, { areaCode, contains }),
    });
  }

  if (zipCoordinates) {
    const nearLatLong = formatNearLatLong(zipCoordinates);
    for (const distance of RADIUS_SEARCH_MILES) {
      attempts.push({
        label: `zip_radius_${distance}_miles`,
        input: baseLocalSearchInput(input, { nearLatLong, distance, contains }),
      });
    }
  }

  if (stateRegion) {
    attempts.push({
      label: "state_region",
      input: baseLocalSearchInput(input, { inRegion: stateRegion, contains }),
    });
  }

  if (attempts.length === 0) {
    attempts.push({
      label: contains ? "contains_only" : "local_default",
      input: baseLocalSearchInput(input, { contains }),
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
  plan: LocalNumberSearchPlanInput,
  input: Omit<SearchAvailableLocalNumbersInput, "country" | "limit" | "required">,
): SearchAvailableLocalNumbersInput {
  return {
    country: "US",
    ...input,
    required: plan.required,
    limit: plan.limit ?? LOCAL_NUMBER_SEARCH_LIMIT,
  };
}

function normalizeAreaCode(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return /^\d{3}$/.test(trimmed) ? trimmed : undefined;
}

function normalizeUsZip(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  const match = /^(\d{5})(?:-\d{4})?$/.exec(trimmed);
  return match?.[1];
}

function normalizeUsStateRegion(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : undefined;
}

function normalizeContains(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

type ZipCoordinates = { latitude: number; longitude: number };

function resolveUsZipCoordinates(zip: string | undefined): ZipCoordinates | null {
  if (!zip) return null;
  // Radius fallback intentionally requires a committed ZIP coordinate source.
  // Onboarding/admin search must not call an external geocoder or ask the user
  // for location fields just to run Twilio search.
  return null;
}

function formatNearLatLong(coords: ZipCoordinates): string {
  return `${coords.latitude},${coords.longitude}`;
}
