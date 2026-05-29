/* eslint-disable no-console */

async function main() {
  const r = await fetch("https://or.duvalclerk.com/search/SearchTypeRecordDate");
  const html = await r.text();
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/gi)].map((m) => m[1]);
  console.log("Script srcs on page:");
  scripts.forEach((s) => console.log("  " + s));

  // Find Sys.Mvc references — try to download MicrosoftMvcAjax
  const mvc = scripts.find((s) => /MicrosoftMvcAjax|MicrosoftAjax|jquery.unobtrusive|jquery.validate.unobtrusive/i.test(s));
  if (mvc) {
    const fullUrl = new URL(mvc, "https://or.duvalclerk.com").toString();
    console.log("\nDownloading", fullUrl);
    const r2 = await fetch(fullUrl);
    const js = await r2.text();
    console.log("Length:", js.length);
    // Find handleSubmit
    const hs = js.match(/handleSubmit[\s\S]{0,2000}/);
    if (hs) {
      console.log("\nhandleSubmit body:");
      console.log(hs[0].slice(0, 2000));
    }
  }
}

main().catch((e) => console.error(e.message));
