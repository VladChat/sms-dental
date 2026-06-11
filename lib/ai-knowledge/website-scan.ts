// Website scan runner for AI Front Desk facts (server-side only).
//
// Fetches the clinic's own public website (from clinics.website), extracts
// draft facts deterministically (lib/ai-knowledge/website-extract.ts), and
// stores them as 'needs_review' drafts the owner must approve. Strictly no AI
// provider calls, no browser automation, no cookies/auth, no raw HTML storage.

import { isSameOrigin, validateScanUrl } from "./scan-url-safety";
import {
  aggregatePageFacts,
  countAggregatedFacts,
  extractCandidateLinks,
  extractPageFacts,
  type PageFacts,
} from "./website-extract";
import {
  applyScanDrafts,
  completeScanRun,
  createScanRun,
} from "../db/ai-knowledge";

const MAX_PAGES = 8;
const MAX_REDIRECT_HOPS = 3;
const FETCH_TIMEOUT_MS = 8000;
const MAX_PAGE_BYTES = 1024 * 1024; // 1 MB
const SCAN_USER_AGENT = "MissedCallsDentalSiteScan/1.0 (+https://missedcallsdental.com)";

export type WebsiteScanOutcome =
  | { ok: true; pagesScanned: number; factsFound: number; reviewNotes: string | null }
  | { ok: false; reason: "no_website" | "invalid_website" | "fetch_failed" };

// The homepage may redirect between http/https and the www variant of the
// same hostname (very common). Anything else is treated as cross-origin.
function isAcceptableHomepageHost(originalHost: string, candidateHost: string): boolean {
  const a = originalHost.toLowerCase();
  const b = candidateHost.toLowerCase();
  return a === b || `www.${a}` === b || a === `www.${b}`;
}

async function readBodyCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    total += value.byteLength;
    if (total > MAX_PAGE_BYTES) {
      chunks.push(value.subarray(0, value.byteLength - (total - MAX_PAGE_BYTES)));
      try {
        await reader.cancel();
      } catch {
        // best-effort cancel
      }
      break;
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(Math.min(total, MAX_PAGE_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(combined);
}

async function discardBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // best-effort
  }
}

// Fetch one HTML page with manual, re-validated redirects, a short timeout,
// and a hard byte cap. Returns null on anything unexpected — the scan simply
// skips that page.
async function fetchHtmlPage(
  startUrl: string,
  origin: URL | null,
  originalHost: string,
): Promise<{ url: string; html: string } | null> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    const checked = validateScanUrl(current);
    if (!checked.ok) return null;
    if (origin && !isSameOrigin(checked.url, origin)) return null;
    if (!origin && !isAcceptableHomepageHost(originalHost, checked.url.hostname)) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(checked.url.href, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": SCAN_USER_AGENT,
        },
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await discardBody(res);
      if (!location) return null;
      try {
        current = new URL(location, checked.url).href;
      } catch {
        return null;
      }
      continue;
    }
    if (!res.ok) {
      await discardBody(res);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      await discardBody(res);
      return null;
    }
    const html = await readBodyCapped(res);
    return { url: checked.url.href, html };
  }
  return null;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function buildBusinessProfileNotes(
  facts: ReturnType<typeof aggregatePageFacts>,
  businessProfile: { mainPhone: string | null; postalCode: string | null },
): string[] {
  const notes: string[] = [];
  if (facts.phone && businessProfile.mainPhone) {
    const sitePhone = digitsOnly(facts.phone).slice(-10);
    const profilePhone = digitsOnly(businessProfile.mainPhone).slice(-10);
    if (sitePhone.length === 10 && profilePhone.length === 10 && sitePhone !== profilePhone) {
      notes.push(
        "Your website shows a different phone number than your Business profile. If the website is right, update Business profile.",
      );
    }
  }
  if (facts.addressText && businessProfile.postalCode) {
    const zip = businessProfile.postalCode.slice(0, 5);
    if (zip.length === 5 && !facts.addressText.includes(zip)) {
      notes.push(
        "The address on your website looks different from your Business profile address. If the website is right, update Business profile.",
      );
    }
  }
  return notes;
}

// Run a full website scan for one clinic and store draft facts. Never
// auto-approves anything and never edits the Business profile.
export async function runWebsiteScan(params: {
  clinicId: string;
  website: string | null;
  businessProfile: { mainPhone: string | null; postalCode: string | null };
}): Promise<WebsiteScanOutcome> {
  const websiteRaw = (params.website ?? "").trim();
  if (websiteRaw.length === 0) return { ok: false, reason: "no_website" };
  const checked = validateScanUrl(websiteRaw);
  if (!checked.ok) return { ok: false, reason: "invalid_website" };

  const runId = await createScanRun(params.clinicId, checked.url.href);
  try {
    const homepage = await fetchHtmlPage(checked.url.href, null, checked.url.hostname);
    if (!homepage) {
      await completeScanRun({
        runId,
        status: "failed",
        pagesScanned: 0,
        factsFound: 0,
        reviewNotes: null,
        errorMessage: "Could not load the website homepage.",
      });
      return { ok: false, reason: "fetch_failed" };
    }

    // All further pages must share the homepage's final origin.
    const scanOrigin = new URL(homepage.url);
    const pages: PageFacts[] = [extractPageFacts(homepage)];
    const candidateLinks = extractCandidateLinks(homepage.html, scanOrigin, MAX_PAGES - 1).filter(
      (link) => link !== homepage.url,
    );
    for (const link of candidateLinks) {
      if (pages.length >= MAX_PAGES) break;
      const page = await fetchHtmlPage(link, scanOrigin, scanOrigin.hostname);
      if (page) pages.push(extractPageFacts(page));
    }

    const facts = aggregatePageFacts(pages);
    const draftNotes = await applyScanDrafts(params.clinicId, facts, scanOrigin.href);
    const notes = [...buildBusinessProfileNotes(facts, params.businessProfile), ...draftNotes];
    const reviewNotes = notes.length > 0 ? notes.join(" ").slice(0, 500) : null;
    const factsFound = countAggregatedFacts(facts);

    await completeScanRun({
      runId,
      status: "completed",
      pagesScanned: pages.length,
      factsFound,
      reviewNotes,
      errorMessage: null,
    });
    return { ok: true, pagesScanned: pages.length, factsFound, reviewNotes };
  } catch {
    await completeScanRun({
      runId,
      status: "failed",
      pagesScanned: 0,
      factsFound: 0,
      reviewNotes: null,
      errorMessage: "Scan failed unexpectedly.",
    });
    return { ok: false, reason: "fetch_failed" };
  }
}
