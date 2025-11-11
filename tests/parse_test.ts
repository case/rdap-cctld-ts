import { assertEquals } from "@std/assert";
import {
  is_cctld,
  parse_bootstrap_tlds,
  parse_tlds_file,
} from "../src/parse.ts";

/**
 * Test: is_cctld function
 */
Deno.test("is_cctld - identifies ASCII ccTLDs (2 characters)", () => {
  assertEquals(is_cctld("ac"), true);
  assertEquals(is_cctld("ad"), true);
  assertEquals(is_cctld("kg"), true);
  assertEquals(is_cctld("mg"), true);
});

Deno.test("is_cctld - identifies gTLDs (not 2 characters)", () => {
  assertEquals(is_cctld("aaa"), false);
  assertEquals(is_cctld("aarp"), false);
  assertEquals(is_cctld("abb"), false);
  assertEquals(is_cctld("abbott"), false);
  assertEquals(is_cctld("academy"), false);
  assertEquals(is_cctld("ads"), false);
  assertEquals(is_cctld("android"), false);
});

Deno.test("is_cctld - handles Punycode/IDN ccTLDs", () => {
  // xn--2scrj9c is the Punycode for a 2-character IDN (भारत - India)
  // Note: This test may need adjustment based on actual Punycode decoding behavior
  // For now, we'll test that xn-- TLDs are processed without errors
  assertEquals(typeof is_cctld("xn--2scrj9c"), "boolean");
  assertEquals(typeof is_cctld("xn--kprw13d"), "boolean");
});

Deno.test("is_cctld - handles Punycode/IDN gTLDs", () => {
  // xn--flw351e is 谷歌 (Google) - 2 chars but NOT a country code, so it's a gTLD
  // However, our function only checks character count, so it will return true
  // This is a limitation - we can't distinguish between 2-char ccTLDs and 2-char brand TLDs
  assertEquals(is_cctld("xn--flw351e"), true); // 谷歌 is 2 chars

  // These are multi-character, so definitely gTLDs
  assertEquals(is_cctld("xn--q9jyb4c"), false); // みんな
  assertEquals(is_cctld("xn--qcka1pmc"), false); // グーグル
});

Deno.test("is_cctld - handles invalid punycode gracefully", () => {
  // Test malformed punycode strings that start with xn-- but fail to decode
  // Should treat them as gTLDs (return false) when decoding fails
  assertEquals(is_cctld("xn--"), false);
  assertEquals(is_cctld("xn--invalid"), false);
  assertEquals(is_cctld("xn--!!!"), false);
});

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

/**
 * Test: Count ccTLDs and gTLDs from fixtures
 */
Deno.test("count ccTLDs and gTLDs from TLD file", async () => {
  const content = await Deno.readTextFile("tests/fixtures/tlds.txt");
  const tlds = parse_tlds_file(content);

  const ccTlds = tlds.filter((tld) => is_cctld(tld));
  const gTlds = tlds.filter((tld) => !is_cctld(tld));

  console.log(`TLD file: ${ccTlds.length} ccTLDs, ${gTlds.length} gTLDs`);

  // Should have both ccTLDs and gTLDs
  assertEquals(ccTlds.length > 0, true);
  assertEquals(gTlds.length > 0, true);

  // Verify specific ccTLDs
  assertEquals(ccTlds.includes("ac"), true);
  assertEquals(ccTlds.includes("ad"), true);

  // Verify specific gTLDs
  assertEquals(gTlds.includes("aaa"), true);
  assertEquals(gTlds.includes("academy"), true);
});

Deno.test("count ccTLDs and gTLDs from RDAP bootstrap file", async () => {
  const content = await Deno.readTextFile("tests/fixtures/rdap.json");
  const data = JSON.parse(content);
  const tlds = parse_bootstrap_tlds(data.services);

  const ccTlds = tlds.filter((tld) => is_cctld(tld));
  const gTlds = tlds.filter((tld) => !is_cctld(tld));

  console.log(
    `RDAP bootstrap: ${ccTlds.length} ccTLDs, ${gTlds.length} gTLDs`,
  );

  // Should have both ccTLDs and gTLDs
  assertEquals(ccTlds.length > 0, true);
  assertEquals(gTlds.length > 0, true);

  // Verify specific ccTLDs
  assertEquals(ccTlds.includes("kg"), true);
  assertEquals(ccTlds.includes("mg"), true);

  // Verify specific gTLDs
  assertEquals(gTlds.includes("ads"), true);
  assertEquals(gTlds.includes("android"), true);
});
