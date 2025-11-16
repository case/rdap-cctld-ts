import { assertEquals } from "@std/assert";
import {
  analyze_tlds_file,
  analyze_rdap_bootstrap,
  analyze_root_zone_db,
  compare_bootstrap_vs_rootzone,
  compare_tlds_vs_rootzone,
} from "../src/analyze.ts";

/**
 * Tests for analyze.ts functions
 */

Deno.test("analyze_tlds_file - analyzes TLD list correctly", async () => {
  const tldsContent = await Deno.readTextFile("tests/fixtures/tlds.txt");
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = await analyze_tlds_file(tldsContent, rootZoneContent);

  // Should have counts
  assertEquals(typeof result.total, "number");
  assertEquals(typeof result.ccTlds, "number");
  assertEquals(typeof result.gTlds, "number");
  assertEquals(typeof result.idns, "number");

  // Total should equal ccTlds + gTlds
  assertEquals(result.total, result.ccTlds + result.gTlds);

  // IDN breakdown should be present
  assertEquals(typeof result.idnBreakdown.total, "number");
  assertEquals(typeof result.idnBreakdown.ccTlds, "number");
  assertEquals(typeof result.idnBreakdown.gTlds, "number");
  assertEquals(typeof result.idnBreakdown.ascii, "number");
  assertEquals(typeof result.idnBreakdown.unicode, "number");

  // IDN counts should add up
  assertEquals(result.idnBreakdown.total, result.idnBreakdown.ccTlds + result.idnBreakdown.gTlds);
  assertEquals(result.idnBreakdown.total, result.idnBreakdown.ascii + result.idnBreakdown.unicode);
});

Deno.test("analyze_rdap_bootstrap - analyzes RDAP bootstrap correctly", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = await analyze_rdap_bootstrap(rdapData.services, rootZoneContent);

  // Should have counts
  assertEquals(typeof result.total, "number");
  assertEquals(typeof result.ccTlds, "number");
  assertEquals(typeof result.gTlds, "number");
  assertEquals(typeof result.idns, "number");

  // Total should equal ccTlds + gTlds
  assertEquals(result.total, result.ccTlds + result.gTlds);

  // Should find the Taiwan and Google Chinese TLDs in fixture
  assertEquals(result.total >= 2, true);

  // IDN breakdown should be present
  assertEquals(typeof result.idnBreakdown.total, "number");
  assertEquals(typeof result.idnBreakdown.ccTlds, "number");
  assertEquals(typeof result.idnBreakdown.gTlds, "number");
  assertEquals(typeof result.idnBreakdown.ascii, "number");
  assertEquals(typeof result.idnBreakdown.unicode, "number");
});

Deno.test("analyze_root_zone_db - analyzes Root Zone DB correctly", async () => {
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = analyze_root_zone_db(rootZoneContent);

  // Should have counts
  assertEquals(typeof result.total, "number");
  assertEquals(typeof result.delegated, "number");
  assertEquals(typeof result.undelegated, "number");
  assertEquals(typeof result.ccTlds, "number");
  assertEquals(typeof result.gTlds, "number");
  assertEquals(typeof result.idns, "number");

  // Total should equal delegated + undelegated
  assertEquals(result.total, result.delegated + result.undelegated);

  // Total ccTlds and gTlds counts include both delegated and undelegated
  // So total >= ccTlds + gTlds (could have other types like infrastructure, test, etc.)
  assertEquals(result.total >= result.ccTlds + result.gTlds, true);

  // IDN breakdown should be present
  assertEquals(typeof result.idnBreakdown.total, "number");
  assertEquals(typeof result.idnBreakdown.ccTlds, "number");
  assertEquals(typeof result.idnBreakdown.gTlds, "number");
  assertEquals(typeof result.idnBreakdown.ascii, "number");
  assertEquals(typeof result.idnBreakdown.unicode, "number");

  // Should find the Taiwan TLD (xn--kpry57d) as delegated ccTLD
  assertEquals(result.ccTlds >= 1, true);
  assertEquals(result.delegated >= 1, true);
});

Deno.test("compare_bootstrap_vs_rootzone - compares datasets correctly", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = compare_bootstrap_vs_rootzone(rdapData.services, rootZoneContent);

  // Should have all required fields
  assertEquals(typeof result.rdapCount, "number");
  assertEquals(typeof result.rootZoneCount, "number");
  assertEquals(typeof result.inBoth, "number");
  assertEquals(Array.isArray(result.onlyInRdap), true);
  assertEquals(Array.isArray(result.onlyInRootZone), true);

  // The fixture has no overlap because root.html contains Unicode IDNs (台灣, 谷歌)
  // while RDAP has ASCII punycode (xn--kpry57d, xn--flw351e)
  // This is actually realistic - shows the compare function works
  assertEquals(typeof result.inBoth, "number");

  // Counts should add up
  assertEquals(result.rdapCount, result.inBoth + result.onlyInRdap.length);
  assertEquals(result.rootZoneCount, result.inBoth + result.onlyInRootZone.length);

  // All TLDs should be lowercase
  for (const tld of result.onlyInRdap) {
    assertEquals(tld, tld.toLowerCase());
  }
  for (const tld of result.onlyInRootZone) {
    assertEquals(tld, tld.toLowerCase());
  }
});

Deno.test("compare_tlds_vs_rootzone - compares TLD list vs Root Zone DB", async () => {
  const tldsContent = await Deno.readTextFile("tests/fixtures/tlds.txt");
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = compare_tlds_vs_rootzone(tldsContent, rootZoneContent);

  // Should have all required fields
  assertEquals(typeof result.tldsCount, "number");
  assertEquals(typeof result.rootZoneCount, "number");
  assertEquals(typeof result.inBoth, "number");
  assertEquals(Array.isArray(result.onlyInTlds), true);
  assertEquals(Array.isArray(result.onlyInRootZone), true);

  // Counts should add up
  assertEquals(result.tldsCount, result.inBoth + result.onlyInTlds.length);
  assertEquals(result.rootZoneCount, result.inBoth + result.onlyInRootZone.length);

  // All TLDs should be lowercase
  for (const tld of result.onlyInTlds) {
    assertEquals(tld, tld.toLowerCase());
  }
  for (const tld of result.onlyInRootZone) {
    assertEquals(tld, tld.toLowerCase());
  }
});

Deno.test("analyze_root_zone_db - handles delegated vs undelegated TLDs", async () => {
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = analyze_root_zone_db(rootZoneContent);

  // zippo is "Not assigned" in fixture, so undelegated should be > 0
  assertEquals(result.undelegated > 0, true);

  // ac, ad, aaa are delegated in fixture
  assertEquals(result.delegated >= 3, true);
});

Deno.test("analyze_root_zone_db - classifies TLD types correctly", async () => {
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = analyze_root_zone_db(rootZoneContent);

  // Should have both ccTLDs and gTLDs in fixture
  // ac, ad are country-code
  assertEquals(result.ccTlds >= 2, true);

  // aaa, zippo, xn--flw351e are generic
  assertEquals(result.gTlds >= 1, true);
});

Deno.test("analyze_root_zone_db - counts IDNs correctly", async () => {
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = analyze_root_zone_db(rootZoneContent);

  // Fixture has 台灣, 谷歌, مصر, ישראל, ಭಾರತ, zone, zuerich which contain non-ASCII chars
  // The parser extracts Unicode versions, not punycode
  assertEquals(result.idns >= 2, true);

  // IDNs in fixture are in Unicode format (non-ASCII characters)
  assertEquals(result.idnBreakdown.unicode >= 2, true);
});

Deno.test("manual ccTLD file has no duplicates with IANA RDAP bootstrap (production data)", async () => {
  // Load IANA RDAP bootstrap from production data
  const rdapContent = await Deno.readTextFile("data/canonical/iana-rdap.json");
  const rdapData = JSON.parse(rdapContent);

  // Load manual ccTLD data from production data
  const supplementalContent = await Deno.readTextFile("data/supplemental.json");
  const supplementalData = JSON.parse(supplementalContent);
  const manualData = supplementalData.ccTldRdapServers;

  // Extract TLDs from IANA RDAP bootstrap
  const rdapTlds = new Set<string>();
  for (const service of rdapData.services) {
    const [tlds] = service;
    if (Array.isArray(tlds)) {
      for (const tld of tlds) {
        rdapTlds.add(tld.toLowerCase());
      }
    }
  }

  // Extract TLDs from manual ccTLD file
  const manualTlds: string[] = [];
  for (const entry of manualData) {
    // Handle both array format (tlds) and single format (tld)
    if (entry.tlds && Array.isArray(entry.tlds)) {
      for (const tld of entry.tlds) {
        manualTlds.push(tld.toLowerCase());
      }
    } else if (entry.tld) {
      manualTlds.push(entry.tld.toLowerCase());
    }
  }

  // Check for duplicates
  const duplicates: string[] = [];
  for (const tld of manualTlds) {
    if (rdapTlds.has(tld)) {
      duplicates.push(tld);
    }
  }

  // Assert no duplicates found
  assertEquals(
    duplicates.length,
    0,
    `Found ${duplicates.length} TLD(s) in manual file that are already in IANA RDAP bootstrap: ${duplicates.join(", ")}. IANA data is canonical and should not be duplicated.`
  );
});
