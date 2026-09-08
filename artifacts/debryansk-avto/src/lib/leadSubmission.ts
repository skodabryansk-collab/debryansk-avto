import { createBrowserId } from "./browserId";

function createSubmissionId(): string {
  return createBrowserId();
}

/**
 * Adds metadata once and returns the same FormData instance, so retries keep
 * the original idempotency key instead of creating another callback.
 */
export function ensureLeadSubmissionMetadata(fd: FormData): FormData {
  if (!fd.has("submissionId")) fd.append("submissionId", createSubmissionId());
  if (!fd.has("pageUrl") && typeof window !== "undefined") {
    fd.append("pageUrl", window.location.href);
  }
  return fd;
}