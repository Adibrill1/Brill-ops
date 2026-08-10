/**
 * Server-side connectivity diagnostics for the Supabase REST client.
 *
 * WHY THIS EXISTS — production error digest 3194394374
 * --------------------------------------------------------------------------
 * With the anon key finally set, the site stopped throwing "supabaseKey is
 * required." and started failing one layer deeper:
 *
 *   Error: Brill Ops: query failed (campaigns): TypeError: fetch failed
 *
 * "fetch failed" is Node's undici wrapper. The information that actually names
 * the problem — DNS vs TLS vs refused connection vs a bad hostname — lives in
 * the error's nested `.cause` (code / errno / syscall / hostname), which the
 * query layer was discarding. This module captures that cause at the fetch
 * boundary, logs ONLY its safe fields, and classifies the failure so a single
 * runtime-log line tells you which of the five failure modes you are in.
 *
 * SECRET SAFETY
 * --------------------------------------------------------------------------
 * Nothing here logs the anon key, Authorization/apikey headers, the database
 * URL, or any token. Only the request host, the path (query string dropped),
 * the HTTP status, and the sanitized system-error fields are emitted. Every
 * emitted string is additionally scrubbed of anything shaped like a JWT.
 */

/** Prefix every diagnostic line so it is trivially greppable in Vercel logs. */
export const DIAG_TAG = '[brill-ops:diag]';

/** The five failure modes the caller asked to be distinguished, plus fallbacks. */
export type FailureClass =
  | 'invalid-url' //          1. malformed / non-https / whitespace in the URL
  | 'dns-failure' //          2. hostname does not resolve
  | 'tls-failure' //          3. TLS handshake / certificate problem
  | 'connectivity-failure' // 3. refused / reset / timed out / unreachable
  | 'auth-response' //        4. Supabase answered 401 / 403
  | 'postgrest-error' //      5. PostgREST returned a query error
  | 'unknown-fetch-failure';

export interface SanitizedDiagnostic {
  classification: FailureClass;
  causeName?: string;
  causeMessage?: string;
  code?: string | number;
  errno?: number;
  syscall?: string;
  hostname?: string;
  host?: string;
  path?: string;
  status?: number;
}

const JWT_RE = /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g;
const CONTROL_CHAR_RE = /[\u0000-\u001F]/;

/** Remove anything shaped like a JWT from a string before it is logged. */
function scrub(value: unknown): string | undefined {
  if (value == null) return undefined;
  return String(value).replace(JWT_RE, '[redacted-token]');
}

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function safePath(url: string): string | undefined {
  try {
    return new URL(url).pathname; // deliberately drops the query string
  } catch {
    return undefined;
  }
}

/**
 * Is this raw env value a usable absolute https URL? Returns a reason when not,
 * so the "malformed URL" case (1) is reported before any request is attempted.
 * Detects the classic paste mistakes: trailing whitespace, a newline, a missing
 * scheme, http instead of https, or an embedded control character.
 */
export function describeUrlProblem(rawUrl: string | undefined): string | null {
  if (!rawUrl) return 'NEXT_PUBLIC_SUPABASE_URL is empty';
  if (rawUrl !== rawUrl.trim()) {
    return 'NEXT_PUBLIC_SUPABASE_URL has leading or trailing whitespace';
  }
  if (CONTROL_CHAR_RE.test(rawUrl)) {
    return 'NEXT_PUBLIC_SUPABASE_URL contains a control character (e.g. a newline)';
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return 'NEXT_PUBLIC_SUPABASE_URL is not a valid absolute URL';
  }
  if (parsed.protocol !== 'https:') {
    return `NEXT_PUBLIC_SUPABASE_URL must use https, not ${parsed.protocol.replace(':', '')}`;
  }
  if (!parsed.host) return 'NEXT_PUBLIC_SUPABASE_URL has no host';
  return null;
}

const DNS_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN']);
const CONNECT_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function classifyCause(code: unknown, causeName: string, message: string): FailureClass {
  const c = typeof code === 'string' ? code : '';
  if (DNS_CODES.has(c)) return 'dns-failure';
  if (CONNECT_CODES.has(c)) return 'connectivity-failure';
  if (
    c.startsWith('ERR_TLS') ||
    c.startsWith('ERR_SSL') ||
    /CERT|SSL|TLS|certificate|self[- ]signed/i.test(`${c} ${causeName} ${message}`)
  ) {
    return 'tls-failure';
  }
  if (c === 'ERR_INVALID_URL') return 'invalid-url';
  return 'unknown-fetch-failure';
}

/**
 * Extract the safe, non-secret fields from a thrown fetch error and classify it.
 * The real system error is on `err.cause` for undici "fetch failed" TypeErrors.
 */
export function sanitizeFetchError(err: unknown, requestUrl: string): SanitizedDiagnostic {
  const e = (err ?? {}) as { name?: string; message?: string; cause?: unknown };
  const cause = (e.cause ?? {}) as {
    name?: string;
    message?: string;
    code?: string | number;
    errno?: number;
    syscall?: string;
    hostname?: string;
  };

  const causeName = cause.name ?? e.name ?? 'Error';
  const causeMessage = scrub(cause.message ?? e.message) ?? '';
  const classification = classifyCause(cause.code, causeName, causeMessage);

  return {
    classification,
    causeName: scrub(causeName),
    causeMessage,
    code: cause.code,
    errno: typeof cause.errno === 'number' ? cause.errno : undefined,
    syscall: cause.syscall,
    hostname: cause.hostname ?? safeHost(requestUrl),
    host: safeHost(requestUrl),
    path: safePath(requestUrl),
  };
}

/** Emit one greppable, sanitized diagnostic line. */
export function logDiagnostic(diag: SanitizedDiagnostic): void {
  // console.error so it lands on Vercel's error stream. JSON keeps it one line.
  console.error(`${DIAG_TAG} ${JSON.stringify(diag)}`);
}

function urlOf(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof (input as Request).url === 'string') return (input as Request).url;
  return '';
}

/**
 * A transparent `fetch` wrapper for the Supabase client. It never changes the
 * result — it returns the same Response and rethrows the same error — it only
 * observes: it logs a sanitized diagnostic for a failed fetch (cases 2/3) and
 * for a 401/403 auth response (case 4). PostgREST query errors (case 5) surface
 * as a normal Response and are classified in the query layer's unwrap().
 */
export function createDiagnosticFetch(): typeof fetch {
  const wrapped: typeof fetch = async (input, init) => {
    const requestUrl = urlOf(input);
    try {
      const res = await fetch(input as Parameters<typeof fetch>[0], init);
      if (res.status === 401 || res.status === 403) {
        logDiagnostic({
          classification: 'auth-response',
          status: res.status,
          host: safeHost(requestUrl),
          path: safePath(requestUrl),
        });
      }
      return res;
    } catch (err) {
      logDiagnostic(sanitizeFetchError(err, requestUrl));
      throw err; // stay transparent: supabase-js turns this into its error object
    }
  };
  return wrapped;
}

/** Classify a PostgREST error object (case 5) for a sanitized query-layer log. */
export function classifyPostgrestError(error: {
  message?: string;
  code?: string | null;
}): SanitizedDiagnostic {
  const message = scrub(error.message) ?? '';
  // supabase-js reports a transport failure as a normal error with this message;
  // that is a fetch failure, not a query error, and is already logged upstream.
  if (/fetch failed/i.test(message)) {
    return {
      classification: 'connectivity-failure',
      causeMessage: message,
      code: error.code ?? undefined,
    };
  }
  return {
    classification: 'postgrest-error',
    causeMessage: message,
    code: error.code ?? undefined,
  };
}
