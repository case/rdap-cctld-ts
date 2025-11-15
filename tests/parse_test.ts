import { assertEquals } from "@std/assert";
import {
  parse_bootstrap_tlds,
  parse_root_zone_db,
  parse_tlds_file,
} from "../src/parse.ts";

/**
 * Test: parse_tlds_file function
 */
Deno.test("parse_tlds_file - parses TLD file correctly", async () => {
  const content = await Deno.readTextFile("tests/fixtures/tlds.txt");
  const tlds = parse_tlds_file(content);

  // Should have parsed multiple TLDs
  assertEquals(tlds.length > 0, true);

  // Should contain expected TLDs (lowercase)
  assertEquals(tlds.includes("aaa"), true);
  assertEquals(tlds.includes("aarp"), true);
  assertEquals(tlds.includes("abb"), true);
  assertEquals(tlds.includes("ac"), true);
  assertEquals(tlds.includes("ad"), true);
});

Deno.test("parse_tlds_file - filters out comments", async () => {
  const content = await Deno.readTextFile("tests/fixtures/tlds.txt");
  const tlds = parse_tlds_file(content);

  // Comment line should not be in the results
  const hasCommentLine = tlds.some((tld) => tld.startsWith("#"));
  assertEquals(hasCommentLine, false);
});

Deno.test("parse_tlds_file - converts to lowercase", async () => {
  const content = await Deno.readTextFile("tests/fixtures/tlds.txt");
  const tlds = parse_tlds_file(content);

  // Should convert uppercase to lowercase
  assertEquals(tlds.includes("aaa"), true); // was AAA in file
  assertEquals(tlds.includes("xn--2scrj9c"), true); // was XN--2SCRJ9C in file
});

Deno.test("parse_tlds_file - handles Punycode TLDs", async () => {
  const content = await Deno.readTextFile("tests/fixtures/tlds.txt");
  const tlds = parse_tlds_file(content);

  // Should include Punycode TLDs
  assertEquals(tlds.includes("xn--2scrj9c"), true);
  assertEquals(tlds.includes("xn--kpry57d"), true); // Updated to match fixture
});

/**
 * Test: parse_bootstrap_tlds function
 */
Deno.test("parse_bootstrap_tlds - parses RDAP bootstrap file correctly", async () => {
  const content = await Deno.readTextFile("tests/fixtures/rdap.json");
  const data = JSON.parse(content);
  const tlds = parse_bootstrap_tlds(data.services);

  // Should have parsed multiple TLDs
  assertEquals(tlds.length > 0, true);

  // Should contain ccTLDs
  assertEquals(tlds.includes("kg"), true);
  assertEquals(tlds.includes("mg"), true);

  // Should contain gTLDs
  assertEquals(tlds.includes("ads"), true);
  assertEquals(tlds.includes("android"), true);
  assertEquals(tlds.includes("app"), true);
  assertEquals(tlds.includes("art"), true);
  assertEquals(tlds.includes("audio"), true);
  assertEquals(tlds.includes("auto"), true);
});

Deno.test("parse_bootstrap_tlds - converts to lowercase", async () => {
  const content = await Deno.readTextFile("tests/fixtures/rdap.json");
  const data = JSON.parse(content);
  const tlds = parse_bootstrap_tlds(data.services);

  // All TLDs should be lowercase
  const hasUppercase = tlds.some((tld) => tld !== tld.toLowerCase());
  assertEquals(hasUppercase, false);
});

Deno.test("parse_bootstrap_tlds - handles Punycode TLDs", async () => {
  const content = await Deno.readTextFile("tests/fixtures/rdap.json");
  const data = JSON.parse(content);
  const tlds = parse_bootstrap_tlds(data.services);

  // Should include Punycode TLDs from the bootstrap file
  assertEquals(tlds.includes("xn--kpry57d"), true); // Taiwan ccTLD
  assertEquals(tlds.includes("xn--flw351e"), true); // Google gTLD
  assertEquals(tlds.includes("xn--q9jyb4c"), true); // Google gTLD
  assertEquals(tlds.includes("xn--qcka1pmc"), true); // Google gTLD
});

Deno.test("parse_bootstrap_tlds - handles malformed data gracefully", () => {
  // Test with non-array service entries
  const services1 = [
    "not-an-array",
    null,
    undefined,
    { invalid: "object" },
  ];
  assertEquals(parse_bootstrap_tlds(services1), []);

  // Test with empty arrays
  const services2 = [
    [],
  ];
  assertEquals(parse_bootstrap_tlds(services2), []);

  // Test with non-array TLD lists
  const services3 = [
    ["not-an-array-of-tlds"],
    [{ invalid: "object" }],
  ];
  assertEquals(parse_bootstrap_tlds(services3), []);

  // Test with non-string TLDs
  const services4 = [
    [[123, null, undefined, { invalid: "tld" }, "valid"]],
  ];
  const result = parse_bootstrap_tlds(services4);
  assertEquals(result.length, 1);
  assertEquals(result[0], "valid");
});

/**
 * Test: parse_root_zone_db function
 */
Deno.test("parse_root_zone_db - parses Root Zone DB HTML correctly", async () => {
  const content = await Deno.readTextFile("tests/fixtures/root.html");
  const entries = parse_root_zone_db(content);

  // Should have parsed multiple entries
  assertEquals(entries.length > 0, true);

  // Check that entries have required fields
  for (const entry of entries) {
    assertEquals(typeof entry.tld, "string");
    assertEquals(typeof entry.type, "string");
    assertEquals(typeof entry.delegated, "boolean");
    // Manager is optional and only present for delegated TLDs
    if (entry.delegated) {
      assertEquals(typeof entry.manager, "string");
    } else {
      assertEquals(entry.manager, undefined);
    }
  }
});

Deno.test("parse_root_zone_db - classifies TLD types correctly", async () => {
  const content = await Deno.readTextFile("tests/fixtures/root.html");
  const entries = parse_root_zone_db(content);

  // Should have country-code TLDs
  const ccTlds = entries.filter((e) => e.type === "country-code");
  assertEquals(ccTlds.length > 0, true);

  // Should have generic TLDs
  const gTlds = entries.filter((e) => e.type === "generic");
  assertEquals(gTlds.length > 0, true);

  // Check specific TLD types from our fixture (Unicode versions)
  const bharat = entries.find((e) => e.tld === "ಭಾರತ");
  assertEquals(bharat?.type, "country-code");

  const google = entries.find((e) => e.tld === "谷歌");
  assertEquals(google?.type, "generic");
});

Deno.test("parse_root_zone_db - handles all TLD type categories", async () => {
  const content = await Deno.readTextFile("tests/fixtures/root.html");
  const entries = parse_root_zone_db(content);

  // Verify all 6 TLD types are present in fixture and correctly parsed
  assertEquals(entries.find((e) => e.tld === "ac")?.type, "country-code");
  assertEquals(entries.find((e) => e.tld === "aaa")?.type, "generic");
  assertEquals(entries.find((e) => e.tld === "aero")?.type, "sponsored");
  assertEquals(entries.find((e) => e.tld === "arpa")?.type, "infrastructure");
  assertEquals(entries.find((e) => e.tld === "测试")?.type, "test");
  assertEquals(entries.find((e) => e.tld === "biz")?.type, "generic-restricted");

  // Verify we have at least one of each type
  assertEquals(entries.some((e) => e.type === "country-code"), true);
  assertEquals(entries.some((e) => e.type === "generic"), true);
  assertEquals(entries.some((e) => e.type === "sponsored"), true);
  assertEquals(entries.some((e) => e.type === "infrastructure"), true);
  assertEquals(entries.some((e) => e.type === "test"), true);
  assertEquals(entries.some((e) => e.type === "generic-restricted"), true);
});

Deno.test("parse_root_zone_db - handles delegation status", async () => {
  const content = await Deno.readTextFile("tests/fixtures/root.html");
  const entries = parse_root_zone_db(content);

  // Should have both delegated and undelegated entries
  const delegated = entries.filter((e) => e.delegated);
  const undelegated = entries.filter((e) => !e.delegated);

  assertEquals(delegated.length > 0, true);
  assertEquals(undelegated.length > 0, true);

  // Check that total adds up
  assertEquals(entries.length, delegated.length + undelegated.length);

  // Verify specific delegation statuses from our fixture
  assertEquals(entries.find((e) => e.tld === "aaa")?.delegated, true);
  assertEquals(entries.find((e) => e.tld === "测试")?.delegated, false); // test TLD is not assigned
});

Deno.test("parse_root_zone_db - removes RTL/LTR markers and dots", async () => {
  const content = await Deno.readTextFile("tests/fixtures/root.html");
  const entries = parse_root_zone_db(content);

  // Check that Arabic TLD (Egypt) has markers removed - result is Unicode not punycode
  const egypt = entries.find((e) => e.tld === "مصر");
  assertEquals(egypt !== undefined, true);
  assertEquals(egypt?.tld, "مصر"); // Should be clean Unicode with markers removed

  // Check that Hebrew TLD (Israel) has markers removed
  const israel = entries.find((e) => e.tld === "ישראל");
  assertEquals(israel !== undefined, true);
  assertEquals(israel?.tld, "ישראל"); // Should be clean Unicode with markers removed

  // Check that Chinese TLD (Google) has dots removed
  const googleCn = entries.find((e) => e.tld === "谷歌");
  assertEquals(googleCn !== undefined, true);
  assertEquals(googleCn?.tld, "谷歌"); // Should be clean Unicode with dots removed
});

Deno.test("parse_root_zone_db - converts TLDs to lowercase", async () => {
  const content = await Deno.readTextFile("tests/fixtures/root.html");
  const entries = parse_root_zone_db(content);

  // All TLDs should be lowercase
  for (const entry of entries) {
    assertEquals(entry.tld, entry.tld.toLowerCase());
  }
});

Deno.test("parse_root_zone_db - handles Unicode IDN TLDs", async () => {
  const content = await Deno.readTextFile("tests/fixtures/root.html");
  const entries = parse_root_zone_db(content);

  // Parser returns Unicode versions, not punycode
  // Check for specific Unicode IDN entries from fixture
  assertEquals(entries.some((e) => e.tld === "ಭಾರತ"), true); // India (Bharat in Kannada)
  assertEquals(entries.some((e) => e.tld === "台灣"), true); // Taiwan
  assertEquals(entries.some((e) => e.tld === "谷歌"), true); // Google (in Chinese)
  assertEquals(entries.some((e) => e.tld === "مصر"), true); // Egypt (with RTL markers removed)
  assertEquals(entries.some((e) => e.tld === "ישראל"), true); // Israel (with RTL markers removed)
});

Deno.test("parse_root_zone_db - skips entries with unknown types", () => {
  // Create HTML with an unknown TLD type
  const htmlWithUnknownType = `
    <!DOCTYPE html>
    <html>
    <body>
      <table id="tld-table">
        <tbody>
          <tr>
            <td><span class="domain tld"><a href="/domains/root/db/test.html">.test</a></span></td>
            <td>test</td>
            <td>Internet Assigned Numbers Authority</td>
          </tr>
          <tr>
            <td><span class="domain tld"><a href="/domains/root/db/unknown.html">.unknown</a></span></td>
            <td>unknown-type</td>
            <td>Some Manager</td>
          </tr>
          <tr>
            <td><span class="domain tld"><a href="/domains/root/db/com.html">.com</a></span></td>
            <td>generic</td>
            <td>VeriSign Global Registry Services</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;

  const entries = parse_root_zone_db(htmlWithUnknownType);

  // Should have parsed 2 entries (test and com), skipped unknown
  assertEquals(entries.length, 2);
  assertEquals(entries.some((e) => e.tld === "test"), true);
  assertEquals(entries.some((e) => e.tld === "com"), true);
  assertEquals(entries.some((e) => e.tld === "unknown"), false);
});

Deno.test("parse_root_zone_db - handles malformed HTML gracefully", () => {
  // Missing tldLink
  const htmlMissingLink = `
    <!DOCTYPE html>
    <html>
    <body>
      <table id="tld-table">
        <tbody>
          <tr>
            <td>No link here</td>
            <td>generic</td>
            <td>Some Manager</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
  assertEquals(parse_root_zone_db(htmlMissingLink).length, 0);

  // Missing cells (not enough td elements)
  const htmlMissingCells = `
    <!DOCTYPE html>
    <html>
    <body>
      <table id="tld-table">
        <tbody>
          <tr>
            <td><span class="domain tld"><a href="/domains/root/db/test.html">.test</a></span></td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
  assertEquals(parse_root_zone_db(htmlMissingCells).length, 0);

  // Missing text content (empty text)
  const htmlMissingText = `
    <!DOCTYPE html>
    <html>
    <body>
      <table id="tld-table">
        <tbody>
          <tr>
            <td><span class="domain tld"><a href="/domains/root/db/test.html"></a></span></td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
  assertEquals(parse_root_zone_db(htmlMissingText).length, 0);
});
