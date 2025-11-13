/**
 * Val Town-specific utilities for deployment and blob storage
 *
 * On Val Town, ALL IANA data files are stored in blob storage, not as regular files.
 * This keeps data completely separate from application code.
 */

import { BLOB_KEYS, IANA_URLS } from "./config.ts";
import { download } from "./utilities.ts";
import {
  validate_iana_bootstrap,
  validate_iana_root_zone_db,
  validate_iana_tlds,
} from "./validators.ts";

/**
 * Store data in Val Town blob storage.
 *
 * @param key - The blob storage key
 * @param data - The data to store (string or ArrayBuffer)
 * @returns Promise that resolves when storage is complete
 */
async function store_to_blob(key: string, data: string | ArrayBuffer): Promise<void> {
  const { blob } = await import("https://esm.town/v/std/blob");
  const content = typeof data === "string" ? data : new TextDecoder().decode(data);
  await blob.set(key, content);
}

/**
 * Read a file from Val Town blob storage.
 *
 * @param key - The blob storage key
 * @returns Promise that resolves with the file content as a string
 */
export async function read_from_blob(key: string): Promise<string> {
  const { blob } = await import("https://esm.town/v/std/blob");
  const content = await blob.get(key);

  if (!content) {
    throw new Error(`Blob not found: ${key}`);
  }

  return content;
}

/**
 * Download all IANA files and store them in Val Town blob storage.
 * This function is designed to run as a Val Town interval (cron) job.
 *
 * @returns Promise that resolves when all downloads and uploads complete
 */
export async function download_and_store_iana_files_to_blob(): Promise<void> {
  console.log("Starting IANA file downloads to blob storage...\n");

  // Define the files to download
  const files = [
    {
      url: IANA_URLS.TLD_LIST,
      blobKey: BLOB_KEYS.TLD_LIST,
      name: "TLD List",
      validate: validate_iana_tlds,
    },
    {
      url: IANA_URLS.RDAP_BOOTSTRAP,
      blobKey: BLOB_KEYS.RDAP_BOOTSTRAP,
      name: "RDAP Bootstrap",
      validate: validate_iana_bootstrap,
    },
    {
      url: IANA_URLS.ROOT_ZONE_DB,
      blobKey: BLOB_KEYS.ROOT_ZONE_DB,
      name: "Root Zone DB",
      validate: validate_iana_root_zone_db,
    },
  ];

  // Download and store each file
  for (const file of files) {
    try {
      console.log(`Downloading ${file.name}...`);
      const data = await download(file.url);

      if (data) {
        file.validate(data);
        await store_to_blob(file.blobKey, data);
        console.log(`\x1b[32m✓ Stored ${file.name} to blob (${data.byteLength} bytes)\x1b[0m`);
      } else {
        console.log(`\x1b[2m⊘ Skipping ${file.name} - file unchanged\x1b[0m`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\x1b[31m✗ Failed to download/store ${file.name}: ${message}\x1b[0m`);
    }
  }

  console.log("\n\x1b[32mIANA file downloads to blob storage complete!\x1b[0m");
}

/**
 * Check if we're running on Val Town.
 * Val Town automatically provides VAL_TOWN_API_KEY environment variable.
 */
export function is_running_on_valtown(): boolean {
  return Deno.env.get("VAL_TOWN_API_KEY") !== undefined;
}
