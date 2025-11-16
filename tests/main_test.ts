import { assertEquals } from "@std/assert";
import { compare_tld_lists_ignore_timestamp } from "../src/main.ts";
import { compare_json_ignore_fields } from "../src/utilities.ts";

/**
 * Tests for main.ts functions
 */

Deno.test("compare_tld_lists_ignore_timestamp - returns true when only timestamp differs", async () => {
  const content1 = await Deno.readTextFile("tests/fixtures/tlds-v1.txt");
  const content2 = await Deno.readTextFile("tests/fixtures/tlds-v2-timestamp-only.txt");

  assertEquals(compare_tld_lists_ignore_timestamp(content1, content2), true);
});

Deno.test("compare_tld_lists_ignore_timestamp - returns false when TLD list changes", async () => {
  const content1 = await Deno.readTextFile("tests/fixtures/tlds-v1.txt");
  const content2 = await Deno.readTextFile("tests/fixtures/tlds-v3-new-tld.txt");

  assertEquals(compare_tld_lists_ignore_timestamp(content1, content2), false);
});

Deno.test("compare_tld_lists_ignore_timestamp - returns true for identical files", async () => {
  const content = await Deno.readTextFile("tests/fixtures/tlds-v1.txt");

  assertEquals(compare_tld_lists_ignore_timestamp(content, content), true);
});

Deno.test("compare_json_ignore_fields - returns true when only timestamp differs", async () => {
  const content1 = await Deno.readTextFile("tests/fixtures/tlds-v1.json");
  const content2 = await Deno.readTextFile("tests/fixtures/tlds-v2-timestamp-only.json");

  const data1 = JSON.parse(content1);
  const data2 = JSON.parse(content2);

  assertEquals(compare_json_ignore_fields(data1, data2, ["generated"]), true);
});

Deno.test("compare_json_ignore_fields - returns false when TLD content changes", async () => {
  const content1 = await Deno.readTextFile("tests/fixtures/tlds-v1.json");
  const content2 = await Deno.readTextFile("tests/fixtures/tlds-v3-new-tld.json");

  const data1 = JSON.parse(content1);
  const data2 = JSON.parse(content2);

  assertEquals(compare_json_ignore_fields(data1, data2, ["generated"]), false);
});

Deno.test("compare_json_ignore_fields - returns true for identical JSON files", async () => {
  const content = await Deno.readTextFile("tests/fixtures/tlds-v1.json");
  const data = JSON.parse(content);

  assertEquals(compare_json_ignore_fields(data, data, ["generated"]), true);
});
