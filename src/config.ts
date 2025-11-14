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
  SOURCE_DIR: "data/source",
} as const;

/**
 * Local filenames for IANA data
 */
export const FILENAMES = {
  RDAP_BOOTSTRAP: "iana-rdap-bootstrap.json",
  TLD_LIST: "iana-tlds.txt",
  ROOT_ZONE_DB: "iana-root-zone-db.html",
  METADATA: "metadata.json",
} as const;
