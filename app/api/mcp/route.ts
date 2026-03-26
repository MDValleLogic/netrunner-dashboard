import { NextRequest, NextResponse } from "next/server";
import { validateMCPKey } from "@/lib/mcp/auth";
import { MCP_TOOLS, dispatchTool, dispatchToolExtended } from "@/lib/mcp/tools";

// ---------------------------------------------------------------------------
// MCP Protocol Constants
// ---------------------------------------------------------------------------

const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = {
  name: "vallelogic-commandrunner",
  version: "1.0.0",
};

// ---------------------------------------------------------------------------
// JSON-RPC Types
// ---------------------------------------------------------------------------

interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function rpcSuccess(id: string | number | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } },
    { status: code === -32600 ? 400 : 200 } // 400 for invalid request, else 200
  );
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // --- Auth ---
  const authHeader = req.headers.get("authorization");
  const auth = await validateMCPKey(authHeader);

  if (!auth) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: "Unauthorized: invalid or missing MCP API key." },
      },
      { status: 401 }
    );
  }

  // --- Parse body ---
  let body: JSONRPCRequest;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error: invalid JSON.");
  }

  if (body.jsonrpc !== "2.0" || !body.method) {
    return rpcError(body.id ?? null, -32600, "Invalid Request: missing jsonrpc or method.");
  }

  const { id, method, params = {} } = body;

  // --- Method dispatch ---
  try {
    switch (method) {
      // -----------------------------------------------------------------------
      // initialize — MCP handshake
      // -----------------------------------------------------------------------
      case "initialize": {
        return rpcSuccess(id, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          serverInfo: SERVER_INFO,
          capabilities: {
            tools: {},
          },
        });
      }

      // -----------------------------------------------------------------------
      // notifications/initialized — client confirms init (no response needed)
      // -----------------------------------------------------------------------
      case "notifications/initialized": {
        return new NextResponse(null, { status: 204 });
      }

      // -----------------------------------------------------------------------
      // tools/list — return all available tools
      // -----------------------------------------------------------------------
      case "tools/list": {
        return rpcSuccess(id, {
          tools: MCP_TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        });
      }

      // -----------------------------------------------------------------------
      // tools/call — execute a tool
      // -----------------------------------------------------------------------
      case "tools/call": {
        const toolName = params.name as string;
        const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;

        if (!toolName) {
          return rpcError(id, -32602, "Invalid params: missing tool name.");
        }

        const toolExists = MCP_TOOLS.some((t) => t.name === toolName);
        if (!toolExists) {
          return rpcError(id, -32602, `Unknown tool: ${toolName}`);
        }

        // Validate required args
        const toolDef = MCP_TOOLS.find((t) => t.name === toolName)!;
        const required = toolDef.inputSchema.required ?? [];
        const missingArgs = required.filter((r) => !(r in toolArgs));
        if (missingArgs.length > 0) {
          return rpcError(
            id,
            -32602,
            `Missing required arguments: ${missingArgs.join(", ")}`
          );
        }

        const result = await dispatchToolExtended(toolName, toolArgs, auth.tenantId);

        return rpcSuccess(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        });
      }

      // -----------------------------------------------------------------------
      // Unknown method
      // -----------------------------------------------------------------------
      default: {
        return rpcError(id, -32601, `Method not found: ${method}`);
      }
    }
  } catch (err) {
    console.error("[MCP] Tool execution error:", err);
    return rpcError(
      id,
      -32603,
      "Internal error: tool execution failed.",
      process.env.NODE_ENV === "development"
        ? String(err)
        : undefined
    );
  }
}

// ---------------------------------------------------------------------------
// OPTIONS — CORS preflight (for MCP clients that need it)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // Lightweight health check — no auth required
  return NextResponse.json({
    service: "ValleLogic CommandRunner MCP",
    version: SERVER_INFO.version,
    protocol: MCP_PROTOCOL_VERSION,
    status: "ok",
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
