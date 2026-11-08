import { interpretRdap, parseBootstrap, type Availability } from './domain.ts';

let cache: { at: number; tlds: Set<string> } | null = null;

export async function supportedTlds(fetchFn: typeof fetch = fetch): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < 24 * 3600_000) return cache.tlds;
  const res = await fetchFn('https://data.iana.org/rdap/dns.json');
  if (!res.ok) throw new Error('rdap bootstrap unavailable');
  cache = { at: Date.now(), tlds: parseBootstrap(await res.json()) };
  return cache.tlds;
}

/** Best-effort availability check. NOT authoritative: the registrar has the final say at purchase time. */
export async function checkDomain(domain: string, fetchFn: typeof fetch = fetch): Promise<Availability> {
  try {
    const tlds = await supportedTlds(fetchFn);
    const res = await fetchFn(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      redirect: 'follow', signal: AbortSignal.timeout(6000), headers: { accept: 'application/rdap+json' },
    });
    await res.body?.cancel();
    return interpretRdap(domain, res.status, tlds);
  } catch {
    return 'unknown';
  }
}
export const _resetCache = () => { cache = null; };
