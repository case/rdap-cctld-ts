import { assertEquals } from "@std/assert";
import { build_tlds_json } from "../src/analyze.ts";

/**
 * Test: build_tlds_json function
 */
Deno.test("build_tlds_json - builds correct structure", async () => {
  // Load fixtures
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = await build_tlds_json(rdapData.services, rootZoneContent);

  // Should have required top-level fields
  assertEquals(typeof result.description, "string");
  assertEquals(typeof result.generated, "string");
  assertEquals(Array.isArray(result.services), true);

  // Generated should be a valid ISO date
  assertEquals(new Date(result.generated).toString() !== "Invalid Date", true);
});

Deno.test("build_tlds_json - only includes delegated TLDs", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = await build_tlds_json(rdapData.services, rootZoneContent);

  // Collect all TLDs from services
  const allTlds = result.services.flatMap(service => service.tlds.map(t => t.tld));

  // Should not include test TLD (测试) which is not delegated in fixture
  assertEquals(allTlds.includes("测试"), false);
  assertEquals(allTlds.includes("xn--0zwm56d"), false); // punycode version

  // Should include delegated TLDs that have RDAP servers and are in both fixtures
  assertEquals(allTlds.includes("xn--kpry57d"), true); // Taiwan ccTLD
  assertEquals(allTlds.includes("xn--flw351e"), true); // Google gTLD (谷歌)
});

Deno.test("build_tlds_json - correctly classifies TLD types", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  // Load manual ccTLD data
  const manualContent = await Deno.readTextFile("tests/fixtures/cctld-rdap-manual.json");
  const manualData = JSON.parse(manualContent);

  const result = await build_tlds_json(rdapData.services, rootZoneContent, manualData);

  // Find specific TLDs
  const allTldObjects = result.services.flatMap(service => service.tlds);

  // ccTLD (from manual data) - ac is in root.html and manual data
  const acTld = allTldObjects.find(t => t.tld === "ac");
  assertEquals(acTld?.type, "cctld");

  // ccTLD (from RDAP bootstrap) - Taiwan
  const taiwanTld = allTldObjects.find(t => t.tld === "xn--kpry57d");
  assertEquals(taiwanTld?.type, "cctld");

  // gTLD (from RDAP bootstrap) - Google (谷歌)
  const googleTld = allTldObjects.find(t => t.tld === "xn--flw351e");
  assertEquals(googleTld?.type, "gtld");
});

Deno.test("build_tlds_json - groups TLDs by RDAP server", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = await build_tlds_json(rdapData.services, rootZoneContent);

  // Find Google registry service (xn--flw351e is the Chinese Google TLD that's in both fixtures)
  const googleService = result.services.find(service =>
    service.tlds.some(t => t.tld === "xn--flw351e")
  );

  assertEquals(googleService !== undefined, true);

  // Should have the xn--flw351e TLD in this service group (谷歌 = Google in Chinese)
  const googleTlds = googleService!.tlds.map(t => t.tld);
  assertEquals(googleTlds.includes("xn--flw351e"), true);

  // All should have the same RDAP servers
  assertEquals(Array.isArray(googleService!.rdapServers), true);
  assertEquals(googleService!.rdapServers.length > 0, true);
  assertEquals(googleService!.rdapServers[0], "https://pubapi.registry.google/rdap/");
});

Deno.test("build_tlds_json - handles IDN TLDs correctly", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = await build_tlds_json(rdapData.services, rootZoneContent);

  const allTldObjects = result.services.flatMap(service => service.tlds);

  // ASCII punycode IDN should have both ascii and unicode
  const taiwanAscii = allTldObjects.find(t => t.tld === "xn--kpry57d");
  assertEquals(taiwanAscii !== undefined, true);
  assertEquals(taiwanAscii?.idn !== null, true);
  assertEquals(taiwanAscii?.idn?.ascii, "xn--kpry57d");
  assertEquals(taiwanAscii?.idn?.unicode, "台灣"); // Traditional Chinese in fixture

  // Unicode IDN should have both ascii and unicode (if present in fixture)
  const bharatUnicode = allTldObjects.find(t => t.tld === "ಭಾರತ");
  if (bharatUnicode) {
    assertEquals(bharatUnicode.idn !== null, true);
    assertEquals(bharatUnicode.idn?.unicode, "ಭಾರತ");
    assertEquals(bharatUnicode.idn?.ascii.startsWith("xn--"), true);
  }

  // Non-IDN TLD should have null idn
  const googleTld = allTldObjects.find(t => t.tld === "google");
  if (googleTld) {
    assertEquals(googleTld.idn, null);
  }
});

Deno.test("build_tlds_json - includes ALL delegated TLDs without RDAP servers", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = await build_tlds_json(rdapData.services, rootZoneContent);

  // Find service with empty rdapServers
  const noRdapService = result.services.find(service =>
    service.rdapServers.length === 0
  );

  // Should have TLDs without RDAP servers (both ccTLDs and gTLDs)
  if (noRdapService) {
    assertEquals(noRdapService.tlds.length > 0, true);
    assertEquals(noRdapService.rdapServers.length, 0);

    // Should include both ccTLDs and gTLDs that are delegated but lack RDAP servers
    const types = new Set(noRdapService.tlds.map(t => t.type));
    assertEquals(types.has("cctld") || types.has("gtld"), true);
  }
});

Deno.test("build_tlds_json - integrates manual ccTLD data", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  // Load manual ccTLD data from fixture
  const manualContent = await Deno.readTextFile("tests/fixtures/cctld-rdap-manual.json");
  const manualData = JSON.parse(manualContent);

  const result = await build_tlds_json(rdapData.services, rootZoneContent, manualData);

  const allTldObjects = result.services.flatMap(service => service.tlds);

  // Find 'ac' (from manual data) - should exist
  const acTld = allTldObjects.find(t => t.tld === "ac");
  assertEquals(acTld !== undefined, true);
  assertEquals(acTld?.type, "cctld");

  // Find the service containing 'ac'
  const acService = result.services.find(service =>
    service.tlds.some(t => t.tld === "ac")
  );
  assertEquals(acService?.rdapServers.includes("https://rdap.identitydigital.services/rdap/"), true);

  // Find 'de' (from manual data) - should exist
  const deTld = allTldObjects.find(t => t.tld === "de");
  assertEquals(deTld !== undefined, true);
  assertEquals(deTld?.type, "cctld");

  // Find the service containing 'de'
  const deService = result.services.find(service =>
    service.tlds.some(t => t.tld === "de")
  );
  assertEquals(deService?.rdapServers.includes("https://rdap.denic.de/"), true);
});

Deno.test("build_tlds_json - services are sorted alphabetically by first TLD", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = await build_tlds_json(rdapData.services, rootZoneContent);

  // Check that services are sorted
  for (let i = 1; i < result.services.length; i++) {
    const prevFirst = result.services[i - 1].tlds[0]?.tld || "";
    const currFirst = result.services[i].tlds[0]?.tld || "";

    // Current should be >= previous (alphabetically)
    assertEquals(currFirst.localeCompare(prevFirst) >= 0, true);
  }
});

Deno.test("build_tlds_json - TLDs within each service are sorted alphabetically", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = await build_tlds_json(rdapData.services, rootZoneContent);

  // Check each service's TLDs are sorted
  for (const service of result.services) {
    for (let i = 1; i < service.tlds.length; i++) {
      const prevTld = service.tlds[i - 1].tld;
      const currTld = service.tlds[i].tld;

      // Current should be >= previous (alphabetically)
      assertEquals(currTld.localeCompare(prevTld) >= 0, true);
    }
  }
});

Deno.test("build_tlds_json - handles empty manual data gracefully", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  // Pass empty array
  const result1 = await build_tlds_json(rdapData.services, rootZoneContent, []);
  assertEquals(result1.services.length > 0, true);

  // Pass undefined
  const result2 = await build_tlds_json(rdapData.services, rootZoneContent, undefined);
  assertEquals(result2.services.length > 0, true);
});

Deno.test("build_tlds_json - includes ALL delegated TLDs regardless of RDAP availability", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = await build_tlds_json(rdapData.services, rootZoneContent);

  const allTldObjects = result.services.flatMap(service => service.tlds);

  // Count TLDs with and without RDAP servers
  const tldsWithRdap = result.services
    .filter(s => s.rdapServers.length > 0)
    .flatMap(s => s.tlds);

  const tldsWithoutRdap = result.services
    .filter(s => s.rdapServers.length === 0)
    .flatMap(s => s.tlds);

  // Should have TLDs in both categories
  assertEquals(tldsWithRdap.length > 0, true);
  assertEquals(tldsWithoutRdap.length > 0, true);

  // Total should match all TLDs
  assertEquals(allTldObjects.length, tldsWithRdap.length + tldsWithoutRdap.length);
});

Deno.test("build_tlds_json - correctly populates tags array based on TLD category", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = await build_tlds_json(rdapData.services, rootZoneContent);

  const allTldObjects = result.services.flatMap(service => service.tlds);

  // Check that all TLDs have a tags array
  for (const tld of allTldObjects) {
    assertEquals(Array.isArray(tld.tags), true);
  }

  // Test generic TLD - should have "generic" tag
  const genericTld = allTldObjects.find(t => t.tld === "aaa");
  assertEquals(genericTld !== undefined, true);
  assertEquals(genericTld!.tags.includes("generic"), true);

  // Test sponsored TLD - should have "sponsored" tag
  const sponsoredTld = allTldObjects.find(t => t.tld === "aero");
  assertEquals(sponsoredTld !== undefined, true);
  assertEquals(sponsoredTld!.tags.includes("sponsored"), true);

  // Test infrastructure TLD - should have "infrastructure" tag
  const infraTld = allTldObjects.find(t => t.tld === "arpa");
  assertEquals(infraTld !== undefined, true);
  assertEquals(infraTld!.tags.includes("infrastructure"), true);

  // Test generic-restricted TLD - should have "generic-restricted" tag
  const restrictedTld = allTldObjects.find(t => t.tld === "biz");
  assertEquals(restrictedTld !== undefined, true);
  assertEquals(restrictedTld!.tags.includes("generic-restricted"), true);

  // Test country-code TLD - should NOT have "country-code" tag (redundant with type field)
  const ccTld = allTldObjects.find(t => t.tld === "ac");
  assertEquals(ccTld !== undefined, true);
  assertEquals(ccTld!.type, "cctld");
  assertEquals(ccTld!.tags.includes("country-code"), false);

  // ccTLDs should have empty tags array (country-code is excluded)
  assertEquals(ccTld!.tags.length, 0);
});

Deno.test("build_tlds_json - includes TLD manager information", async () => {
  const rdapContent = await Deno.readTextFile("tests/fixtures/rdap.json");
  const rdapData = JSON.parse(rdapContent);
  const rootZoneContent = await Deno.readTextFile("tests/fixtures/root.html");

  const result = await build_tlds_json(rdapData.services, rootZoneContent);

  const allTldObjects = result.services.flatMap(service => service.tlds);

  // All TLD objects should have manager field (optional)
  for (const tld of allTldObjects) {
    // Manager should either be a string or undefined
    if (tld.manager !== undefined) {
      assertEquals(typeof tld.manager, "string");
    }
  }

  // Check specific TLDs have manager info
  const aaa = allTldObjects.find(t => t.tld === "aaa");
  assertEquals(aaa !== undefined, true);
  assertEquals(typeof aaa!.manager, "string");

  const ac = allTldObjects.find(t => t.tld === "ac");
  assertEquals(ac !== undefined, true);
  assertEquals(typeof ac!.manager, "string");
});
