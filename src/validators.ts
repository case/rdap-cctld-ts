import { DOMParser } from "@b-fuze/deno-dom";

// Expected baseline counts (as of 2025)
const EXPECTED_TLD_COUNT = 1500; // Approximate number of TLDs
const EXPECTED_RDAP_SERVICE_COUNT = 1000; // Approximate number of RDAP services
const VARIANCE_THRESHOLD = 0.5; // 50% variance threshold

/**
 * Validates the IANA RDAP Bootstrap JSON data
 * @param data - The raw data buffer
 * @returns The parsed and validated JSON object
 */
export function validate_iana_bootstrap(data: ArrayBuffer): unknown {
  const text = new TextDecoder().decode(data);

  // Check 1: Ensure it's valid JSON
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in RDAP bootstrap file: ${message}`);
  }

  // Check 2: Ensure it's an object with expected structure (not an array)
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("RDAP bootstrap file is not a valid JSON object");
  }

  const obj = json as Record<string, unknown>;

  // Check 3: Ensure it has a 'services' array
  if (!Array.isArray(obj.services)) {
    throw new Error("RDAP bootstrap file missing 'services' array");
  }

  const serviceCount = obj.services.length;

  // Check 4: Ensure the service count is within expected range
  const minExpected = EXPECTED_RDAP_SERVICE_COUNT * (1 - VARIANCE_THRESHOLD);
  const maxExpected = EXPECTED_RDAP_SERVICE_COUNT * (1 + VARIANCE_THRESHOLD);

  if (serviceCount < minExpected || serviceCount > maxExpected) {
    console.warn(
      `Warning: RDAP service count (${serviceCount}) is outside expected range (${minExpected}-${maxExpected})`,
    );
  }

  console.log(`Validated RDAP bootstrap file: ${serviceCount} services`);
  return json;
}

/**
 * Validates the IANA TLD list text data
 * @param data - The raw data buffer
 * @returns The validated text string
 */
export function validate_iana_tlds(data: ArrayBuffer): string {
  const text = new TextDecoder().decode(data);

  // Check 1: Ensure it's not empty
  if (text.trim().length === 0) {
    throw new Error("TLD list file is empty");
  }

  // Check 2: Split into lines and count TLDs (skip comments and empty lines)
  const lines = text.split("\n");
  const tlds = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#");
  });

  const tldCount = tlds.length;

  // Check 3: Ensure the TLD count is within expected range
  const minExpected = EXPECTED_TLD_COUNT * (1 - VARIANCE_THRESHOLD);
  const maxExpected = EXPECTED_TLD_COUNT * (1 + VARIANCE_THRESHOLD);

  if (tldCount < minExpected || tldCount > maxExpected) {
    console.warn(
      `Warning: TLD count (${tldCount}) is outside expected range (${minExpected}-${maxExpected})`,
    );
  }

  // Check 4: Basic format validation - TLDs should be alphanumeric with hyphens
  const invalidTlds = tlds.filter((tld) => !/^[a-zA-Z0-9\-]+$/.test(tld));
  if (invalidTlds.length > 0) {
    throw new Error(
      `Invalid TLD format found: ${invalidTlds.slice(0, 5).join(", ")}`,
    );
  }

  console.log(`Validated TLD list: ${tldCount} TLDs`);
  return text;
}

/**
 * Validates the IANA Root Zone Database HTML data
 * @param data - The raw data buffer
 * @returns The validated HTML string
 */
export function validate_iana_root_zone_db(data: ArrayBuffer): string {
  const text = new TextDecoder().decode(data);

  // Check 1: Ensure it's not empty
  if (text.trim().length === 0) {
    throw new Error("Root Zone DB file is empty");
  }

  // Check 2: Ensure it has basic HTML structure
  if (
    !text.includes("<html") && !text.includes("<!doctype html>") &&
    !text.includes("<!DOCTYPE html>")
  ) {
    throw new Error("Root Zone DB file is not valid HTML");
  }

  // Check 3: Parse HTML using DOMParser
  const doc = new DOMParser().parseFromString(text, "text/html");

  // Check 4: Ensure it has the expected title
  const title = doc.querySelector("title");
  if (!title || !title.textContent?.includes("Root Zone Database")) {
    throw new Error("Root Zone DB file missing expected title");
  }

  // Check 5: Ensure it has the TLD table
  const table = doc.querySelector("table#tld-table");
  if (!table) {
    throw new Error("Root Zone DB file missing TLD table");
  }

  // Check 6: Count TLD entries in the table
  // Each TLD row has <span class="domain tld"><a href="/domains/root/db/
  const tldLinks = doc.querySelectorAll(
    'span.domain.tld a[href^="/domains/root/db/"]',
  );
  const tldCount = tldLinks.length;

  if (tldCount === 0) {
    throw new Error("Root Zone DB file contains no TLD entries");
  }

  // Check 7: Ensure the TLD count is within expected range
  const minExpected = EXPECTED_TLD_COUNT * (1 - VARIANCE_THRESHOLD);
  const maxExpected = EXPECTED_TLD_COUNT * (1 + VARIANCE_THRESHOLD);

  if (tldCount < minExpected || tldCount > maxExpected) {
    console.warn(
      `Warning: Root Zone DB TLD count (${tldCount}) is outside expected range (${minExpected}-${maxExpected})`,
    );
  }

  // Check 8: Ensure both "generic" and "country-code" types are present
  const typeCells = doc.querySelectorAll("td");
  let hasGeneric = false;
  let hasCountryCode = false;

  for (const cell of typeCells) {
    const cellText = cell.textContent?.trim();
    if (cellText === "generic") hasGeneric = true;
    if (cellText === "country-code") hasCountryCode = true;
  }

  if (!hasGeneric) {
    throw new Error("Root Zone DB file missing generic TLD entries");
  }

  if (!hasCountryCode) {
    throw new Error("Root Zone DB file missing country-code TLD entries");
  }

  console.log(`Validated Root Zone DB: ${tldCount} TLDs`);
  return text;
}
