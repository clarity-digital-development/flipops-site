# RealForeclose.com DOM analysis — 2026-06-03

Probe: `scripts/inspect-realauction-dom.ts` against
`duval.realforeclose.com` and `hillsborough.realforeclose.com`
with `AuctionDate=06/04/2026` (the next-day calendar — today 06/03/2026
has zero scheduled cases on both counties).

## Probe shape (this is new — production scraper does NOT do this)

The PREVIEW landing URL ships only a SCAFFOLD. Auction rows are loaded
into `<div id="Area_W" arid="W">` (waiting), `<div id="Area_R" arid="R">`
(running), and `<div id="Area_C" arid="C">` (closed) by XHR _after_
the page loads. Direct fetch of the landing URL therefore returns 0
`.ad_tab` rows even on a date with real auctions.

XHR endpoint:
```
GET /index.cfm?zaction=AUCTION&Zmethod=UPDATE&FNC=LOAD&AREA=W&AuctionDate=MM%2FDD%2FYYYY
Cookie: <session cookies from the splash GET — cfid, cftoken, AWSALB, AWSALBCORS, CF_CLIENT_*>
X-Requested-With: XMLHttpRequest
Referer: <splash URL>
```
Without the session cookies the same endpoint returns
`{"retHTML":"","rlist":""}` (201 bytes) — silently empty, NOT 401/403.

Response body is `{"retHTML": "<compressed>", "rlist": "id1,id2,..."}`.
`retHTML` is run through the macro table in
`/CORE/System/JS/auction.js` (lines 8-20). Verbatim map:

```
@A  -> <div class="
@B  -> </div>
@C  -> class="
@D  -> <div>
@E  -> AUCTION
@F  -> </td><td
@G  -> </td></tr>
@H  -> <tr><td
@I  -> table
@J  -> p_back="NextCheck=
@K  -> style="Display:none"
@L  -> /index.cfm?zaction=auction&zmethod=details&AID=
```

## DOM structure after decode (CONSISTENT across Duval + Hillsborough)

Each auction row is:
```
<div id="AITEM_{aid}" class="AUCTION_ITEM PREVIEW" aid="{aid}" rem="0" isset="0">
  <div class="AUCTION_STATS">                            <-- live status (blank on preview)
    <div class="ASTAT_MSGA ASTAT_LBL"></div>             <-- "Auction Starts" written CLIENT-SIDE by auction.js aTMP.A_A
    <div class="ASTAT_MSGB Astat_DATA"></div>            <-- live time, populated on poll
    <div class="ASTAT_MSGC ASTAT_LBL"></div>
    <div class="ASTAT_MSGD Astat_DATA"></div>
    <div class="ASTAT_MSG_SOLDTO_Label ASTAT_LBL"></div>
    <div class="ASTAT_MSG_SOLDTO_MSG Astat_DATA"></div>
  </div>
  <div class="AUCTION_DETAILS">
    <table class="ad_tab">
      <tbody>
        <tr><td class="AD_LBL">Auction Type:</td>           <td class="AD_DTA">FORECLOSURE</td></tr>
        <tr><td class="AD_LBL">Case #:</td>                 <td class="AD_DTA"><a href="...clerk...">16-2025-CA-005751-AXXX-MA</a></td></tr>
        <tr><td class="AD_LBL">Final Judgment Amount:</td>  <td class="AD_DTA">$139,493.42</td></tr>
        <tr><td class="AD_LBL">Parcel ID:</td>              <td class="AD_DTA"><a href="...pao/Detail.aspx?RE=...">035892-0000</a></td></tr>
        <tr><td class="AD_LBL">Property Address:</td>       <td class="AD_DTA">9256 5TH AVE</td></tr>
        <tr><td class="AD_LBL"></td>                        <td class="AD_DTA">JACKSONVILLE, FL- 32208</td></tr>
        <tr><td class="AD_LBL">Assessed Value:</td>         <td class="AD_DTA">$92,567.00</td></tr>
        <tr><td class="AD_LBL">Plaintiff Max Bid:</td>      <td class="AD_DTA ASTAT_MSGPB">Hidden</td></tr>
      </tbody>
    </table>
  </div>
</div>
```

Hillsborough sample (`AID=1498599`) is structurally identical, including
the 22-char Hillsborough APN format `21300836P000002000020U`.

## Stable selectors

| Field                  | Container                | Cells                                                       |
|------------------------|--------------------------|-------------------------------------------------------------|
| auction row scope      | `div[id^="AITEM_"]`      | one row per auction                                         |
| `auctionStarts` (date) | URL param `AuctionDate`  | NOT in DOM until JS polls; banner shows `.BLHeaderDateDisplay` |
| `auctionStarts` (time) | per-row `.ASTAT_MSGB.Astat_DATA` | empty in preview, populated by poll once auction is running |
| `caseNumber`           | `tr` where `td.AD_LBL = "Case #:"` | `td.AD_DTA` text or `td.AD_DTA a` text                |
| `finalJudgmentAmount`  | `tr` where `td.AD_LBL = "Final Judgment Amount:"` | `td.AD_DTA` text, parse `$`                 |
| `apn` (parcelId)       | `tr` where `td.AD_LBL = "Parcel ID:"` | `td.AD_DTA a` text (preferred — strips spaces) or `td.AD_DTA` text |
| `plaintiffMaxBid`      | `tr` where `td.AD_LBL = "Plaintiff Max Bid:"` | `td.AD_DTA.ASTAT_MSGPB` text (may be "Hidden") |
| `address` (line 1)     | `tr` where `td.AD_LBL = "Property Address:"` | `td.AD_DTA` text                              |
| `address` (line 2)     | NEXT `tr` where `td.AD_LBL` is EMPTY | `td.AD_DTA` text — city/state/zip                       |

## Hillsborough/Duval "Property Appraiser" APN bug — root cause

The splash page (NOT the XHR payload) contains a left-nav menu with
`<span class="LN_MT">Property Appraiser</span>` (verified in
`realforeclose-duval-2026-06-03.html` line `<div class="LN_MI"><a href="..."><span class="LN_MT">Property Appraiser</span></a></div>`).
The current parser in `realauction-playwright.ts:69` walks `body *`
across the ENTIRE rendered DOM (splash skeleton + injected auction
rows). On counties where the per-row `td.AD_DTA a` is empty or the
loop misaligns (Hillsborough's longer APN with `P` mid-string can
hit a parser-state corner), the next `<a>` text the parser captures
is the nav menu's "Property Appraiser" anchor text — that's how the
label leaks into the APN column.

Secondary contributor: the current parser uses
`$(tr).find("a").text().trim() || value` (line 97). On the Address
continuation row (row[5] above) `td.AD_LBL` is empty — if the regex
fall-through logic doesn't skip empty labels, it can pull `<a>` from
the WRONG row.

## Parser recommendation

Rewrite the parser to scope to `[id^="AITEM_"]` ONLY (never walk the
full splash body), then per-AITEM iterate `table.ad_tab tr`:

```ts
$(retHtml).find("div[id^='AITEM_']").each((_, item) => {
  const $item = $(item);
  const aid = $item.attr("aid");
  const row: AuctionRow = { aid };
  $item.find("table.ad_tab > tbody > tr").each((_, tr) => {
    const $tr = $(tr);
    const label = $tr.find("td.AD_LBL").first().text().trim().replace(/:$/, "");
    const $data = $tr.find("td.AD_DTA").first();
    if (!label) return;                          // skip address continuation rows
    const linkText = $data.find("a").first().text().trim();
    const value = linkText || $data.text().trim();
    switch (label) {
      case "Auction Type":         row.auctionType = value; break;
      case "Case #":               row.caseNumber = value; break;
      case "Final Judgment Amount": row.finalJudgmentAmount = parseDollar(value); break;
      case "Parcel ID":            row.apn = value; break;   // never falls back to outer DOM
      case "Property Address":     row.addressLine1 = value; break;
      case "Assessed Value":       row.assessedValue = parseDollar(value); break;
      case "Plaintiff Max Bid":    row.plaintiffMaxBid = value === "Hidden" ? null : parseDollar(value); break;
    }
  });
  // auctionDate comes from the request URL param — pass it in, don't derive from DOM
  row.auctionStarts = requestedAuctionDate;
  auctions.push(row);
});
```

Plus: fetch via the XHR endpoint with the session cookie + macro
decode — drop Playwright entirely. 1 splash GET + 3 XHR GETs (R/W/C)
per county per date, ~5KB each. ~1-2 seconds per county.
