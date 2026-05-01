/**
 * Minimal TypeScript Registry client.
 *
 * Mirrors the Python platform_sdk.registry.client.RegistryClient surface
 * we need from the frontend: just `lookup(name)`. The server handles
 * heartbeats, eviction, and reaper concerns.
 *
 * Caches lookups for 30 seconds to avoid hitting the registry on every
 * request. On registry-unreachable, throws RegistryUnreachable rather
 * than falling back to a hardcoded URL — the whole point of the move
 * is to fail loudly when the contract is broken.
 */
import { getConfig } from "./config";

export class RegistryUnreachable extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RegistryUnreachable";
  }
}

export class ServiceNotFound extends Error {
  constructor(public readonly serviceName: string) {
    super(`Service '${serviceName}' not found in registry`);
    this.name = "ServiceNotFound";
  }
}

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const _cache = new Map<string, CacheEntry>();

/**
 * Look up a service URL by name. Returns the entry's `url` field.
 * Caches for 30s. Throws RegistryUnreachable on network failure or
 * non-200 response, ServiceNotFound on 404.
 */
export async function lookupService(name: string): Promise<string> {
  const now = Date.now();
  const cached = _cache.get(name);
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  const config = getConfig();
  const url = `${config.registryUrl}/api/services/${encodeURIComponent(name)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Environment": config.environment,
        Authorization: `Bearer ${config.internalApiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5_000),
    });
  } catch (cause) {
    throw new RegistryUnreachable(
      `Cannot reach registry at ${config.registryUrl}`,
      cause
    );
  }

  if (response.status === 404) {
    throw new ServiceNotFound(name);
  }
  if (!response.ok) {
    throw new RegistryUnreachable(
      `Registry returned ${response.status} for ${name}`
    );
  }

  const body = (await response.json()) as { url?: string };
  if (!body.url) {
    throw new RegistryUnreachable(
      `Registry response for '${name}' has no 'url' field: ${JSON.stringify(body)}`
    );
  }

  _cache.set(name, { url: body.url, expiresAt: now + CACHE_TTL_MS });
  return body.url;
}

/** For tests — clear the cache so successive lookups refetch. */
export function _resetRegistryCacheForTests(): void {
  _cache.clear();
}
