import { assertEquals } from "@std/assert";
import { FILENAMES, LOCAL_PATHS } from "../src/config.ts";

/**
 * Integration Tests
 *
 * These tests ensure that:
 * 1. All required data files exist in the correct locations
 * 2. The webapp is configured to use canonical config.ts locations
 * 3. All system components (CLI, Web, ETL) have access to required files
 */

Deno.test("Integration - All canonical IANA files exist", async () => {
  // Check that all canonical IANA source files exist
  const canonicalFiles = [
    FILENAMES.RDAP_BOOTSTRAP,
    FILENAMES.TLD_LIST,
    FILENAMES.ROOT_ZONE_DB,
  ];

  for (const filename of canonicalFiles) {
    const path = `${LOCAL_PATHS.CANONICAL_DIR}/${filename}`;
    try {
      const stat = await Deno.stat(path);
      assertEquals(stat.isFile, true, `${path} should be a file`);
    } catch (error) {
      throw new Error(
        `Canonical file not found: ${path}\nRun 'deno task cli --download' to download IANA files.`,
      );
    }
  }
});

Deno.test("Integration - Supplemental data file exists", async () => {
  const path = `${LOCAL_PATHS.DATA_DIR}/${FILENAMES.SUPPLEMENTAL}`;
  try {
    const stat = await Deno.stat(path);
    assertEquals(stat.isFile, true, `${path} should be a file`);
  } catch (error) {
    throw new Error(
      `Supplemental data file not found: ${path}\nThis file should be maintained manually.`,
    );
  }
});

Deno.test("Integration - Generated files exist", async () => {
  // Check that generated files exist
  const generatedFiles = [
    FILENAMES.TLDS_JSON,
    FILENAMES.METADATA,
  ];

  for (const filename of generatedFiles) {
    const path = `${LOCAL_PATHS.GENERATED_DIR}/${filename}`;
    try {
      const stat = await Deno.stat(path);
      assertEquals(stat.isFile, true, `${path} should be a file`);
    } catch (error) {
      throw new Error(
        `Generated file not found: ${path}\nRun 'deno task cli --build' to generate files.`,
      );
    }
  }
});

Deno.test("Integration - Generated tlds.json has valid structure", async () => {
  const path = `${LOCAL_PATHS.GENERATED_DIR}/${FILENAMES.TLDS_JSON}`;
  const content = await Deno.readTextFile(path);
  const data = JSON.parse(content);

  // Validate structure
  assertEquals(typeof data.description, "string", "Should have description");
  assertEquals(typeof data.generated, "string", "Should have generated timestamp");
  assertEquals(Array.isArray(data.services), true, "Should have services array");
  assertEquals(data.services.length > 0, true, "Should have at least one service");

  // Validate first service has expected structure
  const firstService = data.services[0];
  assertEquals(Array.isArray(firstService.tlds), true, "Service should have tlds array");
  assertEquals(Array.isArray(firstService.rdapServers), true, "Service should have rdapServers array");

  // Validate first TLD has expected structure
  if (firstService.tlds.length > 0) {
    const firstTld = firstService.tlds[0];
    assertEquals(typeof firstTld.tld, "string", "TLD should have tld field");
    assertEquals(
      firstTld.type === "cctld" || firstTld.type === "gtld",
      true,
      "TLD should have type of cctld or gtld",
    );
  }
});

Deno.test("Integration - Supplemental data has valid structure", async () => {
  const path = `${LOCAL_PATHS.DATA_DIR}/${FILENAMES.SUPPLEMENTAL}`;
  const content = await Deno.readTextFile(path);
  const data = JSON.parse(content);

  // Validate structure
  assertEquals(Array.isArray(data.ccTldRdapServers), true, "Should have ccTldRdapServers array");
  assertEquals(typeof data.managerAliases, "object", "Should have managerAliases object");
  assertEquals(Array.isArray(data.managerAliases), false, "managerAliases should be object, not array");
});

Deno.test("Integration - Metadata file has valid structure", async () => {
  const path = `${LOCAL_PATHS.GENERATED_DIR}/${FILENAMES.METADATA}`;
  const content = await Deno.readTextFile(path);
  const data = JSON.parse(content);

  // Should be a record of filename -> metadata
  assertEquals(typeof data, "object", "Metadata should be an object");

  // Check if it has entries for IANA files
  for (const key in data) {
    const metadata = data[key];
    assertEquals(typeof metadata.url, "string", `${key} should have url`);
    assertEquals(typeof metadata.downloadedAt, "string", `${key} should have downloadedAt`);
  }
});

Deno.test("Integration - Web app HTML files exist", async () => {
  const webFiles = [
    "index.html",
    "tld-managers.html",
  ];

  for (const filename of webFiles) {
    const path = `src/web/${filename}`;
    try {
      const stat = await Deno.stat(path);
      assertEquals(stat.isFile, true, `${path} should be a file`);
    } catch (error) {
      throw new Error(`Web file not found: ${path}`);
    }
  }
});

Deno.test("Integration - API data layer uses config constants", async () => {
  // Read the API data file and verify it imports from config
  const apiDataContent = await Deno.readTextFile("src/api/data.ts");

  // Check that it imports from config
  assertEquals(
    apiDataContent.includes('import { FILENAMES, LOCAL_PATHS } from "../config.ts"'),
    true,
    "API data layer should import from config.ts",
  );

  // Check that it uses FILENAMES.TLDS_JSON
  assertEquals(
    apiDataContent.includes("FILENAMES.TLDS_JSON"),
    true,
    "API should use FILENAMES.TLDS_JSON constant",
  );

  // Check that it uses FILENAMES.SUPPLEMENTAL
  assertEquals(
    apiDataContent.includes("FILENAMES.SUPPLEMENTAL"),
    true,
    "API should use FILENAMES.SUPPLEMENTAL constant",
  );

  // Check that it uses LOCAL_PATHS.GENERATED_DIR
  assertEquals(
    apiDataContent.includes("LOCAL_PATHS.GENERATED_DIR"),
    true,
    "API should use LOCAL_PATHS.GENERATED_DIR constant",
  );

  // Check that it doesn't have hardcoded paths
  assertEquals(
    apiDataContent.includes('"data/tlds.json"'),
    false,
    "API should not have hardcoded 'data/tlds.json' path",
  );

  assertEquals(
    apiDataContent.includes('"data/generated"'),
    false,
    "API should not have hardcoded 'data/generated' path",
  );
});

Deno.test("Integration - Main build script uses config constants", async () => {
  const mainContent = await Deno.readTextFile("src/main.ts");

  // Check imports
  assertEquals(
    mainContent.includes('import { FILENAMES, IANA_URLS, LOCAL_PATHS } from "./config.ts"'),
    true,
    "main.ts should import from config.ts",
  );

  // Check that it uses constants
  assertEquals(
    mainContent.includes("FILENAMES.TLDS_JSON"),
    true,
    "main.ts should use FILENAMES.TLDS_JSON",
  );

  assertEquals(
    mainContent.includes("FILENAMES.SUPPLEMENTAL"),
    true,
    "main.ts should use FILENAMES.SUPPLEMENTAL",
  );

  assertEquals(
    mainContent.includes("LOCAL_PATHS.GENERATED_DIR"),
    true,
    "main.ts should use LOCAL_PATHS.GENERATED_DIR",
  );

  assertEquals(
    mainContent.includes("LOCAL_PATHS.CANONICAL_DIR"),
    true,
    "main.ts should use LOCAL_PATHS.CANONICAL_DIR",
  );
});

Deno.test("Integration - CLI uses config constants", async () => {
  const cliContent = await Deno.readTextFile("src/cli.ts");

  // Check imports
  assertEquals(
    cliContent.includes('import { FILENAMES, LOCAL_PATHS } from "./config.ts"'),
    true,
    "cli.ts should import from config.ts",
  );

  // Check that it uses constants
  assertEquals(
    cliContent.includes("FILENAMES.SUPPLEMENTAL"),
    true,
    "cli.ts should use FILENAMES.SUPPLEMENTAL",
  );

  assertEquals(
    cliContent.includes("LOCAL_PATHS.DATA_DIR"),
    true,
    "cli.ts should use LOCAL_PATHS.DATA_DIR",
  );
});

Deno.test("Integration - Config file has all required constants", async () => {
  const configContent = await Deno.readTextFile("src/config.ts");

  // Check directory paths
  const requiredPaths = [
    "DATA_DIR",
    "CANONICAL_DIR",
    "GENERATED_DIR",
  ];

  for (const path of requiredPaths) {
    assertEquals(
      configContent.includes(path),
      true,
      `config.ts should define ${path}`,
    );
  }

  // Check filenames
  const requiredFilenames = [
    "RDAP_BOOTSTRAP",
    "TLD_LIST",
    "ROOT_ZONE_DB",
    "TLDS_JSON",
    "METADATA",
    "SUPPLEMENTAL",
  ];

  for (const filename of requiredFilenames) {
    assertEquals(
      configContent.includes(filename),
      true,
      `config.ts should define ${filename}`,
    );
  }

  // Check URLs
  const requiredUrls = [
    "RDAP_BOOTSTRAP",
    "TLD_LIST",
    "ROOT_ZONE_DB",
  ];

  for (const url of requiredUrls) {
    assertEquals(
      configContent.includes(url),
      true,
      `config.ts should define URL for ${url}`,
    );
  }
});

Deno.test("Integration - No hardcoded 'data/source' references", async () => {
  // Check that old 'data/source' references have been removed
  const filesToCheck = [
    "src/main.ts",
    "src/api/data.ts",
    "src/cli.ts",
    "src/utilities.ts",
  ];

  for (const file of filesToCheck) {
    const content = await Deno.readTextFile(file);
    assertEquals(
      content.includes('"data/source"') || content.includes("'data/source'"),
      false,
      `${file} should not contain hardcoded 'data/source' path`,
    );

    assertEquals(
      content.includes("data/source"),
      false,
      `${file} should not contain 'data/source' reference`,
    );
  }
});

Deno.test("Integration - Test fixtures exist", async () => {
  // Verify test fixtures are in place
  const fixtures = [
    "tests/fixtures/rdap.json",
    "tests/fixtures/root.html",
    "tests/fixtures/tlds.txt",
    "tests/fixtures/supplemental.json",
  ];

  for (const fixture of fixtures) {
    try {
      const stat = await Deno.stat(fixture);
      assertEquals(stat.isFile, true, `${fixture} should exist`);
    } catch (error) {
      throw new Error(`Test fixture not found: ${fixture}`);
    }
  }
});

Deno.test("Integration - Directory structure is correct", async () => {
  // Verify expected directory structure
  const directories = [
    LOCAL_PATHS.DATA_DIR,
    LOCAL_PATHS.CANONICAL_DIR,
    LOCAL_PATHS.GENERATED_DIR,
    "src",
    "src/api",
    "src/web",
    "tests",
    "tests/fixtures",
  ];

  for (const dir of directories) {
    try {
      const stat = await Deno.stat(dir);
      assertEquals(stat.isDirectory, true, `${dir} should be a directory`);
    } catch (error) {
      throw new Error(`Required directory not found: ${dir}`);
    }
  }
});

Deno.test("Integration - ETL pipeline can run end-to-end", async () => {
  // This test verifies that all the pieces needed for the ETL pipeline exist
  // We don't actually run the full pipeline in tests, but we verify the structure

  // 1. Download functions exist (checking main.ts exports)
  const mainModule = await import("../src/main.ts");
  assertEquals(typeof mainModule.download_iana_rdap_bootstrap, "function", "Should export download_iana_rdap_bootstrap");
  assertEquals(typeof mainModule.download_iana_tlds, "function", "Should export download_iana_tlds");
  assertEquals(typeof mainModule.download_iana_root_zone_db, "function", "Should export download_iana_root_zone_db");

  // 2. Build function exists
  assertEquals(typeof mainModule.build_and_save_tlds_json, "function", "Should export build_and_save_tlds_json");

  // 3. Analysis functions exist (checking api exports)
  const apiModule = await import("../src/api/data.ts");
  assertEquals(typeof apiModule.getTldsJsonAnalysis, "function", "Should export getTldsJsonAnalysis");
  assertEquals(typeof apiModule.getSupplementalData, "function", "Should export getSupplementalData");
  assertEquals(typeof apiModule.getSourceFilesAnalysis, "function", "Should export getSourceFilesAnalysis");
});

Deno.test("Integration - Web server can be imported", async () => {
  // Verify that the HTTP server module can be imported
  const serverModule = await import("../src/httpServer.ts");
  assertEquals(typeof serverModule.default, "function", "Should export default handler function");
});
