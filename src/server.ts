/**
 * Simple HTTP server to serve the web interface
 */

import { serveDir } from "jsr:@std/http/file-server";

const PORT = 8000;

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

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
});

console.log(`Server running at http://localhost:${PORT}/`);
