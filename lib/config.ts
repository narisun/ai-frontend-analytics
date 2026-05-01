/**
 * Centralised runtime configuration for the frontend.
 *
 * The single place in this codebase that reads process.env.* (other
 * than NEXT_PUBLIC_* baked into the bundle at build time, and the
 * Auth0 SDK's lazy reads inside lib/auth0.ts which we leave alone).
 *
 * Mirrors the Python SDK's MCPConfig.load() discipline: validate
 * required fields up-front, fail-fast at first access if anything's
 * missing, expose a typed Config to the rest of the app.
 *
 * For Next.js on Vercel we don't ship a YAML loader — the platform's
 * convention is env-only and there's no infrastructure for ${VAR}
 * substitution at runtime. The Python loader's strictness lives here
 * as runtime validation instead.
 */

export type Environment = "dev" | "staging" | "prod";

export interface Config {
  /** Strict env selector. Stamped on every backend call as X-Environment. */
  environment: Environment;
  /** Service registry URL. Used to discover the analytics-agent. */
  registryUrl: string;
  /** Internal Bearer token. Forwarded on every backend call. */
  internalApiKey: string;
}

let _cached: Config | null = null;

function readRequired(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Configuration error: ${name} is not set. ` +
      `Required by lib/config.ts at runtime.`
    );
  }
  return v;
}

function readEnvironment(): Environment {
  const raw = process.env.ENVIRONMENT || "dev";
  if (raw !== "dev" && raw !== "staging" && raw !== "prod") {
    throw new Error(
      `Configuration error: ENVIRONMENT='${raw}' is not one of ` +
      `'dev' | 'staging' | 'prod'.`
    );
  }
  return raw;
}

/**
 * Get the validated frontend config. Cached for the lifetime of the
 * Node.js worker — env vars never change after startup.
 *
 * Throws on first access if required vars are missing or invalid.
 */
export function getConfig(): Config {
  if (_cached) return _cached;
  _cached = {
    environment: readEnvironment(),
    registryUrl: readRequired("REGISTRY_URL"),
    internalApiKey: readRequired("INTERNAL_API_KEY"),
  };
  return _cached;
}

/**
 * For tests only — clears the cached Config so re-reads pick up new
 * process.env values.
 */
export function _resetConfigForTests(): void {
  _cached = null;
}
