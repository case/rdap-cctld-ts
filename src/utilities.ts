import { FILENAMES, LOCAL_PATHS } from "./config.ts";

/**
 * Metadata for tracking file downloads
 */
interface DownloadMetadata {
  url: string;
  etag?: string;
  lastModified?: string;
  cacheMaxAge?: number; // Cache-Control max-age in seconds
  downloadedAt: string;
}

/**
 * Loads download metadata from the metadata file
 * @returns Record of filename to metadata, or empty object if file doesn't exist
 */
async function load_metadata(): Promise<Record<string, DownloadMetadata>> {
  const metadataPath = `${LOCAL_PATHS.DATA_DIR}/${FILENAMES.METADATA}`;

  try {
    const content = await Deno.readTextFile(metadataPath);
    return JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid, return empty metadata
    return {};
  }
}

/**
 * Saves download metadata to the metadata file
 * @param metadata - Record of filename to metadata
 */
async function save_metadata(
  metadata: Record<string, DownloadMetadata>,
): Promise<void> {
  const metadataPath = `${LOCAL_PATHS.DATA_DIR}/${FILENAMES.METADATA}`;

  try {
    await Deno.mkdir(LOCAL_PATHS.DATA_DIR, { recursive: true });
    await Deno.writeTextFile(metadataPath, JSON.stringify(metadata, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to save metadata: ${message}`);
  }
}

/**
 * Parses Cache-Control header to extract max-age in seconds
 * @param cacheControl - The Cache-Control header value
 * @returns max-age in seconds, or null if not found
 */
function parse_cache_max_age(cacheControl: string | null): number | null {
  if (!cacheControl) return null;

  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  if (maxAgeMatch) {
    return parseInt(maxAgeMatch[1], 10);
  }

  return null;
}

/**
 * Checks if a cached file is still fresh based on Cache-Control max-age
 * @param metadata - The download metadata
 * @returns true if cache is fresh, false if stale
 */
function is_cache_fresh(metadata: DownloadMetadata): boolean {
  if (!metadata.cacheMaxAge || !metadata.downloadedAt) {
    return false;
  }

  const downloadedAt = new Date(metadata.downloadedAt).getTime();
  const now = Date.now();
  const ageInSeconds = (now - downloadedAt) / 1000;

  return ageInSeconds < metadata.cacheMaxAge;
}

/**
 * Downloads a file from a URL and returns the data along with response headers
 * Uses conditional requests (If-None-Match/If-Modified-Since) when filename is provided
 * Falls back to Cache-Control max-age checks if no ETag/Last-Modified available
 * @param url - The URL to download from
 * @param filename - Optional filename for conditional request tracking
 * @returns Promise that resolves with the downloaded data and response, or null if unchanged (304 or cache fresh)
 */
export async function download(
  url: string,
  filename?: string,
): Promise<{ data: ArrayBuffer; response: Response } | null> {
  let response: Response;
  const headers: HeadersInit = {};

  // If filename provided, check for existing metadata and add conditional headers
  if (filename) {
    const allMetadata = await load_metadata();
    const fileMetadata = allMetadata[filename];

    if (fileMetadata) {
      // If we have ETag or Last-Modified, use conditional requests
      if (fileMetadata.lastModified) {
        headers["If-Modified-Since"] = fileMetadata.lastModified;
      } else if (fileMetadata.etag) {
        headers["If-None-Match"] = fileMetadata.etag;
      } else if (is_cache_fresh(fileMetadata)) {
        // Fallback: if no ETag/Last-Modified but cache is still fresh per max-age
        return null;
      }
    }
  }

  try {
    // Fetch the file from the URL with conditional headers
    response = await fetch(url, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Network error downloading from ${url}: ${message}`);
    throw new Error(`Network error downloading from ${url}: ${message}`);
  }

  // Handle 304 Not Modified - file hasn't changed
  if (response.status === 304) {
    return null;
  }

  if (!response.ok) {
    const errorMsg =
      `Failed to download file from ${url}: ${response.status} ${response.statusText}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    // Get the response as array buffer
    const data = await response.arrayBuffer();
    return { data, response };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to read response data from ${url}: ${message}`);
    throw new Error(`Failed to read response data from ${url}: ${message}`);
  }
}

/**
 * Updates the metadata file with information about a downloaded file
 * Call this only after confirming the file content actually changed and was saved
 * @param filename - The filename to update metadata for
 * @param url - The URL the file was downloaded from
 * @param response - The Response object from the download
 */
export async function update_download_metadata(
  filename: string,
  url: string,
  response: Response,
): Promise<void> {
  const allMetadata = await load_metadata();

  const etag = response.headers.get("etag");
  const lastModified = response.headers.get("last-modified");
  const cacheControl = response.headers.get("cache-control");
  const maxAge = parse_cache_max_age(cacheControl);

  allMetadata[filename] = {
    url,
    etag: etag || undefined,
    lastModified: lastModified || undefined,
    cacheMaxAge: maxAge || undefined,
    downloadedAt: new Date().toISOString(),
  };

  await save_metadata(allMetadata);
}

/**
 * Saves data to a file in the specified directory
 * @param data - The data to save (as ArrayBuffer or Uint8Array)
 * @param filename - The name to save the file as
 * @param directory - The directory to save to (defaults to data/source)
 * @returns Promise that resolves when save is complete
 */
export async function save_to_file(
  data: ArrayBuffer | Uint8Array,
  filename: string,
  directory: string = LOCAL_PATHS.SOURCE_DIR,
): Promise<void> {
  const outputPath = `${directory}/${filename}`;

  try {
    // Ensure the directory exists
    await Deno.mkdir(directory, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to create directory ${directory}: ${message}`);
    throw new Error(`Failed to create directory ${directory}: ${message}`);
  }

  try {
    // Write the file to {directory}/{filename}
    const uint8Data = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    await Deno.writeFile(outputPath, uint8Data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to write file to ${outputPath}: ${message}`);
    throw new Error(`Failed to write file to ${outputPath}: ${message}`);
  }
}

/**
 * Generic function to get data from a file.
 * Reads from local filesystem in all environments.
 *
 * @param filename - The filename to read
 * @param directory - Optional directory path (defaults to data/source)
 * @returns Promise that resolves with the file content as a string
 * @throws Error if file cannot be read
 */
export async function get_data_from_file(filename: string, directory: string = LOCAL_PATHS.SOURCE_DIR): Promise<string> {
  const filePath = `${directory}/${filename}`;
  try {
    return await Deno.readTextFile(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to read ${filename} from filesystem (${filePath}): ${message}\n` +
        `Run 'deno task cli --download' to download IANA files first.`,
    );
  }
}

