/**
 * Configuration constants for IANA data sources
 */

/**
 * IANA data source URLs
 */
export const IANA_URLS = {
  RDAP_BOOTSTRAP: "https://data.iana.org/rdap/dns.json",
  TLD_LIST: "https://data.iana.org/TLD/tlds-alpha-by-domain.txt",
  ROOT_ZONE_DB: "https://www.iana.org/domains/root/db",
} as const;

/**
 * Local directory paths
 */
export const LOCAL_PATHS = {
  DATA_DIR: "data",
  CANONICAL_DIR: "data/canonical",
  GENERATED_DIR: "data/generated",
} as const;

/**
 * Local filenames for IANA data and generated files
 */
export const FILENAMES = {
  // IANA canonical data
  RDAP_BOOTSTRAP: "iana-rdap.json",
  TLD_LIST: "iana-all.txt",
  ROOT_ZONE_DB: "iana-root.html",

  // Generated files
  TLDS_JSON: "tlds.json",
  METADATA: "metadata.json",

  // Supplemental data
  SUPPLEMENTAL: "supplemental.json",
} as const;
