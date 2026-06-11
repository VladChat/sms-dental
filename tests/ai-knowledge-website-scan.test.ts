import assert from "node:assert/strict";
import test from "node:test";

import {
  isSameOrigin,
  sanitizeSameOriginLink,
  validateScanUrl,
} from "../lib/ai-knowledge/scan-url-safety";
import {
  MAX_EXCERPT_LENGTH,
  aggregatePageFacts,
  extractCandidateLinks,
  extractJsonLdNodes,
  extractPageFacts,
  parseHoursLine,
  stripHtmlToText,
} from "../lib/ai-knowledge/website-extract";

// --------------------------------------------------------------- URL safety

test("scan URL rejects localhost, private IPs, and internal hosts", () => {
  for (const bad of [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1",
    "https://10.0.0.5",
    "https://192.168.1.10/site",
    "https://172.16.0.1",
    "https://169.254.1.1",
    "http://[::1]",
    "https://intranet",
    "https://server.local",
    "https://files.internal",
    "https://8.8.8.8", // all IP literals are rejected, public ones included
  ]) {
    const result = validateScanUrl(bad);
    assert.equal(result.ok, false, `should reject: ${bad}`);
  }
});

test("scan URL rejects non-http(s) schemes, credentials, and odd ports", () => {
  for (const bad of [
    "ftp://example.com",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "data:text/html,hello",
    "https://user:pass@example.com",
    "https://example.com:8080",
  ]) {
    const result = validateScanUrl(bad);
    assert.equal(result.ok, false, `should reject: ${bad}`);
  }
});

test("scan URL accepts public websites and assumes https for bare domains", () => {
  const withScheme = validateScanUrl("https://www.example.com/about");
  assert.ok(withScheme.ok);
  const bare = validateScanUrl("example.com");
  assert.ok(bare.ok);
  assert.equal(bare.url.protocol, "https:");
});

test("links must stay same-origin and use document schemes", () => {
  const base = new URL("https://www.example.com/");
  assert.ok(isSameOrigin(base, new URL("https://www.example.com/contact")));
  assert.equal(sanitizeSameOriginLink("/contact", base), "https://www.example.com/contact");
  assert.equal(sanitizeSameOriginLink("https://other-site.example.com/contact", base), null);
  assert.equal(sanitizeSameOriginLink("javascript:alert(1)", base), null);
  assert.equal(sanitizeSameOriginLink("mailto:owner@example.com", base), null);
  assert.equal(sanitizeSameOriginLink("tel:+15551234567", base), null);
});

test("candidate links are keyword-filtered, same-origin, and deduplicated", () => {
  const base = new URL("https://www.example.com/");
  const html = `
    <a href="/contact">Contact Us</a>
    <a href="/contact">Contact again</a>
    <a href="/our-services">What we do</a>
    <a href="/blog">Blog</a>
    <a href="https://elsewhere.example.org/insurance">Insurance</a>
    <a href="/insurance">Insurance</a>
  `;
  const links = extractCandidateLinks(html, base, 8);
  assert.deepEqual(links, [
    "https://www.example.com/contact",
    "https://www.example.com/our-services",
    "https://www.example.com/insurance",
  ]);
});

// ---------------------------------------------------------------- stripping

test("script and style content never reaches extracted text", () => {
  const text = stripHtmlToText(
    "<html><head><style>.x{color:red}</style><script>var secret=1;</script></head>" +
      "<body><p>We offer cleanings.</p></body></html>",
  );
  assert.ok(text.includes("We offer cleanings."));
  assert.ok(!text.includes("secret"));
  assert.ok(!text.includes("color:red"));
});

// ------------------------------------------------------------------ JSON-LD

const JSON_LD_PAGE = `
<html><head><script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Dentist",
  "name": "Example Dental",
  "telephone": "(555) 123-4567",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "Springfield",
    "addressRegion": "IL",
    "postalCode": "62704"
  },
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday"], "opens": "08:00", "closes": "17:00" }
  ]
}
</script></head><body><h1>Welcome</h1></body></html>`;

test("JSON-LD business data yields phone, address, and hours drafts", () => {
  const nodes = extractJsonLdNodes(JSON_LD_PAGE);
  assert.ok(nodes.length >= 1);

  const facts = extractPageFacts({ url: "https://www.example.com/", html: JSON_LD_PAGE });
  assert.equal(facts.phone, "(555) 123-4567");
  assert.ok(facts.addressText?.includes("123 Main St"));
  assert.ok(facts.addressText?.includes("62704"));
  const monday = facts.hours.find((h) => h.weekday === 1);
  assert.ok(monday);
  assert.equal(monday.opensAt, "08:00");
  assert.equal(monday.closesAt, "17:00");
  assert.equal(monday.confidence, 0.9);
});

// --------------------------------------------------------------- text hours

test("parseHoursLine handles ranges, lists, closed days, and ambiguity", () => {
  const range = parseHoursLine("Mon - Fri: 8am - 5pm");
  assert.equal(range.length, 5);
  assert.equal(range[0].opensAt, "08:00");
  assert.equal(range[0].closesAt, "17:00");

  const closed = parseHoursLine("Saturday: Closed");
  assert.equal(closed.length, 1);
  assert.equal(closed[0].weekday, 6);
  assert.equal(closed[0].closed, true);

  const twentyFour = parseHoursLine("Tuesday 09:00 - 18:00");
  assert.equal(twentyFour.length, 1);
  assert.equal(twentyFour[0].opensAt, "09:00");

  const inferred = parseHoursLine("Wednesday 8 - 5pm");
  assert.equal(inferred.length, 1);
  assert.equal(inferred[0].opensAt, "08:00");
  assert.equal(inferred[0].closesAt, "17:00");

  assert.equal(parseHoursLine("Thursday 8 - 5").length, 0); // too ambiguous
  assert.equal(parseHoursLine("Call us any time").length, 0);
});

test("visible-text hours populate weekday drafts", () => {
  const html = `<html><body>
    <h2>Office Hours</h2>
    <p>Monday - Thursday: 8:00 AM - 5:00 PM</p>
    <p>Friday: 8:00 AM - 1:00 PM</p>
    <p>Saturday: Closed</p>
  </body></html>`;
  const facts = extractPageFacts({ url: "https://www.example.com/hours", html });
  const monday = facts.hours.find((h) => h.weekday === 1);
  const friday = facts.hours.find((h) => h.weekday === 5);
  const saturday = facts.hours.find((h) => h.weekday === 6);
  assert.ok(monday && monday.opensAt === "08:00" && monday.closesAt === "17:00");
  assert.ok(friday && friday.closesAt === "13:00");
  assert.ok(saturday && saturday.closed);
});

// --------------------------------------------------- services and insurance

test("known service names are extracted from page text", () => {
  const html = `<html><body>
    <h2>Our Services</h2>
    <ul><li>Invisalign clear aligners</li><li>Root canal therapy</li><li>Teeth whitening</li></ul>
  </body></html>`;
  const facts = extractPageFacts({ url: "https://www.example.com/services", html });
  const keys = facts.services.map((s) => s.key);
  assert.ok(keys.includes("invisalign_clear_aligners"));
  assert.ok(keys.includes("root_canals"));
  assert.ok(keys.includes("whitening"));
});

test("known insurance names are extracted from page text", () => {
  const html = `<html><body>
    <p>We accept Delta Dental, Aetna, Cigna, and Blue Cross Blue Shield.</p>
  </body></html>`;
  const facts = extractPageFacts({ url: "https://www.example.com/insurance", html });
  const keys = facts.insurancePlans.map((p) => p.key);
  assert.ok(keys.includes("delta_dental"));
  assert.ok(keys.includes("aetna"));
  assert.ok(keys.includes("cigna"));
  assert.ok(keys.includes("blue_cross_blue_shield"));
});

test("payment options and languages are detected", () => {
  const html = `<html><body>
    <p>We offer CareCredit and flexible payment plans. We speak Spanish and Russian.</p>
  </body></html>`;
  const facts = extractPageFacts({ url: "https://www.example.com/", html });
  assert.equal(facts.payment.carecredit, true);
  assert.equal(facts.payment.paymentPlans, true);
  assert.equal(facts.payment.financing, false);
  assert.ok(facts.languages.includes("Spanish"));
  assert.ok(facts.languages.includes("Russian"));
});

// ------------------------------------------------------ excerpts + aggregate

test("stored excerpts are short and never raw HTML", () => {
  const bigHtml = `<html><body><div>${"filler text ".repeat(500)}<p>We accept Aetna insurance for most procedures and <b>Delta Dental</b> plans.</p>${"more filler ".repeat(500)}</div></body></html>`;
  const facts = extractPageFacts({ url: "https://www.example.com/", html: bigHtml });
  assert.ok(facts.insurancePlans.length >= 2);
  for (const match of facts.insurancePlans) {
    assert.ok(match.excerpt.length <= MAX_EXCERPT_LENGTH);
    assert.ok(!match.excerpt.includes("<"), "excerpt must not contain HTML");
  }
});

test("aggregation merges pages and deduplicates facts", () => {
  const homepage = extractPageFacts({
    url: "https://www.example.com/",
    html: "<html><body><p>We accept Aetna. Emergency dental care available. Now accepting new patients!</p></body></html>",
  });
  const insurancePage = extractPageFacts({
    url: "https://www.example.com/insurance",
    html: "<html><body><p>We accept Aetna and Cigna.</p></body></html>",
  });
  const aggregated = aggregatePageFacts([homepage, insurancePage]);
  assert.equal(aggregated.insurancePlans.filter((p) => p.key === "aetna").length, 1);
  assert.ok(aggregated.insurancePlans.some((p) => p.key === "cigna"));
  assert.equal(aggregated.acceptingNewPatients, true);
  assert.equal(aggregated.emergencyAppointments, true);
  assert.equal(aggregated.sourceUrlByFact.get("insurance:aetna"), "https://www.example.com/");
  assert.equal(aggregated.sourceUrlByFact.get("insurance:cigna"), "https://www.example.com/insurance");
});
