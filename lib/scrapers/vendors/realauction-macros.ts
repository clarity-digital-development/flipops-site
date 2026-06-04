/**
 * Decode RealAuction's `retHTML` envelope.
 *
 * RealAuction (realforeclose.com, realtaxdeed.com, etc.) returns AJAX
 * auction-list payloads as `{ retHTML, rlist }` JSON, where `retHTML`
 * is a wire-compacted HTML string. Twelve `@`-prefixed single-letter
 * macros stand in for common DOM substrings. The substitution table
 * is defined in `/CORE/System/JS/auction.js` on the site.
 *
 * IMPORTANT: substitutions MUST be applied longest-first to prevent
 * prefix-overlap collisions (e.g. `@A` is a prefix of nothing here,
 * but the rule keeps the decoder safe if RealAuction ever adds
 * multi-char macros). Verified with the L0 probe.
 *
 * Pairs were extracted from the live `auction.js` and confirmed
 * against captured XHR fixtures in `scripts/probe-artifacts/`.
 */

/** Macro substitutions: [encodedToken, decodedReplacement]. */
const MACRO_PAIRS_RAW: ReadonlyArray<readonly [string, string]> = [
  ['@A', '<div class="'],
  ['@B', '</div>'],
  ['@C', 'class="'],
  ['@D', '<div>'],
  ['@E', 'AUCTION'],
  ['@F', '</td><td'],
  ['@G', '</td></tr>'],
  ['@H', '<tr><td '],
  ['@I', 'table'],
  ['@J', 'p_back="NextCheck='],
  ['@K', 'style="Display:none"'],
  ['@L', '/index.cfm?zaction=auction&zmethod=details&AID='],
];

/** Sorted longest-first by replacement length (stable; prevents prefix-overlap collisions). */
const MACRO_PAIRS_SORTED: ReadonlyArray<readonly [string, string]> = [...MACRO_PAIRS_RAW].sort(
  (a, b) => b[1].length - a[1].length,
);

/**
 * Decode a RealAuction `retHTML` string into plain HTML.
 *
 * Uses `String.prototype.split` + `Array.prototype.join` per token —
 * this avoids regex-escape headaches around `"`, `<`, `&`, `=`, etc.
 *
 * @param encoded The raw `retHTML` string from a RealAuction XHR response.
 * @returns Fully decoded HTML, ready to feed to cheerio / a DOM parser.
 */
export function decodeMacroHtml(encoded: string): string {
  if (typeof encoded !== 'string' || encoded.length === 0) return '';
  let out = encoded;
  for (const [token, replacement] of MACRO_PAIRS_SORTED) {
    out = out.split(token).join(replacement);
  }
  return out;
}

/** Exposed for tests / debugging. Do NOT mutate. */
export const REALAUCTION_MACROS: ReadonlyArray<readonly [string, string]> = MACRO_PAIRS_SORTED;
