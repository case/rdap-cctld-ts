import { parseArgs } from "@std/cli/parse-args";
import {
  download_iana_rdap_bootstrap,
  download_iana_root_zone_db,
  download_iana_tlds,
} from "./main.ts";
import {
  analyze_rdap_bootstrap,
  analyze_rdap_coverage,
  analyze_root_zone_db,
  analyze_tlds_file,
  compare_bootstrap_vs_rootzone,
  compare_tlds_vs_rootzone,
} from "./analyze.ts";

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
    boolean: ["help"],
    string: ["download", "analyze"],
    alias: {
      h: "help",
      d: "download",
      a: "analyze",
    },
  });

  // Show help
  if (args.help) {
    console.log(`
Usage: deno run src/cli.ts [options]

Options:
  --download [type], -d [type]  Download IANA data file(s)
  --analyze [type], -a [type]   Analyze IANA data file(s)
    Types:
      (none)               Download/analyze all data sources
      rdap-bootstrap       IANA RDAP bootstrap file (JSON)
      tlds-txt             IANA TLD list (text)
      root-zone-db-html    IANA Root Zone Database (HTML)
      bootstrap-vs-rootdb  Compare RDAP bootstrap vs Root Zone DB
      tlds-vs-rootdb       Compare TLDs txt vs Root Zone DB
  --help, -h                    Show this help message

Examples:
  deno task cli --download
  deno task cli --download rdap-bootstrap
  deno task cli --download tlds-txt
  deno task cli --analyze
  deno task cli --analyze rdap-bootstrap
  deno task cli --analyze bootstrap-vs-rootdb
  deno task cli --analyze tlds-vs-rootdb
  deno task cli -d
  deno task cli -d rdap-bootstrap
  deno task cli -a tlds-txt
    `);
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
      const tldsContent = await Deno.readTextFile("data/source/iana-tlds.txt");
      const rdapContent = await Deno.readTextFile(
        "data/source/iana-rdap-bootstrap.json",
      );
      const rootZoneContent = await Deno.readTextFile(
        "data/source/iana-root-zone-db.html",
      );

      const rdapData = JSON.parse(rdapContent);

      const tldsAnalysis = await analyze_tlds_file(
        tldsContent,
        rootZoneContent,
      );
      const rdapAnalysis = await analyze_rdap_bootstrap(
        rdapData.services,
        rootZoneContent,
      );
      const rootZoneAnalysis = analyze_root_zone_db(rootZoneContent);

      console.log(
        "\n╔═══════════════════════════════════════════════════════════════╗",
      );
      console.log(
        "║                TLD Data Sources Comparison                    ║",
      );
      console.log(
        "╚═══════════════════════════════════════════════════════════════╝",
      );
      console.log();
      console.log(
        "┌─────────────────────┬─────────────┬─────────────┬─────────────┐",
      );
      console.log(
        "│ Metric (delegated)  │ TLDs txt    │ Root DB HTML│ RDAP JSON   │",
      );
      console.log(
        "├─────────────────────┼─────────────┼─────────────┼─────────────┤",
      );
      console.log(
        `│ Total TLDs          │ ${String(tldsAnalysis.total).padStart(11)} │ ${
          String(rootZoneAnalysis.delegatedCounts.total).padStart(11)
        } │ ${String(rdapAnalysis.total).padStart(11)} │`,
      );
      console.log(
        `│ ccTLDs              │ ${
          String(tldsAnalysis.ccTlds).padStart(11)
        } │ ${String(rootZoneAnalysis.delegatedCounts.ccTlds).padStart(11)} │ ${
          String(rdapAnalysis.ccTlds).padStart(11)
        } │`,
      );
      console.log(
        `│ gTLDs               │ ${String(tldsAnalysis.gTlds).padStart(11)} │ ${
          String(rootZoneAnalysis.delegatedCounts.gTlds).padStart(11)
        } │ ${String(rdapAnalysis.gTlds).padStart(11)} │`,
      );
      console.log(
        `│ IDNs (punycode)     │ ${String(tldsAnalysis.idns).padStart(11)} │ ${
          String(rootZoneAnalysis.delegatedCounts.idns).padStart(11)
        } │ ${String(rdapAnalysis.idns).padStart(11)} │`,
      );
      console.log(
        "└─────────────────────┴─────────────┴─────────────┴─────────────┘",
      );

      console.log();
      console.log("Root Zone DB - TLDs by Category (delegated only):");
      console.log("┌─────────────────────┬─────────────┐");
      console.log("│ Category            │       Count │");
      console.log("├─────────────────────┼─────────────┤");

      // Calculate total generic (all non-ccTLD categories)
      const totalGeneric = rootZoneAnalysis.delegatedByCategory["generic"] +
        rootZoneAnalysis.delegatedByCategory["sponsored"] +
        rootZoneAnalysis.delegatedByCategory["generic-restricted"] +
        rootZoneAnalysis.delegatedByCategory["infrastructure"] +
        rootZoneAnalysis.delegatedByCategory["test"];

      // Show Generic (all) first, then subcategories (only if non-zero), then Country-code
      console.log(
        `│ Generic (all)       │ ${String(totalGeneric).padStart(11)} │`,
      );

      // Only show subcategories with non-zero counts
      if (rootZoneAnalysis.delegatedByCategory["generic"] > 0) {
        console.log(
          `│  - Generic          │ ${
            String(rootZoneAnalysis.delegatedByCategory["generic"]).padStart(11)
          } │`,
        );
      }
      if (rootZoneAnalysis.delegatedByCategory["sponsored"] > 0) {
        console.log(
          `│  - Sponsored        │ ${
            String(rootZoneAnalysis.delegatedByCategory["sponsored"]).padStart(
              11,
            )
          } │`,
        );
      }
      if (rootZoneAnalysis.delegatedByCategory["generic-restricted"] > 0) {
        console.log(
          `│  - Generic-restrict │ ${
            String(rootZoneAnalysis.delegatedByCategory["generic-restricted"])
              .padStart(11)
          } │`,
        );
      }
      if (rootZoneAnalysis.delegatedByCategory["infrastructure"] > 0) {
        console.log(
          `│  - Infrastructure   │ ${
            String(rootZoneAnalysis.delegatedByCategory["infrastructure"])
              .padStart(11)
          } │`,
        );
      }
      if (rootZoneAnalysis.delegatedByCategory["test"] > 0) {
        console.log(
          `│  - Test             │ ${
            String(rootZoneAnalysis.delegatedByCategory["test"]).padStart(11)
          } │`,
        );
      }

      console.log(
        `│ Country-code        │ ${
          String(rootZoneAnalysis.delegatedByCategory["country-code"]).padStart(
            11,
          )
        } │`,
      );
      console.log("└─────────────────────┴─────────────┘");
      console.log();
      console.log("Root Zone DB - Delegation Status:");
      console.log("┌─────────────────────┬─────────────┐");
      console.log("│ Status              │       Count │");
      console.log("├─────────────────────┼─────────────┤");
      console.log(
        `│ Delegated           │ ${
          String(rootZoneAnalysis.delegated).padStart(11)
        } │`,
      );
      console.log(
        `│ Undelegated         │ ${
          String(rootZoneAnalysis.undelegated).padStart(11)
        } │`,
      );
      console.log(
        `│  - ccTLDs           │ ${
          String(rootZoneAnalysis.undelegatedCcTlds).padStart(11)
        } │`,
      );
      console.log(
        `│  - gTLDs            │ ${
          String(rootZoneAnalysis.undelegatedGTlds).padStart(11)
        } │`,
      );
      console.log("└─────────────────────┴─────────────┘");

      // RDAP Coverage Analysis
      const rdapCoverage = await analyze_rdap_coverage(
        rdapData.services,
        rootZoneContent,
      );

      console.log();
      console.log("RDAP Details - Delegated gTLDs without RDAP servers:");
      console.log("┌─────────────────────┬─────────────┐");
      console.log("│ Metric              │       Count │");
      console.log("├─────────────────────┼─────────────┤");
      console.log(
        `│ Total gTLDs         │ ${
          String(rdapCoverage.totalDelegatedGTlds).padStart(11)
        } │`,
      );
      console.log(
        `│ With RDAP servers   │ ${
          String(rdapCoverage.gTldsWithRdap).padStart(11)
        } │`,
      );
      console.log(
        `│ Without RDAP        │ ${
          String(rdapCoverage.gTldsWithoutRdap).padStart(11)
        } │`,
      );
      console.log("└─────────────────────┴─────────────┘");

      if (rdapCoverage.missingGTlds.length > 0) {
        console.log();
        console.log("Delegated gTLDs without RDAP servers:");
        console.log("┌─────────────────────────────────────┬─────────────────────┐");
        console.log("│ TLD                                 │ Type                │");
        console.log("├─────────────────────────────────────┼─────────────────────┤");

        for (const { tld, type } of rdapCoverage.missingGTlds) {
          console.log(
            `│ ${tld.padEnd(35)} │ ${type.padEnd(19)} │`,
          );
        }

        console.log("└─────────────────────────────────────┴─────────────────────┘");
      }

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
        const rdapContent = await Deno.readTextFile(
          "data/source/iana-rdap-bootstrap.json",
        );
        const rootZoneContent = await Deno.readTextFile(
          "data/source/iana-root-zone-db.html",
        );
        const data = JSON.parse(rdapContent);
        const analysis = await analyze_rdap_bootstrap(
          data.services,
          rootZoneContent,
        );

        console.log("\n=== RDAP Bootstrap Analysis ===");
        console.log(`Total TLDs:    ${analysis.total}`);
        console.log(`ccTLDs:        ${analysis.ccTlds}`);
        console.log(`gTLDs:         ${analysis.gTlds}`);
        console.log(`IDNs:          ${analysis.idns}`);
        break;
      }
      case "tlds-txt": {
        const tldsContent = await Deno.readTextFile(
          "data/source/iana-tlds.txt",
        );
        const rootZoneContent = await Deno.readTextFile(
          "data/source/iana-root-zone-db.html",
        );
        const analysis = await analyze_tlds_file(tldsContent, rootZoneContent);

        console.log("\n=== TLD List Analysis ===");
        console.log(`Total TLDs:    ${analysis.total}`);
        console.log(`ccTLDs:        ${analysis.ccTlds}`);
        console.log(`gTLDs:         ${analysis.gTlds}`);
        console.log(`IDNs:          ${analysis.idns}`);
        break;
      }
      case "root-zone-db-html": {
        const content = await Deno.readTextFile(
          "data/source/iana-root-zone-db.html",
        );
        const analysis = analyze_root_zone_db(content);

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
        const rdapContent = await Deno.readTextFile(
          "data/source/iana-rdap-bootstrap.json",
        );
        const rootZoneContent = await Deno.readTextFile(
          "data/source/iana-root-zone-db.html",
        );
        const rdapData = JSON.parse(rdapContent);

        const comparison = compare_bootstrap_vs_rootzone(
          rdapData.services,
          rootZoneContent,
        );

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
        const tldsContent = await Deno.readTextFile(
          "data/source/iana-tlds.txt",
        );
        const rootZoneContent = await Deno.readTextFile(
          "data/source/iana-root-zone-db.html",
        );

        const comparison = compare_tlds_vs_rootzone(
          tldsContent,
          rootZoneContent,
        );

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
