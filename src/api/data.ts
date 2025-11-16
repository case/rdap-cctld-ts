/**
 * API Data Layer - Pure data access functions
 *
 * This module provides high-level functions for accessing IANA TLD/RDAP data.
 * All functions are environment-aware and work in both local and Val Town.
 *
 * Used by:
 * - CLI (direct import for fast access)
 * - HTTP API routes (via routes.ts)
 */

import { FILENAMES, LOCAL_PATHS } from "../config.ts";
import { get_data_from_file } from "../utilities.ts";
import {
  parse_root_zone_db,
  parse_tlds_file,
  type TldEntry,
} from "../parse.ts";
import {
  analyze_rdap_bootstrap,
  analyze_rdap_coverage,
  analyze_root_zone_db,
  analyze_tlds_file,
  analyze_tlds_json,
  analyzeSupplementalCcTldData,
  compare_bootstrap_vs_rootzone,
  compare_tlds_vs_rootzone,
  type BootstrapVsRootZoneComparison,
  type SupplementalCcTldAnalysis,
  type SupplementalRdapEntry,
  type RdapCoverageAnalysis,
  type RootZoneAnalysis,
  type TldCounts,
  type TldsJsonAnalysis,
  type TldsVsRootZoneComparison,
} from "../analyze.ts";

/**
 * RDAP Bootstrap data structure
 */
export interface RdapBootstrapData {
  version: string;
  publication: string;
  description: string;
  services: unknown[];
}

/**
 * Get parsed RDAP Bootstrap data
 */
export async function getRdapBootstrapData(): Promise<RdapBootstrapData> {
  const content = await get_data_from_file(FILENAMES.RDAP_BOOTSTRAP);

  try {
    return JSON.parse(content) as RdapBootstrapData;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse RDAP bootstrap JSON: ${message}`);
  }
}

/**
 * Get parsed TLDs list
 */
export async function getTldsList(): Promise<string[]> {
  const content = await get_data_from_file(FILENAMES.TLD_LIST);
  return parse_tlds_file(content);
}

/**
 * Get parsed Root Zone Database entries
 */
export async function getRootZoneEntries(): Promise<TldEntry[]> {
  const content = await get_data_from_file(FILENAMES.ROOT_ZONE_DB);
  return parse_root_zone_db(content);
}

/**
 * Get TLD list analysis
 */
export async function getTldsAnalysis(): Promise<TldCounts> {
  const tldsContent = await get_data_from_file(FILENAMES.TLD_LIST);
  const rootZoneContent = await get_data_from_file(FILENAMES.ROOT_ZONE_DB);
  return await analyze_tlds_file(tldsContent, rootZoneContent);
}

/**
 * Get RDAP Bootstrap analysis
 */
export async function getRdapBootstrapAnalysis(): Promise<TldCounts> {
  const rdapData = await getRdapBootstrapData();
  const rootZoneContent = await get_data_from_file(FILENAMES.ROOT_ZONE_DB);
  return await analyze_rdap_bootstrap(rdapData.services, rootZoneContent);
}

/**
 * Get Root Zone Database analysis
 */
export async function getRootZoneAnalysis(): Promise<RootZoneAnalysis> {
  const content = await get_data_from_file(FILENAMES.ROOT_ZONE_DB);
  return analyze_root_zone_db(content);
}

/**
 * Get RDAP coverage analysis
 */
export async function getRdapCoverageAnalysis(): Promise<
  RdapCoverageAnalysis
> {
  const rdapData = await getRdapBootstrapData();
  const rootZoneContent = await get_data_from_file(FILENAMES.ROOT_ZONE_DB);
  return await analyze_rdap_coverage(rdapData.services, rootZoneContent);
}

/**
 * Compare RDAP Bootstrap vs Root Zone Database
 */
export async function getBootstrapVsRootZoneComparison(): Promise<
  BootstrapVsRootZoneComparison
> {
  const rdapData = await getRdapBootstrapData();
  const rootZoneContent = await get_data_from_file(FILENAMES.ROOT_ZONE_DB);
  return compare_bootstrap_vs_rootzone(rdapData.services, rootZoneContent);
}

/**
 * Compare TLDs txt vs Root Zone Database
 */
export async function getTldsVsRootZoneComparison(): Promise<
  TldsVsRootZoneComparison
> {
  const tldsContent = await get_data_from_file(FILENAMES.TLD_LIST);
  const rootZoneContent = await get_data_from_file(FILENAMES.ROOT_ZONE_DB);
  return compare_tlds_vs_rootzone(tldsContent, rootZoneContent);
}

/**
 * Get analysis of enhanced tlds.json file
 */
export async function getTldsJsonAnalysis(): Promise<TldsJsonAnalysis> {
  const jsonContent = await get_data_from_file(FILENAMES.TLDS_JSON, LOCAL_PATHS.GENERATED_DIR);
  const supplementalData = await getSupplementalData();
  return analyze_tlds_json(jsonContent, supplementalData);
}

/**
 * Get supplemental data
 */
export async function getSupplementalData(): Promise<import("../analyze.ts").SupplementalData> {
  try {
    const content = await get_data_from_file(FILENAMES.SUPPLEMENTAL, LOCAL_PATHS.DATA_DIR);
    return JSON.parse(content) as import("../analyze.ts").SupplementalData;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load supplemental data: ${message}`);
  }
}

/**
 * Get supplemental ccTLD RDAP data
 */
export async function getSupplementalCcTldData(): Promise<SupplementalRdapEntry[]> {
  const supplemental = await getSupplementalData();
  return supplemental.ccTldRdapServers;
}

/**
 * Get analysis of supplemental ccTLD RDAP data
 */
export async function getSupplementalCcTldAnalysis(): Promise<SupplementalCcTldAnalysis> {
  const data = await getSupplementalCcTldData();
  return analyzeSupplementalCcTldData(data);
}

/**
 * Get analysis of all individual IANA source files
 */
export async function getSourceFilesAnalysis(): Promise<{
  tldsFile: TldCounts;
  rdapBootstrap: TldCounts;
  rootZoneDb: RootZoneAnalysis;
  rdapCoverage: RdapCoverageAnalysis;
  tldsJson: TldsJsonAnalysis;
}> {
  const [tldsFile, rdapBootstrap, rootZoneDb, rdapCoverage, tldsJson] = await Promise
    .all([
      getTldsAnalysis(),
      getRdapBootstrapAnalysis(),
      getRootZoneAnalysis(),
      getRdapCoverageAnalysis(),
      getTldsJsonAnalysis(),
    ]);

  return {
    tldsFile,
    rdapBootstrap,
    rootZoneDb,
    rdapCoverage,
    tldsJson,
  };
}
