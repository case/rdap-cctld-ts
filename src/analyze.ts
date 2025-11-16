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
 * Comparison of RDAP server groupings vs TLD manager groupings
 */
export interface RdapVsManagerComparison {
  rdapServerGroups: number; // Number of unique RDAP server combinations
  managerGroups: number; // Number of unique TLD managers
  rdapGroupsWithMultipleTlds: number; // RDAP server groups managing 2+ TLDs
  managerGroupsWithMultipleTlds: number; // Managers managing 2+ TLDs
  largestRdapGroup: {
    serverCount: number;
    tldCount: number;
    servers: string[];
  };
  largestManagerGroup: {
    manager: string;
    tldCount: number;
  };
}

/**
 * TLD Manager grouping information
 */
export interface ManagerGrouping {
  totalUniqueManagers: number;
  managersWithMultipleTlds: number;
  managerGroups: Array<{
    manager: string;
    tldCount: number;
    ccTldCount: number;
    gTldCount: number;
    tlds: string[];
    ccTlds: string[];
    gTlds: string[];
    isAlias?: boolean; // true if this is an alias parent
    subsidiaries?: Array<{
      name: string;
      tldCount: number;
      ccTldCount: number;
      gTldCount: number;
      tlds: string[];
      ccTlds: string[];
      gTlds: string[];
    }>;
  }>;
}

/**
 * Enhanced TLDs JSON analysis
 */
export interface TldsJsonAnalysis extends TldCounts {
  totalServices: number;
  tldsWithRdap: number;
  tldsWithoutRdap: number;
  ccTldsWithRdap: number;
  gTldsWithRdap: number;
  rdapVsManagerComparison: RdapVsManagerComparison;
  managerGrouping: ManagerGrouping;
  idnMap: Record<string, string>; // ASCII to Unicode mapping
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
async function build_cctld_lookup(
  rootZoneContent: string,
): Promise<Set<string>> {
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
          const message = error instanceof Error
            ? error.message
            : String(error);
          console.error(
            `Failed to convert Unicode ccTLD '${entry.tld}' to punycode: ${message}`,
          );
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
    entries.filter((e) => e.type === "country-code").map((e) => e.tld),
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
  const delegatedCcTlds = delegatedEntries.filter((entry) =>
    entry.type === "country-code"
  );
  const delegatedGTlds = delegatedEntries.filter((entry) =>
    entry.type !== "country-code"
  );
  const delegatedIdns = delegatedEntries.filter((entry) => is_idn(entry.tld));
  const delegatedTlds = delegatedEntries.map((e) => e.tld);
  const delegatedIdnBreakdown = analyze_idn_breakdown(
    delegatedTlds,
    ccTldLookup,
  );

  // Count undelegated TLDs by type
  const undelegatedEntries = entries.filter((entry) => !entry.delegated);
  const undelegatedCcTlds =
    undelegatedEntries.filter((entry) => entry.type === "country-code").length;
  const undelegatedGTlds =
    undelegatedEntries.filter((entry) => entry.type !== "country-code").length;

  // Count by category (all entries)
  const byCategory = {
    "country-code": entries.filter((e) => e.type === "country-code").length,
    "generic": entries.filter((e) => e.type === "generic").length,
    "sponsored": entries.filter((e) => e.type === "sponsored").length,
    "infrastructure": entries.filter((e) => e.type === "infrastructure").length,
    "test": entries.filter((e) => e.type === "test").length,
    "generic-restricted":
      entries.filter((e) => e.type === "generic-restricted").length,
  };

  // Count by category (delegated only)
  const delegatedByCategory = {
    "country-code":
      delegatedEntries.filter((e) => e.type === "country-code").length,
    "generic": delegatedEntries.filter((e) => e.type === "generic").length,
    "sponsored": delegatedEntries.filter((e) => e.type === "sponsored").length,
    "infrastructure":
      delegatedEntries.filter((e) => e.type === "infrastructure").length,
    "test": delegatedEntries.filter((e) => e.type === "test").length,
    "generic-restricted":
      delegatedEntries.filter((e) => e.type === "generic-restricted").length,
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
    (entry) => entry.delegated && entry.type !== "country-code",
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
          console.error(
            `Failed to convert '${entry.tld}' to punycode: ${error}`,
          );
        }
      }

      return true;
    },
  );

  return {
    totalDelegatedGTlds: delegatedGenericTlds.length,
    gTldsWithRdap: delegatedGenericTlds.length -
      missingDelegatedGenerics.length,
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

/**
 * TLD entry for the enhanced JSON output
 */
interface TldInfo {
  tld: string;
  type: "gtld" | "cctld";
  idn: {
    ascii: string;
    unicode: string;
  } | null;
  tags: string[];
  manager?: string;
}

/**
 * Service entry grouping TLDs by their RDAP server(s)
 */
interface ServiceEntry {
  tlds: TldInfo[];
  rdapServers: string[];
}

/**
 * Enhanced TLD JSON structure
 */
interface EnhancedTldJson {
  description: string;
  generated: string;
  services: ServiceEntry[];
}

/**
 * Manual ccTLD RDAP entry
 */
export interface ManualRdapEntry {
  tld: string;
  rdapServer: string;
  backendOperator: string;
  dateUpdated: string;
  source: string;
  notes: string;
}

/**
 * Manager alias entry with source attribution
 */
export interface ManagerAliasEntry {
  name: string;
  source: string | null;
}

/**
 * Supplemental data structure
 */
export interface SupplementalData {
  ccTldRdapServers: ManualRdapEntry[];
  managerAliases: Record<string, ManagerAliasEntry[]>;
}

/**
 * Analysis of manual ccTLD RDAP data
 */
export interface ManualCcTldAnalysis {
  totalTlds: number;
  uniqueRdapHosts: number;
  uniqueBackendOperators: number;
  rdapHostGroups: Array<{
    host: string;
    tldCount: number;
    tlds: string[];
  }>;
  backendOperatorGroups: Array<{
    operator: string;
    tldCount: number;
    tlds: string[];
  }>;
}

/**
 * Build enhanced TLD JSON file combining IANA RDAP bootstrap with Root Zone DB metadata.
 *
 * This function assembles a comprehensive TLD dataset that includes:
 * - Only delegated TLDs from Root Zone DB
 * - TLD type (gtld/cctld) classification
 * - RDAP server information from IANA bootstrap + manual ccTLD data
 * - IDN information (both ASCII/punycode and Unicode variants)
 * - Grouped by RDAP server to avoid URL duplication
 *
 * @param rdapServices - Services array from IANA RDAP bootstrap JSON
 * @param rootZoneContent - HTML content of Root Zone Database
 * @param manualCcTldData - Manual ccTLD RDAP server data (optional)
 * @returns Enhanced TLD JSON structure
 */
export async function build_tlds_json(
  rdapServices: unknown[],
  rootZoneContent: string,
  manualCcTldData?: ManualRdapEntry[],
): Promise<EnhancedTldJson> {
  const { toASCII, toUnicode } = await import("ts-punycode");

  // Parse root zone DB to get all TLDs with their types and delegation status
  const rootZoneEntries = parse_root_zone_db(rootZoneContent);

  // Filter to only delegated TLDs and build lookup maps
  const delegatedEntries = rootZoneEntries.filter((entry) => entry.delegated);
  const tldTypeMap = new Map<string, "gtld" | "cctld">();
  const tldCategoryMap = new Map<string, string>(); // Maps TLD to its category (generic, sponsored, etc.)
  const tldManagerMap = new Map<string, string>(); // Maps TLD to its manager

  for (const entry of delegatedEntries) {
    const type = entry.type === "country-code" ? "cctld" : "gtld";
    tldTypeMap.set(entry.tld, type);
    tldCategoryMap.set(entry.tld, entry.type);
    if (entry.manager) {
      tldManagerMap.set(entry.tld, entry.manager);
    }

    // Also add punycode version for Unicode TLDs
    if (!entry.tld.startsWith("xn--")) {
      try {
        const ascii = toASCII(entry.tld);
        tldTypeMap.set(ascii, type);
        tldCategoryMap.set(ascii, entry.type);
        if (entry.manager) {
          tldManagerMap.set(ascii, entry.manager);
        }
      } catch (error) {
        // Conversion failed, skip
      }
    }
  }

  // Build map of TLD -> RDAP servers from IANA bootstrap
  const tldToServers = new Map<string, string[]>();

  for (const service of rdapServices) {
    if (Array.isArray(service) && service.length >= 2) {
      const tlds = service[0];
      const servers = service[1];

      if (Array.isArray(tlds) && Array.isArray(servers)) {
        for (const tld of tlds) {
          if (typeof tld === "string") {
            const cleanTld = tld.replace(/^\./, "").toLowerCase();
            // Only include if it's a delegated TLD
            if (tldTypeMap.has(cleanTld)) {
              tldToServers.set(
                cleanTld,
                servers.filter((s) => typeof s === "string"),
              );
            }
          }
        }
      }
    }
  }

  // Add manual ccTLD RDAP data
  if (manualCcTldData) {
    for (const entry of manualCcTldData) {
      const cleanTld = entry.tld.toLowerCase();
      // Only add if it's a delegated ccTLD
      if (tldTypeMap.has(cleanTld) && tldTypeMap.get(cleanTld) === "cctld") {
        tldToServers.set(cleanTld, [entry.rdapServer]);
      }
    }
  }

  // Group TLDs by their RDAP server(s) signature
  // We use JSON.stringify of sorted servers as the grouping key
  const serverGroups = new Map<
    string,
    { tlds: Set<string>; servers: string[] }
  >();

  for (const [tld, servers] of tldToServers.entries()) {
    const sortedServers = [...servers].sort();
    const key = JSON.stringify(sortedServers);

    if (!serverGroups.has(key)) {
      serverGroups.set(key, { tlds: new Set(), servers: sortedServers });
    }
    serverGroups.get(key)!.tlds.add(tld);
  }

  // Also handle ALL delegated TLDs without RDAP servers (both ccTLDs and gTLDs)
  const tldsWithoutRdap = new Set<string>();
  for (const [tld, type] of tldTypeMap.entries()) {
    if (!tldToServers.has(tld)) {
      // Only add punycode version for IDNs (skip Unicode variants since they're duplicates)
      if (tld.startsWith("xn--") || !/[^\x00-\x7F]/.test(tld)) {
        tldsWithoutRdap.add(tld);
      }
    }
  }

  if (tldsWithoutRdap.size > 0) {
    serverGroups.set("[]", { tlds: tldsWithoutRdap, servers: [] });
  }

  // Build service entries with TLD info
  const services: ServiceEntry[] = [];

  for (const { tlds, servers } of serverGroups.values()) {
    const tldInfos: TldInfo[] = [];

    for (const tld of Array.from(tlds).sort()) {
      const type = tldTypeMap.get(tld);
      if (!type) continue; // Skip if not in our delegated list

      // Determine IDN info
      let idn: TldInfo["idn"] = null;

      if (tld.startsWith("xn--")) {
        // ASCII punycode format - convert to unicode
        try {
          const unicode = toUnicode(tld);
          idn = { ascii: tld, unicode };
        } catch (error) {
          // Conversion failed, just use ASCII
          idn = { ascii: tld, unicode: tld };
        }
      } else if (/[^\x00-\x7F]/.test(tld)) {
        // Unicode format - convert to ASCII
        try {
          const ascii = toASCII(tld);
          idn = { ascii, unicode: tld };
        } catch (error) {
          // Conversion failed, just use unicode
          idn = { ascii: tld, unicode: tld };
        }
      }

      // Build tags array based on category
      const tags: string[] = [];
      const category = tldCategoryMap.get(tld);

      // Add category-based tags (exclude country-code since we already have type field)
      if (category && category !== "country-code") {
        tags.push(category);
      }

      // Get manager for this TLD
      const manager = tldManagerMap.get(tld);

      tldInfos.push({ tld, type, idn, tags, manager });
    }

    if (tldInfos.length > 0) {
      services.push({
        tlds: tldInfos,
        rdapServers: servers,
      });
    }
  }

  // Sort services by first TLD alphabetically
  services.sort((a, b) => {
    const firstA = a.tlds[0]?.tld || "";
    const firstB = b.tlds[0]?.tld || "";
    return firstA.localeCompare(firstB);
  });

  return {
    description: "All delegated top-level domains, and their RDAP servers",
    generated: new Date().toISOString().split('.')[0] + 'Z',
    services,
  };
}

/**
 * Analyze the enhanced tlds.json file
 * @param jsonContent - The tlds.json content as a string
 * @param supplementalData - Optional supplemental data with manager aliases
 * @returns Analysis of the TLDs JSON file
 */
export function analyze_tlds_json(
  jsonContent: string,
  supplementalData?: SupplementalData,
): TldsJsonAnalysis {
  const data = JSON.parse(jsonContent);

  // Flatten all TLDs from all services
  const allTlds: Array<{ tld: string; type: "gtld" | "cctld"; idn: { ascii: string; unicode: string } | null }> = [];

  for (const service of data.services) {
    if (service.tlds && Array.isArray(service.tlds)) {
      allTlds.push(...service.tlds);
    }
  }

  // Build IDN mapping (ASCII to Unicode)
  const idnMap: Record<string, string> = {};
  for (const tldObj of allTlds) {
    if (tldObj.idn && tldObj.idn.ascii !== tldObj.idn.unicode) {
      idnMap[tldObj.idn.ascii] = tldObj.idn.unicode;
    }
  }

  // Count by type
  const ccTlds = allTlds.filter(t => t.type === "cctld").length;
  const gTlds = allTlds.filter(t => t.type === "gtld").length;

  // Count IDNs
  const idns = allTlds.filter(t => t.idn !== null);
  const idnCcTlds = idns.filter(t => t.type === "cctld").length;
  const idnGTlds = idns.filter(t => t.type === "gtld").length;
  const asciiIdns = idns.filter(t => t.idn?.ascii.startsWith("xn--")).length;
  const unicodeIdns = idns.filter(t => t.idn && !t.idn.ascii.startsWith("xn--")).length;

  // Count TLDs with/without RDAP
  const tldsWithRdap = data.services
    .filter((s: { rdapServers: string[] }) => s.rdapServers.length > 0)
    .reduce((count: number, s: { tlds: unknown[] }) => count + s.tlds.length, 0);

  const tldsWithoutRdap = data.services
    .filter((s: { rdapServers: string[] }) => s.rdapServers.length === 0)
    .reduce((count: number, s: { tlds: unknown[] }) => count + s.tlds.length, 0);

  // Count ccTLDs and gTLDs with RDAP
  const tldsWithRdapList = data.services
    .filter((s: { rdapServers: string[] }) => s.rdapServers.length > 0)
    .flatMap((s: { tlds: Array<{ type: string }> }) => s.tlds);

  const ccTldsWithRdap = tldsWithRdapList.filter((t: { type: string }) => t.type === "cctld").length;
  const gTldsWithRdap = tldsWithRdapList.filter((t: { type: string }) => t.type === "gtld").length;

  // Analyze RDAP server groupings vs TLD manager groupings
  const rdapVsManagerComparison = analyzeRdapVsManager(data.services);

  // Analyze TLD manager groupings
  const managerGrouping = analyzeManagerGrouping(data.services, supplementalData);

  return {
    total: allTlds.length,
    ccTlds,
    gTlds,
    idns: idns.length,
    idnBreakdown: {
      total: idns.length,
      ccTlds: idnCcTlds,
      gTlds: idnGTlds,
      ascii: asciiIdns,
      unicode: unicodeIdns,
    },
    totalServices: data.services.length,
    tldsWithRdap,
    tldsWithoutRdap,
    ccTldsWithRdap,
    gTldsWithRdap,
    rdapVsManagerComparison,
    managerGrouping,
    idnMap,
  };
}

/**
 * Analyze RDAP server groupings vs TLD manager groupings
 */
function analyzeRdapVsManager(
  services: Array<{
    tlds: Array<{ tld: string; manager?: string }>;
    rdapServers: string[];
  }>,
): RdapVsManagerComparison {
  // Count RDAP server groups (excluding empty RDAP groups)
  const rdapServerGroups = services.filter((s) => s.rdapServers.length > 0);
  const rdapGroupsWithMultipleTlds = rdapServerGroups.filter(
    (s) => s.tlds.length > 1,
  ).length;

  // Find largest RDAP group
  let largestRdapGroup = {
    serverCount: 0,
    tldCount: 0,
    servers: [] as string[],
  };

  for (const service of rdapServerGroups) {
    if (service.tlds.length > largestRdapGroup.tldCount) {
      largestRdapGroup = {
        serverCount: service.rdapServers.length,
        tldCount: service.tlds.length,
        servers: service.rdapServers,
      };
    }
  }

  // Group TLDs by manager
  const managerToTlds = new Map<string, string[]>();

  for (const service of services) {
    for (const tld of service.tlds) {
      if (tld.manager) {
        const existing = managerToTlds.get(tld.manager) || [];
        existing.push(tld.tld);
        managerToTlds.set(tld.manager, existing);
      }
    }
  }

  const managerGroups = managerToTlds.size;
  const managerGroupsWithMultipleTlds = Array.from(managerToTlds.values())
    .filter((tlds) => tlds.length > 1).length;

  // Find largest manager group
  let largestManagerGroup = {
    manager: "",
    tldCount: 0,
  };

  for (const [manager, tlds] of managerToTlds.entries()) {
    if (tlds.length > largestManagerGroup.tldCount) {
      largestManagerGroup = {
        manager,
        tldCount: tlds.length,
      };
    }
  }

  return {
    rdapServerGroups: rdapServerGroups.length,
    managerGroups,
    rdapGroupsWithMultipleTlds,
    managerGroupsWithMultipleTlds,
    largestRdapGroup,
    largestManagerGroup,
  };
}

/**
 * Analyze TLD manager groupings with alias consolidation
 */
function analyzeManagerGrouping(
  services: Array<{
    tlds: Array<{ tld: string; type: "gtld" | "cctld"; manager?: string }>;
    rdapServers: string[];
  }>,
  supplementalData?: SupplementalData,
): ManagerGrouping {
  // Group TLDs by manager
  const managerToTlds = new Map<
    string,
    { tlds: string[]; ccTlds: string[]; gTlds: string[] }
  >();

  for (const service of services) {
    for (const tld of service.tlds) {
      if (tld.manager) {
        const existing = managerToTlds.get(tld.manager) || {
          tlds: [],
          ccTlds: [],
          gTlds: [],
        };
        existing.tlds.push(tld.tld);
        if (tld.type === "cctld") {
          existing.ccTlds.push(tld.tld);
        } else {
          existing.gTlds.push(tld.tld);
        }
        managerToTlds.set(tld.manager, existing);
      }
    }
  }

  const totalUniqueManagers = managerToTlds.size;
  const managersWithMultipleTlds = Array.from(managerToTlds.values()).filter(
    (group) => group.tlds.length > 1,
  ).length;

  // Build reverse lookup: manager name -> alias name
  const managerToAlias = new Map<string, string>();
  if (supplementalData?.managerAliases) {
    for (const [aliasName, entries] of Object.entries(supplementalData.managerAliases)) {
      for (const entry of entries) {
        managerToAlias.set(entry.name, aliasName);
      }
    }
  }

  // Build manager groups with alias consolidation
  const aliasGroups = new Map<string, {
    tlds: string[];
    ccTlds: string[];
    gTlds: string[];
    subsidiaries: Map<string, { tlds: string[]; ccTlds: string[]; gTlds: string[] }>;
  }>();

  const standaloneManagers = new Map<string, { tlds: string[]; ccTlds: string[]; gTlds: string[] }>();

  for (const [manager, group] of managerToTlds.entries()) {
    const aliasName = managerToAlias.get(manager);

    if (aliasName) {
      // This manager belongs to an alias group
      const existing = aliasGroups.get(aliasName) || {
        tlds: [] as string[],
        ccTlds: [] as string[],
        gTlds: [] as string[],
        subsidiaries: new Map<string, { tlds: string[]; ccTlds: string[]; gTlds: string[] }>(),
      };

      // Add TLDs to the alias group total
      existing.tlds.push(...group.tlds);
      existing.ccTlds.push(...group.ccTlds);
      existing.gTlds.push(...group.gTlds);

      // Track this subsidiary
      existing.subsidiaries.set(manager, group);

      aliasGroups.set(aliasName, existing);
    } else {
      // Standalone manager (not part of any alias)
      standaloneManagers.set(manager, group);
    }
  }

  // Build final manager groups array
  const managerGroups: Array<{
    manager: string;
    tldCount: number;
    ccTldCount: number;
    gTldCount: number;
    tlds: string[];
    ccTlds: string[];
    gTlds: string[];
    isAlias?: boolean;
    subsidiaries?: Array<{
      name: string;
      tldCount: number;
      ccTldCount: number;
      gTldCount: number;
      tlds: string[];
      ccTlds: string[];
      gTlds: string[];
    }>;
  }> = [];

  // Add alias groups
  for (const [aliasName, group] of aliasGroups.entries()) {
    managerGroups.push({
      manager: aliasName,
      tldCount: group.tlds.length,
      ccTldCount: group.ccTlds.length,
      gTldCount: group.gTlds.length,
      tlds: group.tlds.sort(),
      ccTlds: group.ccTlds.sort(),
      gTlds: group.gTlds.sort(),
      isAlias: true,
      subsidiaries: Array.from(group.subsidiaries.entries()).map(([name, subGroup]) => ({
        name,
        tldCount: subGroup.tlds.length,
        ccTldCount: subGroup.ccTlds.length,
        gTldCount: subGroup.gTlds.length,
        tlds: subGroup.tlds.sort(),
        ccTlds: subGroup.ccTlds.sort(),
        gTlds: subGroup.gTlds.sort(),
      })).sort((a, b) => b.tldCount - a.tldCount),
    });
  }

  // Add standalone managers
  for (const [manager, group] of standaloneManagers.entries()) {
    managerGroups.push({
      manager,
      tldCount: group.tlds.length,
      ccTldCount: group.ccTlds.length,
      gTldCount: group.gTlds.length,
      tlds: group.tlds.sort(),
      ccTlds: group.ccTlds.sort(),
      gTlds: group.gTlds.sort(),
    });
  }

  // Sort by TLD count (descending)
  managerGroups.sort((a, b) => b.tldCount - a.tldCount);

  return {
    totalUniqueManagers,
    managersWithMultipleTlds,
    managerGroups,
  };
}

/**
 * Analyze manual ccTLD RDAP data
 */
export function analyzeManualCcTldData(
  data: ManualRdapEntry[],
): ManualCcTldAnalysis {
  // Group by RDAP host (extract hostname from URL)
  const hostToTlds = new Map<string, string[]>();

  for (const entry of data) {
    try {
      const url = new URL(entry.rdapServer);
      const host = url.hostname;
      const existing = hostToTlds.get(host) || [];
      existing.push(entry.tld);
      hostToTlds.set(host, existing);
    } catch {
      // Invalid URL, skip
    }
  }

  // Group by backend operator
  const operatorToTlds = new Map<string, string[]>();

  for (const entry of data) {
    const operator = entry.backendOperator;
    const existing = operatorToTlds.get(operator) || [];
    existing.push(entry.tld);
    operatorToTlds.set(operator, existing);
  }

  // Build RDAP host groups
  const rdapHostGroups = Array.from(hostToTlds.entries())
    .map(([host, tlds]) => ({
      host,
      tldCount: tlds.length,
      tlds: tlds.sort(),
    }))
    .sort((a, b) => b.tldCount - a.tldCount);

  // Build backend operator groups
  const backendOperatorGroups = Array.from(operatorToTlds.entries())
    .map(([operator, tlds]) => ({
      operator,
      tldCount: tlds.length,
      tlds: tlds.sort(),
    }))
    .sort((a, b) => b.tldCount - a.tldCount);

  return {
    totalTlds: data.length,
    uniqueRdapHosts: hostToTlds.size,
    uniqueBackendOperators: operatorToTlds.size,
    rdapHostGroups,
    backendOperatorGroups,
  };
}
