import { parseArgs } from "@std/cli/parse-args";
import {
  download_iana_rdap_bootstrap,
  download_iana_root_zone_db,
  download_iana_tlds,
} from "./main.ts";
import {
  analyze_rdap_bootstrap,
  analyze_root_zone_db,
  analyze_tlds_file,
} from "./analyze.ts";

/**
 * Valid data source types
 */
const SOURCE_TYPES = [
  "rdap-bootstrap",
  "tlds-txt",
  "root-zone-db-html",
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
  --download <type>, -d <type>  Download IANA data file
  --analyze <type>, -a <type>   Analyze IANA data file
    Types:
      rdap-bootstrap       IANA RDAP bootstrap file (JSON)
      tlds-txt             IANA TLD list (text)
      root-zone-db-html    IANA Root Zone Database (HTML)
  --help, -h                    Show this help message

Examples:
  deno task cli --download rdap-bootstrap
  deno task cli --download tlds-txt
  deno task cli --analyze rdap-bootstrap
  deno task cli --analyze root-zone-db-html
  deno task cli -d rdap-bootstrap
  deno task cli -a tlds-txt
    `);
    return;
  }

  // Handle download command
  if (args.download) {
    const sourceType = args.download as string;

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
  if (args.analyze) {
    const sourceType = args.analyze as string;

    if (!SOURCE_TYPES.includes(sourceType as SourceType)) {
      console.error(`Error: Invalid source type '${sourceType}'`);
      console.error(
        `Valid types: ${SOURCE_TYPES.join(", ")}`,
      );
      Deno.exit(1);
    }

    switch (sourceType as SourceType) {
      case "rdap-bootstrap": {
        const content = await Deno.readTextFile("data/source/iana-rdap-bootstrap.json");
        const data = JSON.parse(content);
        const analysis = analyze_rdap_bootstrap(data.services);

        console.log("\n=== RDAP Bootstrap Analysis ===");
        console.log(`Total TLDs:    ${analysis.total}`);
        console.log(`ccTLDs:        ${analysis.ccTlds}`);
        console.log(`gTLDs:         ${analysis.gTlds}`);
        console.log(`IDNs:          ${analysis.idns}`);
        break;
      }
      case "tlds-txt": {
        const content = await Deno.readTextFile("data/source/iana-tlds.txt");
        const analysis = analyze_tlds_file(content);

        console.log("\n=== TLD List Analysis ===");
        console.log(`Total TLDs:    ${analysis.total}`);
        console.log(`ccTLDs:        ${analysis.ccTlds}`);
        console.log(`gTLDs:         ${analysis.gTlds}`);
        console.log(`IDNs:          ${analysis.idns}`);
        break;
      }
      case "root-zone-db-html": {
        const content = await Deno.readTextFile("data/source/iana-root-zone-db.html");
        const analysis = analyze_root_zone_db(content);

        console.log("\n=== Root Zone Database Analysis ===");
        console.log(`Total TLDs:    ${analysis.total}`);
        console.log(`ccTLDs:        ${analysis.ccTlds}`);
        console.log(`gTLDs:         ${analysis.gTlds}`);
        console.log(`IDNs:          ${analysis.idns}`);
        console.log("\nTLDs by Category:");
        console.log(`  Country-code:       ${analysis.byCategory["country-code"]}`);
        console.log(`  Generic:            ${analysis.byCategory["generic"]}`);
        console.log(`  Sponsored:          ${analysis.byCategory["sponsored"]}`);
        console.log(`  Generic-restricted: ${analysis.byCategory["generic-restricted"]}`);
        console.log(`  Infrastructure:     ${analysis.byCategory["infrastructure"]}`);
        console.log(`  Test:               ${analysis.byCategory["test"]}`);
        break;
      }
    }
  }
}

// Run the CLI
if (import.meta.main) {
  await main();
}
