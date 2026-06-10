import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { decodeMacroHtml } from '@/lib/scrapers/vendors/realauction-macros';

// Fixtures live with the tests (moved out of scripts/probe-artifacts/, which
// is throwaway probe output and was cleaned up in M1).
const FIXTURE_DIR = path.resolve(__dirname, 'fixtures');
const FIXTURE_JSON = path.join(
  FIXTURE_DIR,
  'realforeclose-xhr-hillsborough-AREA-W-06-05-2026.json',
);
const FIXTURE_HTML = path.join(
  FIXTURE_DIR,
  'realforeclose-xhr-hillsborough-AREA-W-06-05-2026.html',
);

describe('RealAuction macro decoder', () => {
  it('round-trips a synthetic encoded snippet', () => {
    // @A → '<div class="', '@A' followed by 'foo">' should decode to '<div class="foo">'
    const encoded = '@Afoo">';
    const decoded = decodeMacroHtml(encoded);
    expect(decoded).toBe('<div class="foo">');
  });

  it('decodes the saved Hillsborough AREA-W XHR fixture exactly', () => {
    const raw = JSON.parse(readFileSync(FIXTURE_JSON, 'utf8')) as {
      retHTML: string;
      rlist: string;
    };
    const expected = readFileSync(FIXTURE_HTML, 'utf8');

    const decoded = decodeMacroHtml(raw.retHTML);

    expect(decoded).toBe(expected);
  });

  it('parses 5 AITEM_* divs from the decoded fixture', () => {
    const raw = JSON.parse(readFileSync(FIXTURE_JSON, 'utf8')) as { retHTML: string };
    const decoded = decodeMacroHtml(raw.retHTML);
    const $ = cheerio.load(decoded);
    const count = $("div[id^='AITEM_']").length;
    expect(count).toBe(5);
  });
});
