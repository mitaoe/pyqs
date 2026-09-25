/**
 * One JSON line per event to stdout — Vercel's log drain picks these up.
 * Privacy contract: query text and subject yes; the only client identifier
 * is the salted rate-limit hash; never raw IPs, never personal data.
 */
export function logEvent(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...fields }));
}
