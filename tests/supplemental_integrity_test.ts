import { assertEquals } from "@std/assert";
import type { SupplementalData } from "../src/analyze.ts";

/**
 * Data Integrity Tests for supplemental.json
 *
 * These tests ensure that:
 * 1. All ccTLDs in supplemental.json exist in tlds.json
 * 2. All manager names in managerAliases exist in tlds.json
 */

Deno.test("supplemental.json - all ccTLDs exist in tlds.json", async () => {
  // Load supplemental data
  const supplementalContent = await Deno.readTextFile("data/supplemental.json");
  const supplementalData = JSON.parse(supplementalContent) as SupplementalData;

  // Load tlds.json
  const tldsJsonContent = await Deno.readTextFile("data/generated/tlds.json");
  const tldsJson = JSON.parse(tldsJsonContent);

  // Extract all TLDs from tlds.json
  const tldsInJson = new Set<string>();
  for (const service of tldsJson.services) {
    for (const tldEntry of service.tlds) {
      tldsInJson.add(tldEntry.tld);
    }
  }

  // Check each ccTLD in supplemental file
  for (const entry of supplementalData.ccTldRdapServers) {
    assertEquals(
      tldsInJson.has(entry.tld),
      true,
      `ccTLD "${entry.tld}" from supplemental.json not found in tlds.json`,
    );
  }
});

Deno.test("supplemental.json - all manager alias names exist in tlds.json", async () => {
  // Load supplemental data
  const supplementalContent = await Deno.readTextFile("data/supplemental.json");
  const supplementalData = JSON.parse(supplementalContent) as SupplementalData;

  // Load tlds.json
  const tldsJsonContent = await Deno.readTextFile("data/generated/tlds.json");
  const tldsJson = JSON.parse(tldsJsonContent);

  // Extract all unique manager names from tlds.json
  const managersInJson = new Set<string>();
  for (const service of tldsJson.services) {
    for (const tldEntry of service.tlds) {
      if (tldEntry.manager) {
        managersInJson.add(tldEntry.manager);
      }
    }
  }

  // Check each manager name in the alias arrays
  for (const [friendlyName, aliasEntries] of Object.entries(supplementalData.managerAliases)) {
    for (const aliasEntry of aliasEntries) {
      assertEquals(
        managersInJson.has(aliasEntry.name),
        true,
        `Manager "${aliasEntry.name}" (aliased as "${friendlyName}") from supplemental.json not found in tlds.json`,
      );
    }
  }
});

Deno.test("supplemental.json - has valid structure", async () => {
  const supplementalContent = await Deno.readTextFile("data/supplemental.json");
  const supplementalData = JSON.parse(supplementalContent) as SupplementalData;

  // Check that ccTldRdapServers exists and is an array
  assertEquals(Array.isArray(supplementalData.ccTldRdapServers), true);

  // Check that managerAliases exists and is an object
  assertEquals(typeof supplementalData.managerAliases, "object");
  assertEquals(Array.isArray(supplementalData.managerAliases), false);

  // Validate each ccTLD entry has required fields
  for (const entry of supplementalData.ccTldRdapServers) {
    assertEquals(typeof entry.tld, "string", "tld must be a string");
    assertEquals(typeof entry.rdapServer, "string", "rdapServer must be a string");
    assertEquals(typeof entry.backendOperator, "string", "backendOperator must be a string");
    assertEquals(typeof entry.dateUpdated, "string", "dateUpdated must be a string");
    assertEquals(entry.tld.length > 0, true, "tld must not be empty");
    assertEquals(entry.rdapServer.length > 0, true, "rdapServer must not be empty");
  }

  // Validate each manager alias entry
  for (const [friendlyName, aliasEntries] of Object.entries(supplementalData.managerAliases)) {
    assertEquals(typeof friendlyName, "string", "alias key must be a string");
    assertEquals(Array.isArray(aliasEntries), true, "alias value must be an array");
    assertEquals(aliasEntries.length > 0, true, `alias "${friendlyName}" must have at least one manager name`);

    for (const aliasEntry of aliasEntries) {
      assertEquals(typeof aliasEntry.name, "string", `manager name in "${friendlyName}" must be a string`);
      assertEquals(aliasEntry.name.length > 0, true, `manager name in "${friendlyName}" must not be empty`);

      // Source can be a string or null
      const sourceType = typeof aliasEntry.source;
      assertEquals(
        sourceType === "string" || aliasEntry.source === null,
        true,
        `source in "${friendlyName}" must be a string or null, got ${sourceType}`
      );

      // If source is a string, it must not be empty
      if (typeof aliasEntry.source === "string") {
        assertEquals(aliasEntry.source.length > 0, true, `source in "${friendlyName}" must not be empty if provided`);
      }
    }
  }
});
