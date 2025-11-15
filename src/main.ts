import { download, save_to_file, get_data_from_file, update_download_metadata } from "./utilities.ts";
import {
  validate_iana_bootstrap,
  validate_iana_root_zone_db,
  validate_iana_tlds,
} from "./validators.ts";
import { FILENAMES, IANA_URLS, LOCAL_PATHS } from "./config.ts";
import { build_tlds_json } from "./analyze.ts";

/**
 * Downloads the IANA RDAP Bootstrap file for DNS
 * This file contains mappings of TLDs to their respective RDAP servers
 */
export async function download_iana_rdap_bootstrap(): Promise<void> {
  const url = IANA_URLS.RDAP_BOOTSTRAP;
  const filename = FILENAMES.RDAP_BOOTSTRAP;

  const result = await download(url, filename);

  // If result is null, file hasn't changed (304 Not Modified or cache still fresh)
  if (result === null) {
    console.log(`\x1b[2m⊘ Skipping ${filename} - file unchanged\x1b[0m`);
    return;
  }

  const { data, response } = result;

  validate_iana_bootstrap(data);
  await save_to_file(data, filename);
  await update_download_metadata(filename, url, response);
  console.log(`\x1b[32m✓ Downloaded ${filename}\x1b[0m`);
}

/**
 * Compares two TLD list file contents, ignoring the timestamp in the first line
 * @param content1 - First file content
 * @param content2 - Second file content
 * @returns true if the TLD lists are identical (ignoring timestamp), false otherwise
 */
export function compare_tld_lists_ignore_timestamp(
  content1: string,
  content2: string,
): boolean {
  const lines1 = content1.split('\n');
  const lines2 = content2.split('\n');

  // Skip first line (timestamp) and filter out empty lines
  const tlds1 = lines1.slice(1).filter(line => line.trim().length > 0);
  const tlds2 = lines2.slice(1).filter(line => line.trim().length > 0);

  // Compare TLD lists
  if (tlds1.length !== tlds2.length) {
    return false;
  }

  return tlds1.every((tld, idx) => tld === tlds2[idx]);
}

/**
 * Downloads the IANA TLD list
 * This file contains all top-level domains in alphabetical order
 */
export async function download_iana_tlds(): Promise<void> {
  const url = IANA_URLS.TLD_LIST;
  const filename = FILENAMES.TLD_LIST;

  const result = await download(url, filename);

  // If result is null, file hasn't changed (304 Not Modified or cache still fresh)
  if (result === null) {
    console.log(`\x1b[2m⊘ Skipping ${filename} - file unchanged\x1b[0m`);
    return;
  }

  const { data, response } = result;

  validate_iana_tlds(data);

  // Check if the actual TLD list has changed (ignore timestamp in first line)
  const newContent = new TextDecoder().decode(data);

  // Try to read existing file and compare
  const filePath = `${LOCAL_PATHS.SOURCE_DIR}/${filename}`;
  let shouldSave = true;

  try {
    const existingContent = await Deno.readTextFile(filePath);

    // Compare TLD lists (ignoring timestamp line)
    if (compare_tld_lists_ignore_timestamp(newContent, existingContent)) {
      shouldSave = false;
      console.log(`\x1b[2m⊘ Skipping ${filename} - TLD list unchanged (only timestamp updated)\x1b[0m`);
    }
  } catch {
    // File doesn't exist, save it
    shouldSave = true;
  }

  if (shouldSave) {
    await save_to_file(data, filename);
    await update_download_metadata(filename, url, response);
    console.log(`\x1b[32m✓ Downloaded ${filename}\x1b[0m`);
  }
}

/**
 * Downloads the IANA Root Zone Database HTML page
 * This file contains information about all TLDs including their type (ccTLD/gTLD)
 */
export async function download_iana_root_zone_db(): Promise<void> {
  const url = IANA_URLS.ROOT_ZONE_DB;
  const filename = FILENAMES.ROOT_ZONE_DB;

  const result = await download(url, filename);

  // If result is null, file hasn't changed (304 Not Modified or cache still fresh)
  if (result === null) {
    console.log(`\x1b[2m⊘ Skipping ${filename} - file unchanged\x1b[0m`);
    return;
  }

  const { data, response } = result;

  validate_iana_root_zone_db(data);
  await save_to_file(data, filename);
  await update_download_metadata(filename, url, response);
  console.log(`\x1b[32m✓ Downloaded ${filename}\x1b[0m`);
}

/**
 * Build enhanced TLD JSON file combining IANA bootstrap + Root Zone DB metadata
 * This creates a comprehensive TLD dataset with type, RDAP servers, and IDN info
 */
export async function build_and_save_tlds_json(): Promise<void> {
  const filename = "tlds.json";

  console.log(`Building ${filename}...`);

  // Read IANA RDAP bootstrap data
  const rdapBootstrapContent = await get_data_from_file(FILENAMES.RDAP_BOOTSTRAP);
  const rdapBootstrap = JSON.parse(rdapBootstrapContent);

  // Read Root Zone DB HTML
  const rootZoneContent = await get_data_from_file(FILENAMES.ROOT_ZONE_DB);

  // Read manual ccTLD RDAP data
  let manualCcTldData;
  try {
    const manualContent = await get_data_from_file("cctld-rdap-manual.json");
    manualCcTldData = JSON.parse(manualContent);
  } catch (error) {
    console.warn(`⚠ Could not load manual ccTLD data: ${error}`);
    manualCcTldData = [];
  }

  // Build the enhanced TLD JSON
  const enhancedData = await build_tlds_json(
    rdapBootstrap.services,
    rootZoneContent,
    manualCcTldData
  );

  // Save to data/ directory (not data/source/)
  const jsonString = JSON.stringify(enhancedData, null, 2);
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonString);

  await save_to_file(data, filename, LOCAL_PATHS.DATA_DIR);
  console.log(`\x1b[32m✓ Built ${LOCAL_PATHS.DATA_DIR}/${filename} (${enhancedData.services.length} service groups)\x1b[0m`);
}
