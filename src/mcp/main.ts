#!/usr/bin/env node
/**
 * svg-tool MCP server entry point.
 *
 * Starts the MCP server on stdio transport. This is the file referenced in
 * MCP configs (opencode / claude). The server exposes svg_* tools that wrap
 * the SVG tile library + AI generator.
 *
 * Usage in an MCP config:
 *   { "command": "node", "args": ["/home/niko/Projects/SVG_tool/dist/mcp/main.js"] }
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  console.error("Fatal error starting svg-tool MCP server:", err);
  process.exit(1);
});
