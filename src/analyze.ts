/**
 * Analysis functions for comparing TLD data across different sources.
 */

import {
  parse_bootstrap_tlds,
  parse_root_zone_db,
  parse_tlds_file,
  type TldEntry,
} from "./parse.ts";

/**
 * IDN-specific breakdown
 */
export interface IdnCounts {
  total: number;
  ccTlds: number;
  gTlds: number;
  ascii: number; // punycode format (xn--)
  unicode: number; // unicode format (non-ASCII)
}

/**
 * TLD count summary
 */
export interface TldCounts {
  total: number;
  ccTlds: number;
  gTlds: number;
  idns: number;
  idnBreakdown: IdnCounts;
}

/**
 * Root Zone DB detailed analysis with category breakdown
 */
export interface RootZoneAnalysis extends TldCounts {
  delegated: number;
  undelegated: number;
  undelegatedCcTlds: number;
  undelegatedGTlds: number;
  delegatedCounts: TldCounts;
  byCategory: {
    "country-code": number;
    "generic": number;
    "sponsored": number;
    "infrastructure": number;
    "test": number;
    "generic-restricted": number;
  };
  delegatedByCategory: {
    "country-code": number;
    "generic": number;
    "sponsored": number;
    "infrastructure": number;
    "test": number;
    "generic-restricted": number;
  };
}

/**
 * Check if a TLD is an IDN and return its format
 * @returns "ascii" for punycode (xn--), "unicode" for non-ASCII chars, null if not an IDN
 */
function get_idn_format(tld: string): "ascii" | "unicode" | null {
  if (tld.startsWith("xn--")) return "ascii";
  if (/[^\x00-\x7F]/.test(tld)) return "unicode";
  return null;
}

/**
 * Check if a TLD is an IDN (either format)
 */
function is_idn(tld: string): boolean {
  return get_idn_format(tld) !== null;
}

/**
 * Analyze IDN breakdown for a list of TLDs
 */
function analyze_idn_breakdown(
  tlds: string[],
  ccTldLookup: Set<string>,
): IdnCounts {
  const idns = tlds.filter((tld) => is_idn(tld));
  const asciiIdns = idns.filter((tld) => get_idn_format(tld) === "ascii");
  const unicodeIdns = idns.filter((tld) => get_idn_format(tld) === "unicode");

  const idnCcTlds = idns.filter((tld) => ccTldLookup.has(tld));
  const idnGTlds = idns.filter((tld) => !ccTldLookup.has(tld));

  return {
    total: idns.length,
    ccTlds: idnCcTlds.length,
    gTlds: idnGTlds.length,
    ascii: asciiIdns.length,
    unicode: unicodeIdns.length,
  };
}

/**
 * Build a ccTLD lookup set from Root Zone DB (source of truth)
 * Maps both punycode and unicode versions to country-code status
 *
 * @param rootZoneContent - HTML content of Root Zone Database
 * @returns Set of TLDs that are country-code TLDs
 */
async function build_cctld_lookup(rootZoneContent: string): Promise<Set<string>> {
  const entries = parse_root_zone_db(rootZoneContent);
  const ccTlds = new Set<string>();
  const { toASCII } = await import("ts-punycode");

  for (const entry of entries) {
    if (entry.type === "country-code") {
      ccTlds.add(entry.tld);

      // Also add punycode version if this is a Unicode TLD
      if (!entry.tld.startsWith("xn--")) {
        try {
          const punycode = toASCII(entry.tld);
          ccTlds.add(punycode);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Failed to convert Unicode ccTLD '${entry.tld}' to punycode: ${message}`);
        }
      }
    }
  }

  return ccTlds;
}

/**
 * Analyze TLD counts from the IANA TLD list file.
 * Uses Root Zone DB as source of truth for ccTLD classification.
 *
 * @param content - The content of the TLD list file
 * @param rootZoneContent - HTML content of Root Zone Database for ccTLD lookup
 * @returns TLD count summary
 */
export async function analyze_tlds_file(
  content: string,
  rootZoneContent: string,
): Promise<TldCounts> {
  const tlds = parse_tlds_file(content);
  const ccTldLookup = await build_cctld_lookup(rootZoneContent);

  const ccTlds = tlds.filter((tld) => ccTldLookup.has(tld));
  const gTlds = tlds.filter((tld) => !ccTldLookup.has(tld));
  const idns = tlds.filter((tld) => is_idn(tld));
  const idnBreakdown = analyze_idn_breakdown(tlds, ccTldLookup);

  return {
    total: tlds.length,
    ccTlds: ccTlds.length,
    gTlds: gTlds.length,
    idns: idns.length,
    idnBreakdown,
  };
}

/**
 * Analyze TLD counts from the IANA RDAP bootstrap file.
 * Uses Root Zone DB as source of truth for ccTLD classification.
 *
 * @param services - The services array from RDAP bootstrap JSON
 * @param rootZoneContent - HTML content of Root Zone Database for ccTLD lookup
 * @returns TLD count summary
 */
export async function analyze_rdap_bootstrap(
  services: unknown[],
  rootZoneContent: string,
): Promise<TldCounts> {
  const tlds = parse_bootstrap_tlds(services);
  const ccTldLookup = await build_cctld_lookup(rootZoneContent);

  const ccTlds = tlds.filter((tld) => ccTldLookup.has(tld));
  const gTlds = tlds.filter((tld) => !ccTldLookup.has(tld));
  const idns = tlds.filter((tld) => is_idn(tld));
  const idnBreakdown = analyze_idn_breakdown(tlds, ccTldLookup);

  return {
    total: tlds.length,
    ccTlds: ccTlds.length,
    gTlds: gTlds.length,
    idns: idns.length,
    idnBreakdown,
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

  // Build ccTLD lookup (synchronous version for Root Zone DB only)
  const ccTldLookup = new Set(
    entries.filter((e) => e.type === "country-code").map((e) => e.tld)
  );

  // Count by type from the Root Zone DB (all entries)
  const ccTlds = entries.filter((entry) => entry.type === "country-code");
  const gTlds = entries.filter((entry) => entry.type !== "country-code");

  // Count IDNs
  const idns = entries.filter((entry) => is_idn(entry.tld));
  const allTlds = entries.map((e) => e.tld);
  const idnBreakdown = analyze_idn_breakdown(allTlds, ccTldLookup);

  // Count delegation status
  const delegated = entries.filter((entry) => entry.delegated).length;
  const undelegated = entries.filter((entry) => !entry.delegated).length;

  // Count delegated-only TLDs (for apples-to-apples comparison)
  const delegatedEntries = entries.filter((entry) => entry.delegated);
  const delegatedCcTlds = delegatedEntries.filter((entry) => entry.type === "country-code");
  const delegatedGTlds = delegatedEntries.filter((entry) => entry.type !== "country-code");
  const delegatedIdns = delegatedEntries.filter((entry) => is_idn(entry.tld));
  const delegatedTlds = delegatedEntries.map((e) => e.tld);
  const delegatedIdnBreakdown = analyze_idn_breakdown(delegatedTlds, ccTldLookup);

  // Count undelegated TLDs by type
  const undelegatedEntries = entries.filter((entry) => !entry.delegated);
  const undelegatedCcTlds = undelegatedEntries.filter((entry) => entry.type === "country-code").length;
  const undelegatedGTlds = undelegatedEntries.filter((entry) => entry.type !== "country-code").length;

  // Count by category (all entries)
  const byCategory = {
    "country-code": entries.filter((e) => e.type === "country-code").length,
    "generic": entries.filter((e) => e.type === "generic").length,
    "sponsored": entries.filter((e) => e.type === "sponsored").length,
    "infrastructure": entries.filter((e) => e.type === "infrastructure").length,
    "test": entries.filter((e) => e.type === "test").length,
    "generic-restricted": entries.filter((e) => e.type === "generic-restricted").length,
  };

  // Count by category (delegated only)
  const delegatedByCategory = {
    "country-code": delegatedEntries.filter((e) => e.type === "country-code").length,
    "generic": delegatedEntries.filter((e) => e.type === "generic").length,
    "sponsored": delegatedEntries.filter((e) => e.type === "sponsored").length,
    "infrastructure": delegatedEntries.filter((e) => e.type === "infrastructure").length,
    "test": delegatedEntries.filter((e) => e.type === "test").length,
    "generic-restricted": delegatedEntries.filter((e) => e.type === "generic-restricted").length,
  };

  return {
    total: entries.length,
    ccTlds: ccTlds.length,
    gTlds: gTlds.length,
    idns: idns.length,
    idnBreakdown,
    delegated,
    undelegated,
    undelegatedCcTlds,
    undelegatedGTlds,
    delegatedCounts: {
      total: delegatedEntries.length,
      ccTlds: delegatedCcTlds.length,
      gTlds: delegatedGTlds.length,
      idns: delegatedIdns.length,
      idnBreakdown: delegatedIdnBreakdown,
    },
    byCategory,
    delegatedByCategory,
  };
}

/**
 * Compare TLD counts across all three data sources.
 * Uses Root Zone DB as source of truth for ccTLD classification.
 *
 * @param tldsFileContent - Content of the TLD list file
 * @param rdapServices - Services array from RDAP bootstrap JSON
 * @param rootZoneContent - HTML content of Root Zone Database
 * @returns Comparison object with counts from each source
 */
export async function compare_tld_sources(
  tldsFileContent: string,
  rdapServices: unknown[],
  rootZoneContent: string,
): Promise<{
  tldsFile: TldCounts;
  rdapBootstrap: TldCounts;
  rootZoneDb: RootZoneAnalysis;
}> {
  return {
    tldsFile: await analyze_tlds_file(tldsFileContent, rootZoneContent),
    rdapBootstrap: await analyze_rdap_bootstrap(rdapServices, rootZoneContent),
    rootZoneDb: analyze_root_zone_db(rootZoneContent),
  };
}

/**
 * RDAP coverage analysis results
 */
export interface RdapCoverageAnalysis {
  totalDelegatedGTlds: number;
  gTldsWithRdap: number;
  gTldsWithoutRdap: number;
  missingGTlds: Array<{
    tld: string;
    type: string;
  }>;
}

/**
 * Analyze RDAP coverage for delegated generic TLDs.
 * Finds which delegated gTLDs don't have RDAP servers yet.
 *
 * @param rdapServices - Services array from RDAP bootstrap JSON
 * @param rootZoneContent - HTML content of Root Zone Database
 * @returns RDAP coverage analysis with missing gTLDs
 */
export async function analyze_rdap_coverage(
  rdapServices: unknown[],
  rootZoneContent: string,
): Promise<RdapCoverageAnalysis> {
  // Get TLDs from RDAP bootstrap (in punycode format)
  const rdapTlds = new Set(parse_bootstrap_tlds(rdapServices));

  // Get delegated entries from Root Zone DB
  const rootZoneEntries = parse_root_zone_db(rootZoneContent);

  // Filter for delegated generic TLDs only (non-ccTLD)
  const delegatedGenericTlds = rootZoneEntries.filter(
    (entry) => entry.delegated && entry.type !== "country-code"
  );

  // Import punycode converter
  const { toASCII } = await import("ts-punycode");

  // Find which delegated generics are missing from RDAP
  // Need to check both Unicode and punycode versions
  const missingDelegatedGenerics = delegatedGenericTlds.filter(
    (entry) => {
      // Check if the TLD exists in RDAP as-is
      if (rdapTlds.has(entry.tld)) {
        return false;
      }

      // If it's not punycode already, try converting to punycode
      if (!entry.tld.startsWith("xn--")) {
        try {
          const punycode = toASCII(entry.tld);
          if (rdapTlds.has(punycode)) {
            return false;
          }
        } catch (error) {
          // If conversion fails, we'll consider it missing
          console.error(`Failed to convert '${entry.tld}' to punycode: ${error}`);
        }
      }

      return true;
    }
  );

  return {
    totalDelegatedGTlds: delegatedGenericTlds.length,
    gTldsWithRdap: delegatedGenericTlds.length - missingDelegatedGenerics.length,
    gTldsWithoutRdap: missingDelegatedGenerics.length,
    missingGTlds: missingDelegatedGenerics.map((entry) => ({
      tld: entry.tld,
      type: entry.type,
    })).sort((a, b) => a.tld.localeCompare(b.tld)),
  };
}

/**
 * Bootstrap vs Root Zone comparison results
 */
export interface BootstrapVsRootZoneComparison {
  rdapCount: number;
  rootZoneCount: number;
  inBoth: number;
  onlyInRootZone: string[];
  onlyInRdap: string[];
  onlyInRootZoneByType: Map<string, string[]>;
}

/**
 * TLDs txt vs Root Zone comparison results
 */
export interface TldsVsRootZoneComparison {
  tldsCount: number;
  rootZoneCount: number;
  inBoth: number;
  onlyInRootZone: string[];
  onlyInTlds: string[];
  onlyInRootZoneByType: Map<string, string[]>;
}

/**
 * Compare RDAP Bootstrap TLDs vs Root Zone Database TLDs.
 *
 * @param rdapServices - Services array from RDAP bootstrap JSON
 * @param rootZoneContent - HTML content of Root Zone Database
 * @returns Comparison showing differences between the two sources
 */
export function compare_bootstrap_vs_rootzone(
  rdapServices: unknown[],
  rootZoneContent: string,
): BootstrapVsRootZoneComparison {
  // Get TLDs from RDAP bootstrap
  const rdapTlds = new Set(parse_bootstrap_tlds(rdapServices));

  // Get TLDs from Root Zone DB
  const rootZoneEntries = parse_root_zone_db(rootZoneContent);
  const rootZoneTlds = new Set(rootZoneEntries.map((e) => e.tld));

  // Find differences
  const onlyInRootZone = [...rootZoneTlds].filter((tld) => !rdapTlds.has(tld));
  const onlyInRdap = [...rdapTlds].filter((tld) => !rootZoneTlds.has(tld));
  const inBoth = rdapTlds.size - onlyInRdap.length;

  // Group Root Zone only TLDs by type
  const onlyInRootZoneByType = new Map<string, string[]>();
  for (const tld of onlyInRootZone) {
    const entry = rootZoneEntries.find((e) => e.tld === tld);
    if (entry) {
      const list = onlyInRootZoneByType.get(entry.type) || [];
      list.push(tld);
      onlyInRootZoneByType.set(entry.type, list);
    }
  }

  return {
    rdapCount: rdapTlds.size,
    rootZoneCount: rootZoneTlds.size,
    inBoth,
    onlyInRootZone: onlyInRootZone.sort(),
    onlyInRdap: onlyInRdap.sort(),
    onlyInRootZoneByType,
  };
}

/**
 * Compare TLDs txt file vs Root Zone Database TLDs.
 *
 * @param tldsFileContent - Content of the TLD list file
 * @param rootZoneContent - HTML content of Root Zone Database
 * @returns Comparison showing differences between the two sources
 */
export function compare_tlds_vs_rootzone(
  tldsFileContent: string,
  rootZoneContent: string,
): TldsVsRootZoneComparison {
  // Get TLDs from TLDs file
  const tldsList = parse_tlds_file(tldsFileContent);
  const tldsTlds = new Set(tldsList);

  // Get TLDs from Root Zone DB
  const rootZoneEntries = parse_root_zone_db(rootZoneContent);
  const rootZoneTlds = new Set(rootZoneEntries.map((e) => e.tld));

  // Find differences
  const onlyInRootZone = [...rootZoneTlds].filter((tld) => !tldsTlds.has(tld));
  const onlyInTlds = [...tldsTlds].filter((tld) => !rootZoneTlds.has(tld));
  const inBoth = tldsTlds.size - onlyInTlds.length;

  // Group Root Zone only TLDs by type
  const onlyInRootZoneByType = new Map<string, string[]>();
  for (const tld of onlyInRootZone) {
    const entry = rootZoneEntries.find((e) => e.tld === tld);
    if (entry) {
      const list = onlyInRootZoneByType.get(entry.type) || [];
      list.push(tld);
      onlyInRootZoneByType.set(entry.type, list);
    }
  }

  return {
    tldsCount: tldsTlds.size,
    rootZoneCount: rootZoneTlds.size,
    inBoth,
    onlyInRootZone: onlyInRootZone.sort(),
    onlyInTlds: onlyInTlds.sort(),
    onlyInRootZoneByType,
  };
}
