/**
 * Streaming proxy to the analytics-agent backend.
 *
 * Auth flow:
 *   1. Auth0 middleware validated the user session (cookie)
 *   2. This route extracts user identity from the session
 *   3. Looks up `analytics-agent` URL from the platform registry
 *   4. Forwards X-User-Email, X-User-Role, X-Environment, Bearer to the agent
 */
import { auth0 } from "@/lib/auth0";
import { getConfig } from "@/lib/config";
import {
  lookupService,
  RegistryUnreachable,
  ServiceNotFound,
} from "@/lib/registry-client";

const REQUEST_TIMEOUT_MS = 120_000;

export async function POST(req: Request) {
  const config = getConfig();

  // Extract authenticated user from Auth0 session
  const session = await auth0.getSession();
  const userEmail = session?.user?.email || "anonymous";
  const userRole =
    session?.user?.["https://enterprise-ai/role"] ||
    session?.user?.role ||
    "analyst";

  // Discover the agent URL via registry (registry-driven topology).
  let agentUrl: string;
  try {
    agentUrl = await lookupService("analytics-agent");
  } catch (err) {
    if (err instanceof ServiceNotFound) {
      return new Response(
        JSON.stringify({
          error: "Service unavailable",
          detail: "analytics-agent is not registered with the platform registry.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    if (err instanceof RegistryUnreachable) {
      return new Response(
        JSON.stringify({
          error: "Service registry unreachable",
          detail: (err as Error).message,
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    throw err;
  }

  const body = await req.json();

  const agentResponse = await fetch(`${agentUrl.replace(/\/$/, "")}/api/v1/analytics/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.internalApiKey}`,
      "X-Environment": config.environment,
      "X-User-Email": userEmail,
      "X-User-Role": userRole,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!agentResponse.ok) {
    const errorBody = await agentResponse.text().catch(() => "");
    return new Response(
      JSON.stringify({
        error: `Agent returned ${agentResponse.status}`,
        detail: errorBody,
      }),
      { status: agentResponse.status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(agentResponse.body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Vercel-AI-Data-Stream": "v1",
    },
  });
}
