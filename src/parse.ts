/**
 * Parsing functions for RDAP and TLD data.
 */

import { toUnicode } from "ts-punycode";

/**
 * Determine if a TLD is a ccTLD (country code TLD).
 *
 * This includes both ASCII ccTLDs (2 characters) and IDN ccTLDs
 * (which are 2 characters when decoded from Punycode).
 *
 * @param tld - The TLD string (lowercase)
 * @returns True if it's a ccTLD, False otherwise
 */
export function is_cctld(tld: string): boolean {
  // Decode Punycode if needed
  if (tld.startsWith("xn--")) {
    try {
      // Decode punycode to unicode
      const decoded = toUnicode(tld);
      // Count Unicode characters (not bytes)
      const charCount = Array.from(decoded).length;
      return charCount === 2;
    } catch {
      // If decoding fails, treat as gTLD
      return false;
    }
  } else {
    return tld.length === 2;
  }
}

/**
 * Parse a TLDs file, filtering out comments and empty lines.
 *
 * @param content - The content of the TLDs file as a string
 * @returns List of TLDs (lowercase, stripped)
 */
export function parse_tlds_file(content: string): string[] {
  const lines = content.trim().split("\n");

  // Filter out comment lines (start with #) and empty lines
  const tlds = lines
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return tlds;
}

/**
 * Parse TLDs from RDAP bootstrap services structure.
 *
 * @param services - The services list from IANA RDAP bootstrap data
 *                   Each service is [[tlds], [servers]]
 * @returns List of all TLDs found in the bootstrap file
 */
export function parse_bootstrap_tlds(services: unknown[]): string[] {
  const tlds: string[] = [];

  for (const service of services) {
    if (Array.isArray(service) && service.length >= 1) {
      const serviceTlds = service[0];
      if (Array.isArray(serviceTlds)) {
        for (const tld of serviceTlds) {
          if (typeof tld === "string") {
            tlds.push(tld.replace(/^\./, "").toLowerCase());
          }
        }
      }
    }
  }

  return tlds;
}
