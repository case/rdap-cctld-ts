/**
 * Parsing functions for RDAP and TLD data.
 */

import { toUnicode } from "ts-punycode";
import { DOMParser } from "@b-fuze/deno-dom";

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

/**
 * TLD entry with type information from Root Zone DB
 */
export interface TldEntry {
  tld: string;
  type: "generic" | "country-code" | "sponsored" | "infrastructure" | "test" | "generic-restricted";
}

/**
 * Parse TLDs from IANA Root Zone Database HTML.
 *
 * @param content - The HTML content of the Root Zone Database
 * @returns List of TLD entries with their types
 */
export function parse_root_zone_db(content: string): TldEntry[] {
  const doc = new DOMParser().parseFromString(content, "text/html");
  const entries: TldEntry[] = [];

  // Find all table rows with TLD data
  const rows = doc.querySelectorAll("table#tld-table tbody tr");

  for (const row of rows) {
    // Each row has: <span class="domain tld"><a href="...">.<tld></a></span> in first td
    // and type in second td
    const tldLink = row.querySelector('span.domain.tld a[href^="/domains/root/db/"]');
    const typeCell = row.querySelectorAll("td")[1];

    if (tldLink && typeCell) {
      const tldText = tldLink.textContent?.trim();
      const typeText = typeCell.textContent?.trim();

      if (tldText && typeText) {
        // Remove leading dot and convert to lowercase
        const tld = tldText.replace(/^\./, "").toLowerCase();

        // Map type text to our type enum
        let type: TldEntry["type"];
        if (typeText === "country-code") {
          type = "country-code";
        } else if (typeText === "generic") {
          type = "generic";
        } else if (typeText === "sponsored") {
          type = "sponsored";
        } else if (typeText === "infrastructure") {
          type = "infrastructure";
        } else if (typeText === "test") {
          type = "test";
        } else if (typeText === "generic-restricted") {
          type = "generic-restricted";
        } else {
          // Unknown type - log error and skip this entry
          console.error(`Unknown TLD type '${typeText}' for TLD '${tld}' - skipping entry`);
          continue;
        }

        entries.push({ tld, type });
      }
    }
  }

  return entries;
}
