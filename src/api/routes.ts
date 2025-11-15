/**
 * API Routes - HTTP handlers for JSON endpoints
 *
 * Endpoints:
 * - /api/analysis/files - Analysis of individual IANA source files
 * - /api/analysis/tlds - Analysis of generated tlds.json file
 */

import { getSourceFilesAnalysis, getTldsJsonAnalysis } from "./data.ts";

/**
 * Handle API requests and return JSON responses
 */
export async function handleApiRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  const headers = {
    "content-type": "application/json; charset=utf-8",
  };

  // Only allow GET requests
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers },
    );
  }

  try {
    // Analysis of individual IANA source files
    if (path === "/api/analysis/files") {
      return new Response(
        JSON.stringify(await getSourceFilesAnalysis()),
        { headers },
      );
    }

    // Analysis of generated tlds.json file
    if (path === "/api/analysis/tlds") {
      return new Response(
        JSON.stringify(await getTldsJsonAnalysis()),
        { headers },
      );
    }

    // Not found
    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`API error for ${path}:`, message);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers },
    );
  }
}
