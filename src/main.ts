import { download, save_to_file } from "./utilities.ts";
import {
  validate_iana_bootstrap,
  validate_iana_root_zone_db,
  validate_iana_tlds,
} from "./validators.ts";

/**
 * Downloads the IANA RDAP Bootstrap file for DNS
 * This file contains mappings of TLDs to their respective RDAP servers
 */
export async function download_iana_rdap_bootstrap(): Promise<void> {
  const url = "https://data.iana.org/rdap/dns.json";
  const filename = "iana-rdap-bootstrap.json";

  const data = await download(url, filename);

  // If data is null, file hasn't changed (304 Not Modified or cache still fresh)
  if (data === null) {
    console.log(`Skipping ${filename} - file unchanged`);
    return;
  }

  validate_iana_bootstrap(data);
  await save_to_file(data, filename);
}

/**
 * Downloads the IANA TLD list
 * This file contains all top-level domains in alphabetical order
 */
export async function download_iana_tlds(): Promise<void> {
  const url = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";
  const filename = "iana-tlds.txt";

  const data = await download(url, filename);

  // If data is null, file hasn't changed (304 Not Modified or cache still fresh)
  if (data === null) {
    console.log(`Skipping ${filename} - file unchanged`);
    return;
  }

  validate_iana_tlds(data);
  await save_to_file(data, filename);
}

/**
 * Downloads the IANA Root Zone Database HTML page
 * This file contains information about all TLDs including their type (ccTLD/gTLD)
 */
export async function download_iana_root_zone_db(): Promise<void> {
  const url = "https://www.iana.org/domains/root/db";
  const filename = "iana-root-zone-db.html";

  const data = await download(url, filename);

  // If data is null, file hasn't changed (304 Not Modified or cache still fresh)
  if (data === null) {
    console.log(`Skipping ${filename} - file unchanged`);
    return;
  }

  validate_iana_root_zone_db(data);
  await save_to_file(data, filename);
}
