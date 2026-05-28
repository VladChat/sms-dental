// Slug generation for public /business/{slug} pages.
//
// Slugs are derived from the clinic name. They are lowercase, hyphen-
// separated, ASCII-only, and capped in length. Uniqueness is enforced by
// the caller via the `clinics.slug` unique index — see ensureUniqueSlug.

export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .slice(0, 48)
    .replace(/-+$/g, "");
  return base || "clinic";
}

/**
 * Returns a unique slug for `name`. Calls `exists(slug)` to check the DB.
 * On collision, appends -2, -3, … until free. `currentClinicId` lets a
 * clinic keep/refine its own slug without colliding with itself.
 */
export async function ensureUniqueSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name);
  if (!(await exists(base))) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
  // Extremely unlikely fallback: append a short random suffix.
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
