/**
 * HTTP server to serve the web interface and API
 *
 * Routes:
 * - / - Web UI (index.html)
 * - /api/* - JSON API endpoints
 * - /static/* - Static assets (CSS, JS, images)
 *
 * When running locally: Uses Deno.serve with a port
 * When running on Val Town: Exports default function as HTTP handler
 */

import { serveDir } from "jsr:@std/http@^1.0.16/file-server";
import { handleApiRequest } from "./api/index.ts";

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // API routes
  if (url.pathname.startsWith("/api/")) {
    return await handleApiRequest(req);
  }

  // Serve index.html for root path
  if (url.pathname === "/") {
    try {
      const html = await Deno.readTextFile("src/web/index.html");
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch (error) {
      return new Response("Error loading index.html", { status: 500 });
    }
  }

  // Serve static files from src/web directory
  return serveDir(req, {
    fsRoot: "src/web",
    urlRoot: "",
  });
}

// Export for Val Town (HTTP val)
export default handleRequest;

// Run as local server if executed directly
if (import.meta.main) {
  const PORT = 8000;
  Deno.serve({ port: PORT }, handleRequest);
  console.log(`Server running at http://localhost:${PORT}/`);
}
