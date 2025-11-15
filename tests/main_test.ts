import { assertEquals } from "@std/assert";
import { compare_tld_lists_ignore_timestamp } from "../src/main.ts";

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
