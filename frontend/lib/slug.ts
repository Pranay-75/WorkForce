/**
 * Utility to generate and validate organization slugs matching the PostgreSQL schema:
 * CHECK (slug ~ '^[a-z0-9-]+$')
 */

export function generateSlug(name: string): string {
  if (!name) return '';
  const normalized = name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents/diacritics
    .replace(/[^a-z0-9\s-]/g, '')     // Remove non-alphanumeric chars except space and hyphen
    .replace(/\s+/g, '-')            // Replace spaces with single hyphen
    .replace(/-+/g, '-')             // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');        // Remove leading and trailing hyphens

  return normalized;
}

export function isValidSlug(slug: string): boolean {
  if (!slug) return false;
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 2 && !slug.startsWith('-') && !slug.endsWith('-');
}
