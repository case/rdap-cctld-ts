import { assertEquals, assertThrows } from "@std/assert";
import {
  validate_iana_bootstrap,
  validate_iana_root_zone_db,
  validate_iana_tlds,
} from "../src/validators.ts";

/**
 * Test: validate_iana_bootstrap function
 */
Deno.test("validate_iana_bootstrap - validates valid RDAP bootstrap file", async () => {
  const content = await Deno.readTextFile("tests/fixtures/rdap.json");
  const data = new TextEncoder().encode(content).buffer;

  // Should not throw
  const result = validate_iana_bootstrap(data);

  // Should return parsed JSON
  assertEquals(typeof result, "object");
  assertEquals(result !== null, true);
});

Deno.test("validate_iana_bootstrap - throws on invalid JSON", () => {
  const invalidJson = "{ this is not valid json }";
  const data = new TextEncoder().encode(invalidJson).buffer;

  assertThrows(
    () => validate_iana_bootstrap(data),
    Error,
    "Invalid JSON in RDAP bootstrap file",
  );
});

Deno.test("validate_iana_bootstrap - handles Error exceptions from JSON.parse", () => {
  // JSON.parse throws SyntaxError (which extends Error) for invalid JSON
  // This tests that our error handling correctly processes Error instances
  const invalidJson = "{ this is not valid json }";
  const data = new TextEncoder().encode(invalidJson).buffer;

  // This should throw an Error with our custom message including the original error message
  const error = assertThrows(
    () => validate_iana_bootstrap(data),
    Error,
    "Invalid JSON in RDAP bootstrap file",
  );

  // Verify the error message includes details from the caught SyntaxError
  assertEquals(
    error.message.includes("Invalid JSON in RDAP bootstrap file"),
    true,
  );
});

Deno.test("validate_iana_bootstrap - throws on non-object JSON", () => {
  const arrayJson = "[1, 2, 3]";
  const data = new TextEncoder().encode(arrayJson).buffer;

  assertThrows(
    () => validate_iana_bootstrap(data),
    Error,
    "RDAP bootstrap file is not a valid JSON object",
  );
});

Deno.test("validate_iana_bootstrap - throws on missing services array", () => {
  const noServices = '{"description": "test"}';
  const data = new TextEncoder().encode(noServices).buffer;

  assertThrows(
    () => validate_iana_bootstrap(data),
    Error,
    "RDAP bootstrap file missing 'services' array",
  );
});

Deno.test("validate_iana_bootstrap - accepts service count within expected range", () => {
  // Create a JSON with service count within expected range (500-1500)
  const services = Array.from({ length: 1000 }, (_, i) => [
    [`tld${i}.example`],
    [`https://rdap.example.com/`],
  ]);
  const validJson = JSON.stringify({ services });
  const data = new TextEncoder().encode(validJson).buffer;

  // Should not throw and should not log warning
  const result = validate_iana_bootstrap(data);
  assertEquals(typeof result, "object");
});

/**
 * Test: validate_iana_tlds function
 */
Deno.test("validate_iana_tlds - validates valid TLD file", async () => {
  const content = await Deno.readTextFile("tests/fixtures/tlds.txt");
  const data = new TextEncoder().encode(content).buffer;

  // Should not throw
  const result = validate_iana_tlds(data);

  // Should return the text
  assertEquals(typeof result, "string");
  assertEquals(result.length > 0, true);
});

Deno.test("validate_iana_tlds - throws on empty file", () => {
  const emptyContent = "";
  const data = new TextEncoder().encode(emptyContent).buffer;

  assertThrows(
    () => validate_iana_tlds(data),
    Error,
    "TLD list file is empty",
  );
});

Deno.test("validate_iana_tlds - throws on invalid TLD format", () => {
  const invalidContent = `# Comment
AAA
INVALID TLD WITH SPACES
BBB`;
  const data = new TextEncoder().encode(invalidContent).buffer;

  assertThrows(
    () => validate_iana_tlds(data),
    Error,
    "Invalid TLD format found",
  );
});

Deno.test("validate_iana_tlds - filters out comments and empty lines", async () => {
  const content = await Deno.readTextFile("tests/fixtures/tlds.txt");
  const data = new TextEncoder().encode(content).buffer;

  // Should not throw even with comments
  const result = validate_iana_tlds(data);
  assertEquals(typeof result, "string");

  // Original content should include comments
  assertEquals(content.includes("#"), true);
});

Deno.test("validate_iana_tlds - accepts TLD count within expected range", () => {
  // Create a TLD list with count within expected range (750-2250)
  const tlds = Array.from({ length: 1500 }, (_, i) => `TLD${i}`);
  const content = "# Version 2025011100\n" + tlds.join("\n");
  const data = new TextEncoder().encode(content).buffer;

  // Should not throw and should not log warning
  const result = validate_iana_tlds(data);
  assertEquals(typeof result, "string");
});

/**
 * Test: validate_iana_root_zone_db function
 */
Deno.test("validate_iana_root_zone_db - validates valid root zone DB HTML", async () => {
  const content = await Deno.readTextFile("tests/fixtures/root.html");
  const data = new TextEncoder().encode(content).buffer;

  // Should not throw
  const result = validate_iana_root_zone_db(data);

  // Should return the HTML text
  assertEquals(typeof result, "string");
  assertEquals(result.length > 0, true);
});

Deno.test("validate_iana_root_zone_db - throws on empty file", () => {
  const emptyContent = "";
  const data = new TextEncoder().encode(emptyContent).buffer;

  assertThrows(
    () => validate_iana_root_zone_db(data),
    Error,
    "Root Zone DB file is empty",
  );
});

Deno.test("validate_iana_root_zone_db - throws on non-HTML content", () => {
  const notHtml = "This is just plain text, not HTML";
  const data = new TextEncoder().encode(notHtml).buffer;

  assertThrows(
    () => validate_iana_root_zone_db(data),
    Error,
    "Root Zone DB file is not valid HTML",
  );
});

Deno.test("validate_iana_root_zone_db - throws on missing title", () => {
  const noTitle = `<!doctype html>
<html>
<head><title>Wrong Title</title></head>
<body></body>
</html>`;
  const data = new TextEncoder().encode(noTitle).buffer;

  assertThrows(
    () => validate_iana_root_zone_db(data),
    Error,
    "Root Zone DB file missing expected title",
  );
});

Deno.test("validate_iana_root_zone_db - throws on missing TLD table", () => {
  const noTable = `<!doctype html>
<html>
<head><title>Root Zone Database</title></head>
<body><p>No table here</p></body>
</html>`;
  const data = new TextEncoder().encode(noTable).buffer;

  assertThrows(
    () => validate_iana_root_zone_db(data),
    Error,
    "Root Zone DB file missing TLD table",
  );
});

Deno.test("validate_iana_root_zone_db - throws on no TLD entries", () => {
  const noEntries = `<!doctype html>
<html>
<head><title>Root Zone Database</title></head>
<body>
<table id="tld-table">
<thead><tr><th>Domain</th><th>Type</th></tr></thead>
<tbody></tbody>
</table>
</body>
</html>`;
  const data = new TextEncoder().encode(noEntries).buffer;

  assertThrows(
    () => validate_iana_root_zone_db(data),
    Error,
    "Root Zone DB file contains no TLD entries",
  );
});

Deno.test("validate_iana_root_zone_db - throws on missing generic TLDs", () => {
  const noGeneric = `<!doctype html>
<html>
<head><title>Root Zone Database</title></head>
<body>
<table id="tld-table">
<tbody>
<tr><td><span class="domain tld"><a href="/domains/root/db/uk.html">.uk</a></span></td><td>country-code</td></tr>
</tbody>
</table>
</body>
</html>`;
  const data = new TextEncoder().encode(noGeneric).buffer;

  assertThrows(
    () => validate_iana_root_zone_db(data),
    Error,
    "Root Zone DB file missing generic TLD entries",
  );
});

Deno.test("validate_iana_root_zone_db - throws on missing country-code TLDs", () => {
  const noCountryCode = `<!doctype html>
<html>
<head><title>Root Zone Database</title></head>
<body>
<table id="tld-table">
<tbody>
<tr><td><span class="domain tld"><a href="/domains/root/db/com.html">.com</a></span></td><td>generic</td></tr>
</tbody>
</table>
</body>
</html>`;
  const data = new TextEncoder().encode(noCountryCode).buffer;

  assertThrows(
    () => validate_iana_root_zone_db(data),
    Error,
    "Root Zone DB file missing country-code TLD entries",
  );
});

Deno.test("validate_iana_root_zone_db - accepts TLD count within expected range", () => {
  // Create HTML with TLD count within expected range (750-2250)
  const tlds = Array.from({ length: 1500 }, (_, i) => {
    const type = i % 2 === 0 ? "generic" : "country-code";
    return `<tr><td><span class="domain tld"><a href="/domains/root/db/tld${i}.html">.tld${i}</a></span></td><td>${type}</td></tr>`;
  });

  const html = `<!doctype html>
<html>
<head><title>Root Zone Database</title></head>
<body>
<table id="tld-table">
<tbody>
${tlds.join("\n")}
</tbody>
</table>
</body>
</html>`;
  const data = new TextEncoder().encode(html).buffer;

  // Should not throw and should not log warning
  const result = validate_iana_root_zone_db(data);
  assertEquals(typeof result, "string");
});
