import { logVerbose } from "../globals.js";

// --- Configuration constants ---
const INITIAL_MDR_DELAY_MS = 3000; // MDR needs time to propagate after webhook
const MAX_TOTAL_RETRY_TIME_MS = 30_000; // 30 second total budget
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 5000;
const JITTER_MAX_MS = 200;
const CLEANUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 10_000; // 10 second per-request timeout

// --- Types ---
type TwilioCredentials = {
  accountSid: string;
  authToken: string;
};

type TwilioErrorResponse = {
  message?: string;
  code?: number;
  status?: number;
};

// Track which message SIDs have successfully sent typing indicators
const succeededSids = new Set<string>();
// Track pending retry operations by Promise (prevents race conditions)
const pendingPromises = new Map<string, Promise<boolean>>();
// Track cleanup timers to prevent memory leaks and allow graceful shutdown
const cleanupTimers = new Map<string, NodeJS.Timeout>();

// --- Helper functions ---

/** Safely parse a Twilio error response */
function parseTwilioError(data: unknown): TwilioErrorResponse | null {
  if (typeof data === "object" && data !== null && "message" in data) {
    return data as TwilioErrorResponse;
  }
  return null;
}

/** Check if the error indicates MDR is not ready yet (should keep retrying) */
function isMdrNotReadyError(data: unknown): boolean {
  const error = parseTwilioError(data);
  const msg = error?.message?.toLowerCase() ?? "";
  return (
    msg.includes("mdr") &&
    (msg.includes("incomplete") ||
      msg.includes("not ready") ||
      msg.includes("invalid"))
  );
}

/** Check if this is a permanent error we shouldn't retry */
function isPermanentError(status: number): boolean {
  // Auth errors or bad request (non-MDR) - don't waste time retrying
  return status === 401 || status === 403;
}

/** Custom error for fetch timeouts to distinguish from other errors */
class FetchTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchTimeoutError";
  }
}

/** Custom error for network/fetch failures that should be retried */
class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

async function doTypingRequest(
  auth: string,
  messageSid: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const body = new URLSearchParams({
    messageId: messageSid,
    channel: "whatsapp",
  });

  // Add timeout to prevent hanging forever if Twilio doesn't respond
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      "https://messaging.twilio.com/v2/Indicators/Typing.json",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        signal: controller.signal,
      },
    );
  } catch (err) {
    // Convert fetch errors to our typed errors for proper handling upstream
    if (err instanceof Error && err.name === "AbortError") {
      throw new FetchTimeoutError(
        `Typing indicator request timed out after ${FETCH_TIMEOUT_MS}ms`,
      );
    }
    // Network errors (DNS, connection refused, etc.)
    throw new NetworkError(
      `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // Validate Content-Type before parsing to avoid JSON parse errors on HTML error pages
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    throw new NetworkError(
      `Unexpected Content-Type: ${contentType} (status ${response.status})`,
    );
  }

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

/** Calculate backoff delay with exponential growth capped at MAX_RETRY_DELAY_MS */
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, MAX_RETRY_DELAY_MS);
  const jitter = Math.random() * JITTER_MAX_MS;
  return cappedDelay + jitter;
}

/** Send typing indicator without retry (for refreshes after initial success) */
async function sendTypingIndicatorRefresh(
  auth: string,
  messageSid: string,
): Promise<boolean> {
  try {
    const result = await doTypingRequest(auth, messageSid);
    logVerbose(
      `Sent typing indicator for ${messageSid}, status: ${result.status}`,
    );
    return result.ok;
  } catch {
    // Silently ignore errors on refresh calls
    return false;
  }
}

/** Send typing indicator with time-based retry loop for MDR propagation delays */
async function sendTypingIndicatorWithRetry(
  auth: string,
  messageSid: string,
): Promise<boolean> {
  logVerbose(`Typing indicator: starting MDR wait (${messageSid})`);

  // Wait for MDR to propagate before first attempt
  await new Promise((r) => setTimeout(r, INITIAL_MDR_DELAY_MS));

  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < MAX_TOTAL_RETRY_TIME_MS) {
    attempt++;
    try {
      const result = await doTypingRequest(auth, messageSid);

      if (result.ok) {
        // Clear any existing cleanup timer for this messageSid to avoid duplicates
        const existingTimer = cleanupTimers.get(messageSid);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        succeededSids.add(messageSid);
        const timer = setTimeout(() => {
          succeededSids.delete(messageSid);
          cleanupTimers.delete(messageSid);
        }, CLEANUP_TIMEOUT_MS);
        cleanupTimers.set(messageSid, timer);

        logVerbose(
          `Typing indicator sent for ${messageSid} (attempt ${attempt})`,
        );
        return true;
      }

      // Permanent auth error - stop immediately
      if (isPermanentError(result.status)) {
        logVerbose(
          `Typing indicator: permanent error ${result.status}, giving up`,
        );
        return false;
      }

      // MDR not ready or transient error - continue retrying silently
      if (isMdrNotReadyError(result.data) || result.status >= 500) {
        const delay = getBackoffDelay(attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Non-MDR 400 error (e.g., invalid message SID) - don't retry
      if (result.status === 400 && !isMdrNotReadyError(result.data)) {
        const error = parseTwilioError(result.data);
        logVerbose(
          `Typing indicator: bad request (code ${error?.code ?? "unknown"}): ${error?.message ?? "unknown error"}`,
        );
        return false;
      }

      // Unknown 4xx error - retry a few times then give up
      if (attempt >= 3) {
        logVerbose(
          `Typing indicator: unknown error after ${attempt} attempts, giving up`,
        );
        return false;
      }

      const delay = getBackoffDelay(attempt);
      await new Promise((r) => setTimeout(r, delay));
    } catch (err) {
      // Only retry on network/fetch errors, not programming bugs
      if (err instanceof NetworkError || err instanceof FetchTimeoutError) {
        logVerbose(`Typing indicator: ${err.message}, retrying...`);
        const delay = getBackoffDelay(attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      // Unexpected error (programming bug) - fail fast, don't mask it
      logVerbose(
        `Typing indicator: unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  // Exhausted 30 second budget
  logVerbose(
    `Typing indicator: gave up after ${attempt} attempts over ${Math.round((Date.now() - startTime) / 1000)}s`,
  );
  return false;
}

export function sendTypingIndicator(
  creds: TwilioCredentials,
  messageSid?: string,
): void {
  // Best-effort WhatsApp typing indicator (public beta as of Nov 2025).
  // Fire-and-forget - don't block the main reply flow.
  if (!messageSid) {
    logVerbose("Skipping typing indicator: missing MessageSid");
    return;
  }

  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString(
    "base64",
  );

  // If we've already succeeded for this message, just send without retry
  // Also check if a refresh is already pending to avoid duplicate concurrent refreshes
  if (succeededSids.has(messageSid)) {
    const refreshKey = `refresh:${messageSid}`;
    // Atomically claim the slot before starting async work
    if (pendingPromises.has(refreshKey)) {
      return;
    }
    // Set a sentinel promise immediately to prevent races, then replace with real one
    const sentinel = Promise.resolve(false);
    pendingPromises.set(refreshKey, sentinel);

    const refreshPromise = sendTypingIndicatorRefresh(auth, messageSid);
    pendingPromises.set(refreshKey, refreshPromise);
    void refreshPromise.finally(() => {
      pendingPromises.delete(refreshKey);
    });
    return;
  }

  // Atomically claim the slot before starting async work to prevent race conditions.
  // Even though JS is single-threaded, this pattern makes the intent explicit and
  // ensures correctness even if the event loop interleaves callbacks unexpectedly.
  if (pendingPromises.has(messageSid)) {
    return;
  }
  // Set a sentinel promise immediately to claim the slot
  const sentinel = Promise.resolve(false);
  pendingPromises.set(messageSid, sentinel);

  // Now start the actual work and replace the sentinel
  const promise = sendTypingIndicatorWithRetry(auth, messageSid);
  pendingPromises.set(messageSid, promise);

  // Clean up when done (success or failure)
  void promise.finally(() => {
    pendingPromises.delete(messageSid);
  });
}

/** Clean up all typing indicator state for graceful shutdown */
export function cleanupTypingIndicators(): void {
  for (const timer of cleanupTimers.values()) {
    clearTimeout(timer);
  }
  cleanupTimers.clear();
  succeededSids.clear();
  pendingPromises.clear();
}
