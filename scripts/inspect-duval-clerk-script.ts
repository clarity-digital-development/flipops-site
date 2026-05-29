/* eslint-disable no-console */

async function main() {
  // Inspect the AcclaimSearchPages.js source to find AJAX endpoints
  const res = await fetch("https://or.duvalclerk.com/Scripts/AcclaimSearchPages.js");
  const js = await res.text();
  console.log("Script bytes:", js.length);

  // Look for URL-like strings
  const urls = js.match(/["'](\/[A-Za-z][^"']*)["']/g) ?? [];
  const filtered = [...new Set(urls)].filter((u) =>
    /search|grid|result|find|exec|action|submit|load|json|ajax|fetch|navigate/i.test(u),
  );
  console.log("\nURLs referencing search/grid/result/etc:");
  filtered.slice(0, 25).forEach((u) => console.log("  " + u));

  // AJAX call patterns
  const ajaxCalls = js.match(/\$\.(ajax|post|get|getJSON)\s*\([\s\S]{0,250}\)/g) ?? [];
  console.log("\n$.ajax / $.post / $.get / $.getJSON calls (first 8):");
  ajaxCalls.slice(0, 8).forEach((a) => console.log("  " + a.slice(0, 300).replace(/\s+/g, " ")));

  // Look for form serialize/submit
  const submitPatterns = js.match(/(?:handleSubmit|asyncSubmit|submitSearch|doSearch|performSearch)[\s\S]{0,400}/gi) ?? [];
  console.log("\nSubmit handler patterns (first 4):");
  submitPatterns.slice(0, 4).forEach((s) => console.log("  " + s.slice(0, 400).replace(/\s+/g, " ")));

  // Look for kendo grid data source URL
  const kendoUrls = js.match(/kendoGrid[\s\S]{0,800}/gi) ?? [];
  console.log("\nKendo grid patterns (first 3):");
  kendoUrls.slice(0, 3).forEach((k) => console.log("  " + k.slice(0, 600).replace(/\s+/g, " ")));
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
