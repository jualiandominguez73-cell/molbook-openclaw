import { resolveFetch } from "../infra/fetch.js";

type FetchWithPreconnect = typeof fetch & {
  preconnect?: (url: string, init?: { credentials?: RequestCredentials }) => void;
};

function wrapFetchWithNetworkFallback(fetchImpl: typeof fetch): typeof fetch {
  const wrapped = (async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      return await fetchImpl(input, init);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (typeof Response === "undefined") {
        throw err;
      }
      const body = JSON.stringify({
        ok: false,
        error_code: 599,
        description: `Network error: ${message}`,
      });
      return new Response(body, {
        status: 599,
        statusText: "Network Error",
        headers: { "content-type": "application/json" },
      });
    }
  }) as FetchWithPreconnect;

  const fetchWithPreconnect = fetchImpl as FetchWithPreconnect;
  if (typeof fetchWithPreconnect.preconnect === "function") {
    wrapped.preconnect = fetchWithPreconnect.preconnect.bind(fetchWithPreconnect);
  }

  return Object.assign(wrapped, fetchImpl);
}

// Prefer wrapped fetch when available to normalize AbortSignal across runtimes.
export function resolveTelegramFetch(proxyFetch?: typeof fetch): typeof fetch | undefined {
  if (proxyFetch) return resolveFetch(proxyFetch);
  const fetchImpl = resolveFetch();
  if (!fetchImpl) {
    throw new Error("fetch is not available; set channels.telegram.proxy in config");
  }
  return wrapFetchWithNetworkFallback(fetchImpl);
}
