import { parseArgs } from "@std/cli/parse-args";
import {
  download_iana_rdap_bootstrap,
  download_iana_root_zone_db,
  download_iana_tlds,
} from "./main.ts";

/**
 * Main CLI entry point
 */
async function main() {
  const args = parseArgs(Deno.args, {
    boolean: [
      "help",
      "download-rdap-bootstrap",
      "download-tlds",
      "download-root-zone-db",
    ],
    alias: {
      h: "help",
    },
  });

  // Show help
  if (args.help) {
    console.log(`
Usage: deno run src/cli.ts [options]

Options:
  --download-rdap-bootstrap    Download IANA RDAP bootstrap file
  --download-tlds              Download IANA TLD list
  --download-root-zone-db      Download IANA Root Zone Database
  --help, -h                   Show this help message

Examples:
  deno task cli --download-rdap-bootstrap
  deno task cli --download-tlds
  deno task cli --download-root-zone-db
    `);
    return;
  }

  // Handle download RDAP bootstrap command
  if (args["download-rdap-bootstrap"]) {
    await download_iana_rdap_bootstrap();
  }

  // Handle download TLDs command
  if (args["download-tlds"]) {
    await download_iana_tlds();
  }

  // Handle download Root Zone DB command
  if (args["download-root-zone-db"]) {
    await download_iana_root_zone_db();
  }
}

// Run the CLI
if (import.meta.main) {
  await main();
}
