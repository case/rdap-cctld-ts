import { parseArgs } from "@std/cli/parse-args";
import { Table } from "@cliffy/table";
import {
  download_iana_rdap_bootstrap,
  download_iana_root_zone_db,
  download_iana_tlds,
  build_and_save_tlds_json,
} from "./main.ts";
import {
  getBootstrapVsRootZoneComparison,
  getSourceFilesAnalysis,
  getRdapBootstrapAnalysis,
  getRdapCoverageAnalysis,
  getRootZoneAnalysis,
  getTldsAnalysis,
  getTldsVsRootZoneComparison,
} from "./api/index.ts";
import { load } from "@std/dotenv";

// Load environment variables from .env file if it exists
await load({ export: true });

/**
 * Create a table with consistent styling (border with header separator only)
 */
function createTable() {
  return new Table()
    .border(true)
    .chars({
      mid: "",
      leftMid: "",
      midMid: "",
      rightMid: "",
    });
}

/**
 * Valid data source types
 */
const SOURCE_TYPES = [
  "rdap-bootstrap",
  "tlds-txt",
  "root-zone-db-html",
  "bootstrap-vs-rootdb",
  "tlds-vs-rootdb",
] as const;

type SourceType = typeof SOURCE_TYPES[number];

/**
 * Main CLI entry point
 */
async function main() {
  const args = parseArgs(Deno.args, {
    boolean: ["help", "build"],
    string: ["download", "analyze"],
    alias: {
      h: "help",
      d: "download",
      a: "analyze",
      b: "build",
    },
  });

  // Show help if no command provided or --help flag
  if (args.help || (args.download === undefined && args.analyze === undefined && !args.build)) {
    console.log(`
Usage: deno run src/cli.ts [options]

Options:
  --download [type], -d [type]     Download IANA data file(s)
  --analyze [type], -a [type]      Analyze IANA data file(s)
    Types:
      (none)               Download/analyze all data sources
      rdap-bootstrap       IANA RDAP bootstrap file (JSON)
      tlds-txt             IANA TLD list (text)
      root-zone-db-html    IANA Root Zone Database (HTML)
      bootstrap-vs-rootdb  Compare RDAP bootstrap vs Root Zone DB
      tlds-vs-rootdb       Compare TLDs txt vs Root Zone DB
  --build, -b                      Build enhanced tlds.json file
  --help, -h                       Show this help message

Examples:
  deno task cli --download
  deno task cli --download rdap-bootstrap
  deno task cli --download tlds-txt
  deno task cli --analyze
  deno task cli --analyze rdap-bootstrap
  deno task cli --analyze bootstrap-vs-rootdb
  deno task cli --analyze tlds-vs-rootdb
  deno task cli --build
  deno task cli -d
  deno task cli -d rdap-bootstrap
  deno task cli -a tlds-txt
  deno task cli -b
    `);
    return;
  }

  // Handle build command
  if (args.build) {
    await build_and_save_tlds_json();
    return;
  }

  // Handle download command
  if (args.download !== undefined) {
    const sourceType = args.download as string | boolean;

    // If no specific type provided, download all three files
    if (sourceType === true || sourceType === "") {
      console.log("Downloading all IANA data files...\n");
      await download_iana_tlds();
      await download_iana_rdap_bootstrap();
      await download_iana_root_zone_db();
      console.log("\nAll downloads complete!");
      return;
    }

    // Specific source type provided
    if (!SOURCE_TYPES.includes(sourceType as SourceType)) {
      console.error(`Error: Invalid source type '${sourceType}'`);
      console.error(
        `Valid types: ${SOURCE_TYPES.join(", ")}`,
      );
      Deno.exit(1);
    }

    switch (sourceType as SourceType) {
      case "rdap-bootstrap":
        await download_iana_rdap_bootstrap();
        break;
      case "tlds-txt":
        await download_iana_tlds();
        break;
      case "root-zone-db-html":
        await download_iana_root_zone_db();
        break;
    }
  }

  // Handle analyze command
  if (args.analyze !== undefined) {
    const sourceType = args.analyze as string | boolean;

    // If no specific type provided, show comparison of all sources
    if (sourceType === true || sourceType === "") {
      const analysis = await getSourceFilesAnalysis();
      const { tldsFile: tldsAnalysis, rdapBootstrap: rdapAnalysis, rootZoneDb: rootZoneAnalysis, rdapCoverage, tldsJson: tldsJsonAnalysis } = analysis;

      console.log("\n╔═══════════════════════════════════════════════════════════════╗");
      console.log("║                TLD Data Sources Comparison                    ║");
      console.log("╚═══════════════════════════════════════════════════════════════╝");
      console.log();

      // Calculate RDAP coverage percentages
      const totalPct = Math.round((rdapAnalysis.total / rootZoneAnalysis.delegatedCounts.total) * 100);
      const ccTldPct = Math.round((rdapAnalysis.ccTlds / rootZoneAnalysis.delegatedCounts.ccTlds) * 100);
      const gTldPct = Math.round((rdapAnalysis.gTlds / rootZoneAnalysis.delegatedCounts.gTlds) * 100);

      // Calculate RDAP coverage for TLDs JSON (built)
      const tldsJsonRdapPct = Math.round((tldsJsonAnalysis.tldsWithRdap / tldsJsonAnalysis.total) * 100);
      const tldsJsonCcTldPct = Math.round((tldsJsonAnalysis.ccTldsWithRdap / tldsJsonAnalysis.ccTlds) * 100);
      const tldsJsonGTldPct = Math.round((tldsJsonAnalysis.gTldsWithRdap / tldsJsonAnalysis.gTlds) * 100);

      createTable()
        .header(["Metric (delegated)", "TLDs txt", "Root DB HTML", "TLDs JSON (built)", "RDAP JSON", "TLDs JSON RDAP"])
        .body([
          ["─────────────────────", "─────────", "─────────────", "──────────────────", "────────────────", "────────────────"],
          ["Total TLDs", tldsAnalysis.total, rootZoneAnalysis.delegatedCounts.total, tldsJsonAnalysis.total, `${rdapAnalysis.total} ~${totalPct}%`, `${tldsJsonAnalysis.tldsWithRdap} ~${tldsJsonRdapPct}%`],
          ["ccTLDs", tldsAnalysis.ccTlds, rootZoneAnalysis.delegatedCounts.ccTlds, tldsJsonAnalysis.ccTlds, `${rdapAnalysis.ccTlds} ~${ccTldPct}%`, `${tldsJsonAnalysis.ccTldsWithRdap} ~${tldsJsonCcTldPct}%`],
          ["gTLDs", tldsAnalysis.gTlds, rootZoneAnalysis.delegatedCounts.gTlds, tldsJsonAnalysis.gTlds, `${rdapAnalysis.gTlds} ~${gTldPct}%`, `${tldsJsonAnalysis.gTldsWithRdap} ~${tldsJsonGTldPct}%`],
        ])
        .render();

      console.log();
      console.log("Root Zone DB - Categories (delegated) & Delegation Status:");

      // Calculate total generic (all non-ccTLD categories)
      const totalGeneric = rootZoneAnalysis.delegatedByCategory["generic"] +
        rootZoneAnalysis.delegatedByCategory["sponsored"] +
        rootZoneAnalysis.delegatedByCategory["generic-restricted"] +
        rootZoneAnalysis.delegatedByCategory["infrastructure"] +
        rootZoneAnalysis.delegatedByCategory["test"];

      // Build category rows
      const categoryRows: [string, number][] = [
        ["Total", rootZoneAnalysis.delegatedCounts.total],
        ["Generic (all)", totalGeneric],
      ];

      if (rootZoneAnalysis.delegatedByCategory["generic"] > 0) {
        categoryRows.push(["  - Generic", rootZoneAnalysis.delegatedByCategory["generic"]]);
      }
      if (rootZoneAnalysis.delegatedByCategory["sponsored"] > 0) {
        categoryRows.push(["  - Sponsored", rootZoneAnalysis.delegatedByCategory["sponsored"]]);
      }
      if (rootZoneAnalysis.delegatedByCategory["generic-restricted"] > 0) {
        categoryRows.push(["  - Generic-restrict", rootZoneAnalysis.delegatedByCategory["generic-restricted"]]);
      }
      if (rootZoneAnalysis.delegatedByCategory["infrastructure"] > 0) {
        categoryRows.push(["  - Infrastructure", rootZoneAnalysis.delegatedByCategory["infrastructure"]]);
      }
      if (rootZoneAnalysis.delegatedByCategory["test"] > 0) {
        categoryRows.push(["  - Test", rootZoneAnalysis.delegatedByCategory["test"]]);
      }
      categoryRows.push(["Country-code", rootZoneAnalysis.delegatedByCategory["country-code"]]);

      // Build delegation status rows
      const statusRows: [string, number][] = [
        ["Delegated", rootZoneAnalysis.delegated],
        ["Undelegated", rootZoneAnalysis.undelegated],
        ["  - ccTLDs", rootZoneAnalysis.undelegatedCcTlds],
        ["  - gTLDs", rootZoneAnalysis.undelegatedGTlds],
      ];

      // Combine rows side by side
      const maxRows = Math.max(categoryRows.length, statusRows.length);
      const combinedRows: [string, number | string, string, number | string][] = [];
      for (let i = 0; i < maxRows; i++) {
        const catRow = categoryRows[i] || ["", ""];
        const statRow = statusRows[i] || ["", ""];
        combinedRows.push([catRow[0], catRow[1], statRow[0], statRow[1]]);
      }

      // Add separator row at the beginning
      const rowsWithSeparator: [string, number | string, string, number | string][] = [
        ["──────────────────────", "──────", "─────────────", "──────"],
        ...combinedRows,
      ];

      createTable()
        .header(["Category", "Count", "Status", "Count"])
        .body(rowsWithSeparator)
        .render();

      console.log();
      console.log("IDN Details - Internationalized Domain Names:");

      createTable()
        .header(["Metric", "TLDs txt", "Root DB HTML", "TLDs JSON (built)", "RDAP JSON"])
        .body([
          ["─────────────────", "─────────", "─────────────", "──────────────────", "──────────"],
          ["Total IDNs", tldsAnalysis.idnBreakdown.total, rootZoneAnalysis.delegatedCounts.idnBreakdown.total, tldsJsonAnalysis.idnBreakdown.total, rdapAnalysis.idnBreakdown.total],
          ["  - ccTLDs", tldsAnalysis.idnBreakdown.ccTlds, rootZoneAnalysis.delegatedCounts.idnBreakdown.ccTlds, tldsJsonAnalysis.idnBreakdown.ccTlds, rdapAnalysis.idnBreakdown.ccTlds],
          ["  - gTLDs", tldsAnalysis.idnBreakdown.gTlds, rootZoneAnalysis.delegatedCounts.idnBreakdown.gTlds, tldsJsonAnalysis.idnBreakdown.gTlds, rdapAnalysis.idnBreakdown.gTlds],
          ["Format", "", "", "", ""],
          ["  - ASCII (xn--)", tldsAnalysis.idnBreakdown.ascii, rootZoneAnalysis.delegatedCounts.idnBreakdown.ascii, tldsJsonAnalysis.idnBreakdown.ascii, rdapAnalysis.idnBreakdown.ascii],
          ["  - Unicode", tldsAnalysis.idnBreakdown.unicode, rootZoneAnalysis.delegatedCounts.idnBreakdown.unicode, tldsJsonAnalysis.idnBreakdown.unicode, rdapAnalysis.idnBreakdown.unicode],
        ])
        .render();

      console.log();
      console.log("RDAP Details - Delegated gTLDs without RDAP servers:");

      // Build the missing TLDs list for the third column
      const missingTldsList = rdapCoverage.missingGTlds.map(({ tld }) => tld);

      const rdapRows: [string, number | string, string][] = [
        ["──────────────────", "──────", "──────────────"],
        ["Total gTLDs", rdapCoverage.totalDelegatedGTlds, missingTldsList[0] || ""],
        ["With RDAP servers", rdapCoverage.gTldsWithRdap, missingTldsList[1] || ""],
        ["Without RDAP", rdapCoverage.gTldsWithoutRdap, missingTldsList[2] || ""],
      ];

      // Add extra rows if there are more missing TLDs
      for (let i = 3; i < missingTldsList.length; i++) {
        rdapRows.push(["", "", missingTldsList[i]]);
      }

      createTable()
        .header(["Metric", "Count", "Missing TLDs"])
        .body(rdapRows)
        .render();

      console.log();
      console.log("RDAP Server Groups vs TLD Manager Groups:");

      const comp = tldsJsonAnalysis.rdapVsManagerComparison;

      createTable()
        .header(["Metric", "RDAP Server Groups", "TLD Manager Groups"])
        .body([
          ["─────────────────────────", "────────────────────", "──────────────────"],
          ["Total unique groups", comp.rdapServerGroups, comp.managerGroups],
          ["Groups with 2+ TLDs", comp.rdapGroupsWithMultipleTlds, comp.managerGroupsWithMultipleTlds],
          ["Largest group size (TLDs)", comp.largestRdapGroup.tldCount, comp.largestManagerGroup.tldCount],
        ])
        .render();

      console.log();
      console.log(`Largest RDAP group: ${comp.largestRdapGroup.tldCount} TLDs served by ${comp.largestRdapGroup.serverCount} server(s)`);
      console.log(`  Servers: ${comp.largestRdapGroup.servers.join(", ")}`);
      console.log();
      console.log(`Largest Manager group: ${comp.largestManagerGroup.tldCount} TLDs managed by:`);
      console.log(`  "${comp.largestManagerGroup.manager}"`);

      console.log();
      return;
    }

    // Specific source type provided
    if (!SOURCE_TYPES.includes(sourceType as SourceType)) {
      console.error(`Error: Invalid source type '${sourceType}'`);
      console.error(
        `Valid types: ${SOURCE_TYPES.join(", ")}`,
      );
      Deno.exit(1);
    }

    switch (sourceType as SourceType) {
      case "rdap-bootstrap": {
        const analysis = await getRdapBootstrapAnalysis();

        console.log("\n=== RDAP Bootstrap Analysis ===");
        console.log(`Total TLDs:    ${analysis.total}`);
        console.log(`ccTLDs:        ${analysis.ccTlds}`);
        console.log(`gTLDs:         ${analysis.gTlds}`);
        console.log(`IDNs:          ${analysis.idns}`);
        break;
      }
      case "tlds-txt": {
        const analysis = await getTldsAnalysis();

        console.log("\n=== TLD List Analysis ===");
        console.log(`Total TLDs:    ${analysis.total}`);
        console.log(`ccTLDs:        ${analysis.ccTlds}`);
        console.log(`gTLDs:         ${analysis.gTlds}`);
        console.log(`IDNs:          ${analysis.idns}`);
        break;
      }
      case "root-zone-db-html": {
        const analysis = await getRootZoneAnalysis();

        console.log("\n=== Root Zone Database Analysis ===");
        console.log(`Total TLDs:    ${analysis.total}`);
        console.log(`Delegated:     ${analysis.delegated}`);
        console.log(`Undelegated:   ${analysis.undelegated}`);
        console.log(`ccTLDs:        ${analysis.ccTlds}`);
        console.log(`gTLDs:         ${analysis.gTlds}`);
        console.log(`IDNs:          ${analysis.idns}`);
        console.log("\nTLDs by Category:");
        console.log(
          `  Country-code:       ${analysis.byCategory["country-code"]}`,
        );
        console.log(`  Generic:            ${analysis.byCategory["generic"]}`);
        console.log(
          `  Sponsored:          ${analysis.byCategory["sponsored"]}`,
        );
        console.log(
          `  Generic-restricted: ${analysis.byCategory["generic-restricted"]}`,
        );
        console.log(
          `  Infrastructure:     ${analysis.byCategory["infrastructure"]}`,
        );
        console.log(`  Test:               ${analysis.byCategory["test"]}`);
        break;
      }
      case "bootstrap-vs-rootdb": {
        const comparison = await getBootstrapVsRootZoneComparison();

        console.log(
          "\n╔═══════════════════════════════════════════════════════════════╗",
        );
        console.log(
          "║          RDAP Bootstrap vs Root Zone Database Comparison     ║",
        );
        console.log(
          "╚═══════════════════════════════════════════════════════════════╝",
        );
        console.log();
        console.log("Summary:");
        console.log(`  TLDs in RDAP Bootstrap:       ${comparison.rdapCount}`);
        console.log(
          `  TLDs in Root Zone Database:   ${comparison.rootZoneCount}`,
        );
        console.log(`  TLDs in both:                 ${comparison.inBoth}`);
        console.log(
          `  TLDs only in Root Zone DB:    ${comparison.onlyInRootZone.length}`,
        );
        console.log(
          `  TLDs only in RDAP Bootstrap:  ${comparison.onlyInRdap.length}`,
        );
        console.log();

        if (comparison.onlyInRootZone.length > 0) {
          console.log(
            `TLDs in Root Zone DB but NOT in RDAP Bootstrap (${comparison.onlyInRootZone.length}):`,
          );
          console.log("(These TLDs don't have RDAP servers yet)");
          console.log();

          // Display by type
          for (
            const [type, tlds] of comparison.onlyInRootZoneByType.entries()
          ) {
            console.log(`  ${type} (${tlds.length}):`);
            // Show first 20, then indicate if more
            const display = tlds.slice(0, 20);
            const remaining = tlds.length - display.length;
            console.log(`    ${display.join(", ")}`);
            if (remaining > 0) {
              console.log(`    ... and ${remaining} more`);
            }
            console.log();
          }
        }

        if (comparison.onlyInRdap.length > 0) {
          console.log(
            `TLDs in RDAP Bootstrap but NOT in Root Zone DB (${comparison.onlyInRdap.length}):`,
          );
          console.log("(This may indicate data sync issues)");
          console.log(`  ${comparison.onlyInRdap.join(", ")}`);
          console.log();
        }

        break;
      }
      case "tlds-vs-rootdb": {
        const comparison = await getTldsVsRootZoneComparison();

        console.log(
          "\n╔═══════════════════════════════════════════════════════════════╗",
        );
        console.log(
          "║            TLDs txt vs Root Zone Database Comparison         ║",
        );
        console.log(
          "╚═══════════════════════════════════════════════════════════════╝",
        );
        console.log();
        console.log("Summary:");
        console.log(`  TLDs in TLDs txt file:        ${comparison.tldsCount}`);
        console.log(
          `  TLDs in Root Zone Database:   ${comparison.rootZoneCount}`,
        );
        console.log(`  TLDs in both:                 ${comparison.inBoth}`);
        console.log(
          `  TLDs only in Root Zone DB:    ${comparison.onlyInRootZone.length}`,
        );
        console.log(
          `  TLDs only in TLDs txt:        ${comparison.onlyInTlds.length}`,
        );
        console.log();

        if (comparison.onlyInRootZone.length > 0) {
          console.log(
            `TLDs in Root Zone DB but NOT in TLDs txt (${comparison.onlyInRootZone.length}):`,
          );
          console.log();

          // Display by type
          for (
            const [type, tlds] of comparison.onlyInRootZoneByType.entries()
          ) {
            console.log(`  ${type} (${tlds.length}):`);
            // Show first 20, then indicate if more
            const display = tlds.slice(0, 20);
            const remaining = tlds.length - display.length;
            console.log(`    ${display.join(", ")}`);
            if (remaining > 0) {
              console.log(`    ... and ${remaining} more`);
            }
            console.log();
          }
        }

        if (comparison.onlyInTlds.length > 0) {
          console.log(
            `TLDs in TLDs txt but NOT in Root Zone DB (${comparison.onlyInTlds.length}):`,
          );
          console.log("(This may indicate data sync issues)");
          console.log(`  ${comparison.onlyInTlds.join(", ")}`);
          console.log();
        }

        break;
      }
    }
  }
}

// Run the CLI
if (import.meta.main) {
  await main();
}
