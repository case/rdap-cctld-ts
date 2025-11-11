import { parseArgs } from "@std/cli/parse-args";
import {
  download_iana_rdap_bootstrap,
  download_iana_root_zone_db,
  download_iana_tlds,
} from "./main.ts";

/**
 * Valid download types
 */
const DOWNLOAD_TYPES = [
  "rdap-bootstrap",
  "tlds-txt",
  "root-zone-db-html",
] as const;

type DownloadType = typeof DOWNLOAD_TYPES[number];

/**
 * Main CLI entry point
 */
async function main() {
  const args = parseArgs(Deno.args, {
    boolean: ["help"],
    string: ["download"],
    alias: {
      h: "help",
      d: "download",
    },
  });

  // Show help
  if (args.help) {
    console.log(`
Usage: deno run src/cli.ts [options]

Options:
  --download <type>, -d <type>  Download IANA data file
    Types:
      rdap-bootstrap       IANA RDAP bootstrap file (JSON)
      tlds-txt             IANA TLD list (text)
      root-zone-db-html    IANA Root Zone Database (HTML)
  --help, -h                    Show this help message

Examples:
  deno task cli --download rdap-bootstrap
  deno task cli --download tlds-txt
  deno task cli --download root-zone-db-html
  deno task cli -d rdap-bootstrap
    `);
    return;
  }

  // Handle download command
  if (args.download) {
    const downloadType = args.download as string;

    if (!DOWNLOAD_TYPES.includes(downloadType as DownloadType)) {
      console.error(`Error: Invalid download type '${downloadType}'`);
      console.error(
        `Valid types: ${DOWNLOAD_TYPES.join(", ")}`,
      );
      Deno.exit(1);
    }

    switch (downloadType as DownloadType) {
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
}

// Run the CLI
if (import.meta.main) {
  await main();
}
