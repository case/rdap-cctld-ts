import { download, save_to_file, get_data_from_file } from "./utilities.ts";
import {
  validate_iana_bootstrap,
  validate_iana_root_zone_db,
  validate_iana_tlds,
} from "./validators.ts";
import { FILENAMES, IANA_URLS } from "./config.ts";
import { build_tlds_json } from "./analyze.ts";

/**
 * Downloads the IANA RDAP Bootstrap file for DNS
 * This file contains mappings of TLDs to their respective RDAP servers
 */
export async function download_iana_rdap_bootstrap(): Promise<void> {
  const url = IANA_URLS.RDAP_BOOTSTRAP;
  const filename = FILENAMES.RDAP_BOOTSTRAP;

  const data = await download(url, filename);

  // If data is null, file hasn't changed (304 Not Modified or cache still fresh)
  if (data === null) {
    console.log(`\x1b[2m⊘ Skipping ${filename} - file unchanged\x1b[0m`);
    return;
  }

  validate_iana_bootstrap(data);
  await save_to_file(data, filename);
  console.log(`\x1b[32m✓ Downloaded ${filename}\x1b[0m`);
}

/**
 * Downloads the IANA TLD list
 * This file contains all top-level domains in alphabetical order
 */
export async function download_iana_tlds(): Promise<void> {
  const url = IANA_URLS.TLD_LIST;
  const filename = FILENAMES.TLD_LIST;

  const data = await download(url, filename);

  // If data is null, file hasn't changed (304 Not Modified or cache still fresh)
  if (data === null) {
    console.log(`\x1b[2m⊘ Skipping ${filename} - file unchanged\x1b[0m`);
    return;
  }

  validate_iana_tlds(data);
  await save_to_file(data, filename);
  console.log(`\x1b[32m✓ Downloaded ${filename}\x1b[0m`);
}

/**
 * Downloads the IANA Root Zone Database HTML page
 * This file contains information about all TLDs including their type (ccTLD/gTLD)
 */
export async function download_iana_root_zone_db(): Promise<void> {
  const url = IANA_URLS.ROOT_ZONE_DB;
  const filename = FILENAMES.ROOT_ZONE_DB;

  const data = await download(url, filename);

  // If data is null, file hasn't changed (304 Not Modified or cache still fresh)
  if (data === null) {
    console.log(`\x1b[2m⊘ Skipping ${filename} - file unchanged\x1b[0m`);
    return;
  }

  validate_iana_root_zone_db(data);
  await save_to_file(data, filename);
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

  // Save to file
  const jsonString = JSON.stringify(enhancedData, null, 2);
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonString);

  await save_to_file(data, filename);
  console.log(`\x1b[32m✓ Built ${filename} (${enhancedData.services.length} service groups)\x1b[0m`);
}
