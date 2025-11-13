/**
 * API Module - Main entry point
 *
 * Exports:
 * - Data access functions (for CLI)
 * - HTTP handler (for httpServer.ts)
 */

// Export all data access functions
export * from "./data.ts";

// Export HTTP handler
export { handleApiRequest } from "./routes.ts";
