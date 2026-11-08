// Pure helpers (no Deno APIs) so they can be unit-tested with Node.
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** Lower-case, strip protocol/www/path; return null if it is not a plausible domain. */
export function normalizeDomain(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const d = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
  return d.length <= 253 && DOMAIN_RE.test(d) ? d : null;
}

export const tldOf = (domain: string): string => domain.slice(domain.lastIndexOf('.') + 1);

/** IANA RDAP bootstrap (https://data.iana.org/rdap/dns.json) -> set of TLDs that have an RDAP server. */
export function parseBootstrap(json: { services?: [string[], string[]][] }): Set<string> {
  const out = new Set<string>();
  for (const [tlds] of json.services ?? []) for (const t of tlds) out.add(t.toLowerCase());
  return out;
}

/** manual = this ending has no RDAP service, so it must be confirmed with the registry/registrar by a human. */
export type Availability = 'free' | 'taken' | 'unknown' | 'manual';

/**
 * RDAP answers 200 for a registered domain and 404 for an unregistered one, but ONLY for TLDs that
 * actually run RDAP. For any other TLD a 404 means nothing, so we say "manual" rather than guess.
 */
export function interpretRdap(domain: string, httpStatus: number, supportedTlds: Set<string>): Availability {
  if (!supportedTlds.has(tldOf(domain))) return 'manual';
  if (httpStatus === 200) return 'taken';
  if (httpStatus === 404) return 'free';
  return 'unknown';
}
