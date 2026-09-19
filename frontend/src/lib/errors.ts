import { AuthError } from '../api/client';

/** Turns an error thrown from api/client.ts into copy a customer can actually read. */
export function friendlyMessage(err: unknown): string {
  if (err instanceof AuthError) return 'Your session expired — please try that again.';
  if (err instanceof TypeError) return 'Could not reach the backend — is it running?';
  if (err instanceof Error) {
    // request() throws "<status> <path>: <body>" — FastAPI error bodies are {"detail": "..."}.
    const match = err.message.match(/^\d{3} \S+: (.+)$/s);
    if (match) {
      try {
        const detail = JSON.parse(match[1])?.detail;
        if (typeof detail === 'string') return detail;
      } catch {
        // body wasn't JSON — fall through to the generic message below
      }
    }
  }
  return 'Something went wrong. Please try again.';
}
