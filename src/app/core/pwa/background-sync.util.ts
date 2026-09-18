/**
 * Best-effort Background Sync API registration (FWEB-7, requirement-spec.md §2 Installability
 * row: "Background Sync API" for attendance). Support is inconsistent across browsers (notably
 * absent in Safari/iOS WebView as of this writing) -- every caller MUST also flush the pending
 * queue on a plain `online` event / on next app open regardless of whether registration below
 * succeeds, so a missing Background Sync API degrades to "sync resumes next time the app is open
 * and online" rather than a hard failure. This function itself never throws.
 */
export async function registerAttendanceSync(tag = 'fweb-attendance-sync'): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncCapableRegistration = registration as ServiceWorkerRegistration & {
      sync?: { register(tag: string): Promise<void> };
    };
    if (!syncCapableRegistration.sync) {
      return false;
    }
    await syncCapableRegistration.sync.register(tag);
    return true;
  } catch {
    return false;
  }
}
