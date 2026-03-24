// ---------------------------------------------------------------------------
// Hypercerts Read API: simulated placeholder (MVP)
// Prevents build errors from UI imports.
// ---------------------------------------------------------------------------

/**
 * Returns null metadata because Hypercerts are disabled for MVP.
 */
export async function fetchHypercertMetadata() {
  console.warn("fetchHypercertMetadata() placeholder called; Hypercerts disabled.");
  return null;
}

/**
 * Simulate read-only eligibility checks if UI calls for them.
 */
export async function getUserHypercerts(_user?: string) {
  return [];
}
