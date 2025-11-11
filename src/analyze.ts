/**
 * Analysis functions for comparing TLD data across different sources.
 */

import {
  is_cctld,
  parse_bootstrap_tlds,
  parse_root_zone_db,
  parse_tlds_file,
  type TldEntry,
} from "./parse.ts";

/**
 * TLD count summary
 */
export interface TldCounts {
  total: number;
  ccTlds: number;
  gTlds: number;
  idns: number;
}

/**
 * Root Zone DB detailed analysis with category breakdown
 */
export interface RootZoneAnalysis extends TldCounts {
  byCategory: {
    "country-code": number;
    "generic": number;
    "sponsored": number;
    "infrastructure": number;
    "test": number;
    "generic-restricted": number;
  };
}

/**
 * Check if a TLD is an IDN (starts with xn--)
 */
function is_idn(tld: string): boolean {
  return tld.startsWith("xn--");
}

/**
 * Analyze TLD counts from the IANA TLD list file.
 *
 * @param content - The content of the TLD list file
 * @returns TLD count summary
 */
export function analyze_tlds_file(content: string): TldCounts {
  const tlds = parse_tlds_file(content);
  const ccTlds = tlds.filter((tld) => is_cctld(tld));
  const gTlds = tlds.filter((tld) => !is_cctld(tld));
  const idns = tlds.filter((tld) => is_idn(tld));

  return {
    total: tlds.length,
    ccTlds: ccTlds.length,
    gTlds: gTlds.length,
    idns: idns.length,
  };
}

/**
 * Analyze TLD counts from the IANA RDAP bootstrap file.
 *
 * @param services - The services array from RDAP bootstrap JSON
 * @returns TLD count summary
 */
export function analyze_rdap_bootstrap(services: unknown[]): TldCounts {
  const tlds = parse_bootstrap_tlds(services);
  const ccTlds = tlds.filter((tld) => is_cctld(tld));
  const gTlds = tlds.filter((tld) => !is_cctld(tld));
  const idns = tlds.filter((tld) => is_idn(tld));

  return {
    total: tlds.length,
    ccTlds: ccTlds.length,
    gTlds: gTlds.length,
    idns: idns.length,
  };
}

/**
 * Analyze TLD counts from the IANA Root Zone Database HTML.
 *
 * @param content - The HTML content of the Root Zone Database
 * @returns Detailed TLD analysis with category breakdown
 */
export function analyze_root_zone_db(content: string): RootZoneAnalysis {
  const entries = parse_root_zone_db(content);

  // Count by type from the Root Zone DB
  const ccTlds = entries.filter((entry) => entry.type === "country-code");
  const gTlds = entries.filter((entry) => entry.type !== "country-code");

  // Count IDNs (punycode encoded)
  const idns = entries.filter((entry) => is_idn(entry.tld));

  // Count by category
  const byCategory = {
    "country-code": entries.filter((e) => e.type === "country-code").length,
    "generic": entries.filter((e) => e.type === "generic").length,
    "sponsored": entries.filter((e) => e.type === "sponsored").length,
    "infrastructure": entries.filter((e) => e.type === "infrastructure").length,
    "test": entries.filter((e) => e.type === "test").length,
    "generic-restricted": entries.filter((e) => e.type === "generic-restricted").length,
  };

  return {
    total: entries.length,
    ccTlds: ccTlds.length,
    gTlds: gTlds.length,
    idns: idns.length,
    byCategory,
  };
}

/**
 * Compare TLD counts across all three data sources.
 *
 * @param tldsFileContent - Content of the TLD list file
 * @param rdapServices - Services array from RDAP bootstrap JSON
 * @param rootZoneContent - HTML content of Root Zone Database
 * @returns Comparison object with counts from each source
 */
export function compare_tld_sources(
  tldsFileContent: string,
  rdapServices: unknown[],
  rootZoneContent: string,
): {
  tldsFile: TldCounts;
  rdapBootstrap: TldCounts;
  rootZoneDb: TldCounts;
} {
  return {
    tldsFile: analyze_tlds_file(tldsFileContent),
    rdapBootstrap: analyze_rdap_bootstrap(rdapServices),
    rootZoneDb: analyze_root_zone_db(rootZoneContent),
  };
}
