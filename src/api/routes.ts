/**
 * API Routes - HTTP handlers for JSON endpoints
 *
 * Currently exposes a single endpoint for full analysis.
 * Additional endpoints can be added as needed.
 */

import { getFullAnalysis } from "./data.ts";

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
    // Single API endpoint for full analysis
    if (path === "/api/analysis") {
      return new Response(
        JSON.stringify(await getFullAnalysis()),
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
