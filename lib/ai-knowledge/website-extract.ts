// Deterministic website fact extraction for the AI Front Desk facts scan.
//
// Pure string/JSON parsing only — no AI provider calls, no network access, no
// DOM/browser automation. The scan runner fetches pages; this module turns a
// page's HTML into short draft facts (hours, services, insurance, payment,
// languages, phone/address) with short excerpts. Raw HTML is never stored;
// callers persist only the structured facts + excerpts returned here.

import {
  DEFAULT_INSURANCE_PLANS,
  DEFAULT_SERVICES,
  type AiFactCatalogItem,
} from "../../config/ai-front-desk-facts.config";
import { sanitizeSameOriginLink } from "./scan-url-safety";

export const MAX_EXCERPT_LENGTH = 160;

export type HoursDraft = {
  weekday: number; // 0 = Sunday … 6 = Saturday
  closed: boolean;
  opensAt: string | null; // "HH:MM"
  closesAt: string | null;
  excerpt: string;
  confidence: number;
};

export type KeyMatch = { key: string; excerpt: string; confidence: number };

export type PageFacts = {
  url: string;
  phone: string | null;
  addressText: string | null;
  hours: HoursDraft[];
  services: KeyMatch[];
  insurancePlans: KeyMatch[];
  payment: {
    paymentPlans: boolean;
    financing: boolean;
    carecredit: boolean;
    alphaeonCredit: boolean;
    membershipPlan: boolean;
    bankTransferAch: boolean;
    excerpt: string | null;
  };
  languages: string[];
  acceptingNewPatients: boolean;
  emergencyAppointments: boolean;
  // A clean new-patient form LINK (absolute, same-origin), or null. Never a
  // page text excerpt.
  newPatientFormLink: string | null;
};

export type AggregatedFacts = Omit<PageFacts, "url"> & { sourceUrlByFact: Map<string, string> };

// ------------------------------------------------------------- HTML helpers

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ndash;": "–",
  "&mdash;": "—",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number(code);
      return Number.isFinite(n) && n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : " ";
    })
    .replace(/&[a-z]+;|&#\d+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ");
}

// Reduce an HTML document to readable line-oriented text. Scripts/styles are
// dropped entirely; block-level closers become line breaks so hour tables and
// lists keep one fact per line.
export function stripHtmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = withoutBlocks
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer|table|ul|ol|dd|dt)>/gi, "\n")
    .replace(/<(br|hr)\s*\/?\s*>/gi, "\n");
  const withoutTags = withBreaks.replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutTags)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export function makeExcerpt(text: string, index: number, matchLength: number): string {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + matchLength + 60);
  let excerpt = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (excerpt.length > MAX_EXCERPT_LENGTH) {
    excerpt = excerpt.slice(0, MAX_EXCERPT_LENGTH - 1).trimEnd();
  }
  return `${start > 0 ? "…" : ""}${excerpt}${end < text.length ? "…" : ""}`.slice(
    0,
    MAX_EXCERPT_LENGTH,
  );
}

// ----------------------------------------------------------- link discovery

const CANDIDATE_LINK_KEYWORDS = [
  "contact",
  "hours",
  "location",
  "service",
  "insurance",
  "payment",
  "financ",
  "patient",
  "forms",
  "about",
  "appointment",
];

// Find same-origin links worth scanning (contact/hours/services/… pages).
export function extractCandidateLinks(html: string, base: URL, maxLinks: number): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  const anchorRe = /<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]{0,300}?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) !== null && links.length < maxLinks) {
    const href = match[2] ?? match[3] ?? "";
    const text = stripHtmlToText(match[4] ?? "").toLowerCase();
    const sanitized = sanitizeSameOriginLink(href, base);
    if (!sanitized || seen.has(sanitized)) continue;
    const path = new URL(sanitized).pathname.toLowerCase();
    const haystack = `${path} ${text}`;
    if (!CANDIDATE_LINK_KEYWORDS.some((keyword) => haystack.includes(keyword))) continue;
    seen.add(sanitized);
    links.push(sanitized);
  }
  return links;
}

// ----------------------------------------------------------------- JSON-LD

type JsonLdNode = Record<string, unknown>;

function flattenJsonLd(value: unknown, out: JsonLdNode[]): void {
  if (Array.isArray(value)) {
    for (const item of value) flattenJsonLd(item, out);
    return;
  }
  if (value && typeof value === "object") {
    const node = value as JsonLdNode;
    out.push(node);
    if (node["@graph"]) flattenJsonLd(node["@graph"], out);
  }
}

export function extractJsonLdNodes(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const scriptRe = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html)) !== null) {
    try {
      flattenJsonLd(JSON.parse(decodeEntities(match[1] ?? "")), nodes);
    } catch {
      // Malformed JSON-LD is common; skip the block.
    }
  }
  return nodes;
}

const BUSINESS_TYPES = new Set([
  "dentist",
  "dentalclinic",
  "localbusiness",
  "medicalbusiness",
  "medicalclinic",
  "organization",
  "healthandbeautybusiness",
]);

function isBusinessNode(node: JsonLdNode): boolean {
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some(
    (t) => typeof t === "string" && BUSINESS_TYPES.has(t.toLowerCase().replace(/^https?:\/\/schema\.org\//, "")),
  );
}

const DAY_NAME_TO_WEEKDAY: Record<string, number> = {
  sunday: 0, sun: 0, su: 0,
  monday: 1, mon: 1, mo: 1,
  tuesday: 2, tues: 2, tue: 2, tu: 2,
  wednesday: 3, wed: 3, we: 3,
  thursday: 4, thurs: 4, thur: 4, thu: 4, th: 4,
  friday: 5, fri: 5, fr: 5,
  saturday: 6, sat: 6, sa: 6,
};

function weekdayFromToken(token: string): number | null {
  const cleaned = token.toLowerCase().replace(/^https?:\/\/schema\.org\//, "").replace(/[^a-z]/g, "");
  return DAY_NAME_TO_WEEKDAY[cleaned] ?? null;
}

function normalizeJsonLdTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function hoursFromJsonLd(node: JsonLdNode, excerptBase: string): HoursDraft[] {
  const drafts: HoursDraft[] = [];
  const spec = node.openingHoursSpecification;
  const specs = Array.isArray(spec) ? spec : spec ? [spec] : [];
  for (const rawEntry of specs) {
    const entry = rawEntry as JsonLdNode;
    const opensAt = normalizeJsonLdTime(entry.opens);
    const closesAt = normalizeJsonLdTime(entry.closes);
    if (!opensAt || !closesAt || opensAt >= closesAt) continue;
    const days = Array.isArray(entry.dayOfWeek) ? entry.dayOfWeek : [entry.dayOfWeek];
    for (const day of days) {
      if (typeof day !== "string") continue;
      const weekday = weekdayFromToken(day);
      if (weekday === null) continue;
      drafts.push({
        weekday,
        closed: false,
        opensAt,
        closesAt,
        excerpt: excerptBase,
        confidence: 0.9,
      });
    }
  }
  const openingHours = node.openingHours;
  const openingStrings = Array.isArray(openingHours)
    ? openingHours
    : typeof openingHours === "string"
      ? [openingHours]
      : [];
  for (const line of openingStrings) {
    if (typeof line !== "string") continue;
    for (const draft of parseHoursLine(line)) {
      drafts.push({ ...draft, excerpt: line.slice(0, MAX_EXCERPT_LENGTH), confidence: 0.9 });
    }
  }
  return drafts;
}

function addressFromJsonLd(node: JsonLdNode): string | null {
  const rawAddress = Array.isArray(node.address) ? node.address[0] : node.address;
  if (!rawAddress) return null;
  if (typeof rawAddress === "string") return rawAddress.slice(0, MAX_EXCERPT_LENGTH);
  const address = rawAddress as JsonLdNode;
  const parts = [
    address.streetAddress,
    address.addressLocality,
    address.addressRegion,
    address.postalCode,
  ].filter((part): part is string => typeof part === "string" && part.trim().length > 0);
  if (parts.length === 0) return null;
  return parts.join(", ").slice(0, MAX_EXCERPT_LENGTH);
}

// ------------------------------------------------------------ text parsing

const DAY_TOKEN = "(?:sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)";
const TIME_TOKEN = "(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)?";

const HOURS_LINE_RE = new RegExp(
  `^(${DAY_TOKEN})(?:\\s*[-–—]\\s*(${DAY_TOKEN})|((?:\\s*,\\s*${DAY_TOKEN})*))\\s*[:.]?\\s*` +
    `(?:(closed)|${TIME_TOKEN}\\s*(?:[-–—]|to)\\s*${TIME_TOKEN})\\s*$`,
  "i",
);

function to24h(hourRaw: string, minuteRaw: string | undefined, meridiem: string | undefined): string | null {
  let hour = Number(hourRaw);
  const minute = minuteRaw ? Number(minuteRaw) : 0;
  if (!Number.isInteger(hour) || hour > 23 || minute > 59) return null;
  const m = meridiem?.toLowerCase().replace(/[^apm]/g, "");
  if (m === "pm" && hour < 12) hour += 12;
  if (m === "am" && hour === 12) hour = 0;
  // Without a meridiem, bare hours like "8 - 5" are ambiguous; the caller
  // resolves them. Hours with minutes ("13:00") are taken as 24h.
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Parse one human-readable hours line, e.g. "Mon - Fri: 8am - 5pm",
// "Saturday: Closed", "Mo-Fr 08:00-17:00", "Tuesday 9:00 AM to 6:00 PM".
export function parseHoursLine(line: string): Omit<HoursDraft, "excerpt" | "confidence">[] {
  const cleaned = line.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0 || cleaned.length > 120) return [];
  const match = HOURS_LINE_RE.exec(cleaned);
  if (!match) return [];

  const startDay = weekdayFromToken(match[1] ?? "");
  if (startDay === null) return [];
  const weekdays: number[] = [startDay];
  if (match[2]) {
    const endDay = weekdayFromToken(match[2]);
    if (endDay === null) return [];
    let current = startDay;
    while (current !== endDay) {
      current = (current + 1) % 7;
      weekdays.push(current);
      if (weekdays.length > 7) return [];
    }
  } else if (match[3]) {
    for (const part of match[3].split(",")) {
      const day = weekdayFromToken(part);
      if (day !== null && !weekdays.includes(day)) weekdays.push(day);
    }
  }

  if (match[4]) {
    return weekdays.map((weekday) => ({ weekday, closed: true, opensAt: null, closesAt: null }));
  }

  const openHour = match[5];
  const openMinute = match[6];
  let openMeridiem = match[7];
  const closeHour = match[8];
  const closeMinute = match[9];
  const closeMeridiem = match[10];
  if (!openHour || !closeHour) return [];

  // "8 - 5pm" style: infer the opening meridiem from the closing one.
  if (!openMeridiem && closeMeridiem) {
    openMeridiem = Number(openHour) >= Number(closeHour) ? "am" : closeMeridiem;
  }
  // Bare "8 - 5" with no meridiem anywhere and no minutes is too ambiguous.
  if (!openMeridiem && !closeMeridiem && !openMinute && !closeMinute) return [];

  const opensAt = to24h(openHour, openMinute, openMeridiem);
  const closesAt = to24h(closeHour, closeMinute, closeMeridiem);
  if (!opensAt || !closesAt || opensAt >= closesAt) return [];
  return weekdays.map((weekday) => ({ weekday, closed: false, opensAt, closesAt }));
}

function hoursFromText(text: string): HoursDraft[] {
  const drafts: HoursDraft[] = [];
  for (const line of text.split("\n")) {
    for (const parsed of parseHoursLine(line)) {
      drafts.push({
        ...parsed,
        excerpt: line.slice(0, MAX_EXCERPT_LENGTH),
        confidence: 0.7,
      });
    }
    if (drafts.length >= 21) break; // 7 days × 3 intervals is more than enough
  }
  return drafts;
}

const PHONE_RE = /(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;

const ADDRESS_RE =
  /\b\d{1,6}\s+[A-Za-z][A-Za-z0-9.' -]{2,50}\b(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Parkway|Pkwy|Highway|Hwy)\b\.?[^\n]{0,60}/i;

function matchCatalogItems(
  lowerText: string,
  text: string,
  catalog: readonly AiFactCatalogItem[],
): KeyMatch[] {
  const matches: KeyMatch[] = [];
  for (const item of catalog) {
    const terms = [item.label.toLowerCase(), ...(item.scanKeywords ?? [])];
    for (const term of terms) {
      const index = lowerText.indexOf(term);
      if (index >= 0) {
        matches.push({ key: item.key, excerpt: makeExcerpt(text, index, term.length), confidence: 0.6 });
        break;
      }
    }
  }
  return matches;
}

const LANGUAGE_NAMES = [
  "Spanish", "French", "Portuguese", "Russian", "Ukrainian", "Polish", "German",
  "Italian", "Mandarin", "Cantonese", "Chinese", "Vietnamese", "Korean",
  "Japanese", "Arabic", "Hindi", "Urdu", "Tagalog", "Farsi", "Greek", "Hebrew",
  "Romanian", "Turkish",
];

// Extract a new-patient form LINK from anchors only — never page text. The
// anchor text or the href path must clearly identify a new-patient form, and
// the link must resolve to a safe same-origin URL. When nothing clean is
// found, returns null (the field is left blank rather than guessed).
export function extractNewPatientFormLink(html: string, base: URL): string | null {
  const anchorRe = /<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) !== null) {
    const href = match[2] ?? match[3] ?? "";
    const sanitized = sanitizeSameOriginLink(href, base);
    if (!sanitized) continue;
    const text = stripHtmlToText(match[4] ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const hrefPath = `${new URL(sanitized).pathname}`.toLowerCase();

    const textIsForm =
      (/\bnew[\s-]*patient/.test(text) && /\b(form|forms|paperwork|packet|registration|document)\b/.test(text)) ||
      /\b(patient forms|patient paperwork|new patient registration|new patient packet)\b/.test(text);
    const hrefIsForm =
      /new[-_]?patient/.test(hrefPath) && /(form|paperwork|packet|registration|\.pdf)/.test(hrefPath);

    if (textIsForm || hrefIsForm) {
      return sanitized.slice(0, 300);
    }
  }
  return null;
}

function languagesFromText(text: string, lowerText: string): string[] {
  const found = new Set<string>();
  if (/se habla espa|hablamos espa/.test(lowerText)) found.add("Spanish");
  const contextRe = /(?:we speak|languages? spoken|languages?:)\s*([^.\n]{1,120})/gi;
  let match: RegExpExecArray | null;
  while ((match = contextRe.exec(text)) !== null) {
    const segment = (match[1] ?? "").toLowerCase();
    for (const language of LANGUAGE_NAMES) {
      if (segment.includes(language.toLowerCase())) found.add(language);
    }
  }
  return [...found];
}

// ------------------------------------------------------------ page extract

export function extractPageFacts(input: { url: string; html: string }): PageFacts {
  const text = stripHtmlToText(input.html);
  const lowerText = text.toLowerCase();
  const jsonLdNodes = extractJsonLdNodes(input.html).filter(isBusinessNode);

  let phone: string | null = null;
  let addressText: string | null = null;
  let hours: HoursDraft[] = [];

  for (const node of jsonLdNodes) {
    if (!phone && typeof node.telephone === "string" && node.telephone.trim().length > 0) {
      phone = node.telephone.trim().slice(0, 40);
    }
    if (!addressText) addressText = addressFromJsonLd(node);
    if (hours.length === 0) hours = hoursFromJsonLd(node, "Listed business hours from your website");
  }

  if (!phone) {
    const phoneMatch = PHONE_RE.exec(text);
    if (phoneMatch) phone = phoneMatch[0].trim();
  }
  if (!addressText) {
    const addressMatch = ADDRESS_RE.exec(text);
    if (addressMatch) addressText = addressMatch[0].replace(/\s+/g, " ").trim().slice(0, MAX_EXCERPT_LENGTH);
  }
  if (hours.length === 0) hours = hoursFromText(text);

  const paymentPlans = lowerText.includes("payment plan");
  const financing = lowerText.includes("financing") || lowerText.includes("finance options");
  const carecredit = lowerText.includes("carecredit") || lowerText.includes("care credit");
  const alphaeonCredit = lowerText.includes("alphaeon");
  const membershipPlan =
    lowerText.includes("membership plan") ||
    lowerText.includes("membership program") ||
    lowerText.includes("in-house membership") ||
    lowerText.includes("in-house plan");
  // Bank transfer / ACH requires an explicit mention ("ACH" as a word, or
  // "bank transfer" — which also covers "electronic/direct bank transfer").
  // Never inferred from generic wording like "convenient payment options",
  // and peer-to-peer apps (Zelle etc.) are never mapped to anything.
  const bankTransferAch = /\bach\b/.test(lowerText) || lowerText.includes("bank transfer");
  let paymentExcerpt: string | null = null;
  if (paymentPlans || financing || carecredit || alphaeonCredit || membershipPlan || bankTransferAch) {
    const indices = ["payment plan", "financing", "carecredit", "care credit", "alphaeon", "membership plan", "bank transfer"]
      .map((term) => lowerText.indexOf(term));
    const achMatch = /\bach\b/.exec(lowerText);
    if (achMatch) indices.push(achMatch.index);
    const index = indices.filter((i) => i >= 0).sort((a, b) => a - b)[0];
    if (index !== undefined) paymentExcerpt = makeExcerpt(text, index, 12);
  }

  let newPatientFormLink: string | null = null;
  try {
    newPatientFormLink = extractNewPatientFormLink(input.html, new URL(input.url));
  } catch {
    newPatientFormLink = null;
  }

  return {
    url: input.url,
    phone,
    addressText,
    hours,
    services: matchCatalogItems(lowerText, text, DEFAULT_SERVICES),
    insurancePlans: matchCatalogItems(lowerText, text, DEFAULT_INSURANCE_PLANS),
    payment: { paymentPlans, financing, carecredit, alphaeonCredit, membershipPlan, bankTransferAch, excerpt: paymentExcerpt },
    languages: languagesFromText(text, lowerText),
    acceptingNewPatients:
      /accepting new patients|welcoming new patients|new patients (?:are )?welcome|now accepting patients/i.test(text),
    emergencyAppointments:
      /dental emergenc|emergency (?:dental|dentist|appointment|care|service)/i.test(text),
    newPatientFormLink,
  };
}

// ------------------------------------------------------------- aggregation

export function aggregatePageFacts(pages: PageFacts[]): AggregatedFacts {
  const sourceUrlByFact = new Map<string, string>();
  const serviceByKey = new Map<string, KeyMatch>();
  const insuranceByKey = new Map<string, KeyMatch>();
  const hoursByWeekday = new Map<number, HoursDraft[]>();
  const languages = new Set<string>();

  const result: AggregatedFacts = {
    phone: null,
    addressText: null,
    hours: [],
    services: [],
    insurancePlans: [],
    payment: { paymentPlans: false, financing: false, carecredit: false, alphaeonCredit: false, membershipPlan: false, bankTransferAch: false, excerpt: null },
    languages: [],
    acceptingNewPatients: false,
    emergencyAppointments: false,
    newPatientFormLink: null,
    sourceUrlByFact,
  };

  for (const page of pages) {
    if (!result.phone && page.phone) {
      result.phone = page.phone;
      sourceUrlByFact.set("phone", page.url);
    }
    if (!result.addressText && page.addressText) {
      result.addressText = page.addressText;
      sourceUrlByFact.set("address", page.url);
    }
    if (hoursByWeekday.size === 0 && page.hours.length > 0) {
      for (const draft of page.hours) {
        const list = hoursByWeekday.get(draft.weekday) ?? [];
        if (list.length < 3 && !list.some((d) => d.opensAt === draft.opensAt && d.closesAt === draft.closesAt)) {
          list.push(draft);
          hoursByWeekday.set(draft.weekday, list);
        }
      }
      sourceUrlByFact.set("hours", page.url);
    }
    for (const match of page.services) {
      if (!serviceByKey.has(match.key)) {
        serviceByKey.set(match.key, match);
        sourceUrlByFact.set(`service:${match.key}`, page.url);
      }
    }
    for (const match of page.insurancePlans) {
      if (!insuranceByKey.has(match.key)) {
        insuranceByKey.set(match.key, match);
        sourceUrlByFact.set(`insurance:${match.key}`, page.url);
      }
    }
    if (page.payment.paymentPlans) result.payment.paymentPlans = true;
    if (page.payment.financing) result.payment.financing = true;
    if (page.payment.carecredit) result.payment.carecredit = true;
    if (page.payment.alphaeonCredit) result.payment.alphaeonCredit = true;
    if (page.payment.membershipPlan) result.payment.membershipPlan = true;
    if (page.payment.bankTransferAch) result.payment.bankTransferAch = true;
    if (!result.payment.excerpt && page.payment.excerpt) {
      result.payment.excerpt = page.payment.excerpt;
      sourceUrlByFact.set("payment", page.url);
    }
    for (const language of page.languages) languages.add(language);
    if (page.acceptingNewPatients && !result.acceptingNewPatients) {
      result.acceptingNewPatients = true;
      sourceUrlByFact.set("accepting_new_patients", page.url);
    }
    if (page.emergencyAppointments && !result.emergencyAppointments) {
      result.emergencyAppointments = true;
      sourceUrlByFact.set("emergency_appointments", page.url);
    }
    if (!result.newPatientFormLink && page.newPatientFormLink) {
      result.newPatientFormLink = page.newPatientFormLink;
      sourceUrlByFact.set("new_patient_forms", page.url);
    }
  }

  result.hours = [...hoursByWeekday.entries()]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([, drafts]) => drafts);
  result.services = [...serviceByKey.values()];
  result.insurancePlans = [...insuranceByKey.values()];
  result.languages = [...languages];
  return result;
}

// Count the distinct facts an aggregate contains (for the scan run log).
export function countAggregatedFacts(facts: AggregatedFacts): number {
  let count = facts.services.length + facts.insurancePlans.length;
  const weekdays = new Set(facts.hours.map((h) => h.weekday));
  count += weekdays.size > 0 ? 1 : 0;
  if (facts.phone) count += 1;
  if (facts.addressText) count += 1;
  if (facts.payment.paymentPlans) count += 1;
  if (facts.payment.financing) count += 1;
  if (facts.payment.carecredit) count += 1;
  if (facts.payment.alphaeonCredit) count += 1;
  if (facts.payment.membershipPlan) count += 1;
  if (facts.payment.bankTransferAch) count += 1;
  count += facts.languages.length > 0 ? 1 : 0;
  if (facts.acceptingNewPatients) count += 1;
  if (facts.emergencyAppointments) count += 1;
  if (facts.newPatientFormLink) count += 1;
  return count;
}
