import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const STORAGE_KEY = 'fweb.device-trust.is-personal';

/**
 * FWEB-4's device-identification concept (requirement-spec.md §5's shared-lab-kiosk scenario --
 * "a first-class case, not an afterthought... build a device-identification concept, e.g. a simple
 * 'is this your personal device?' prompt/toggle at login").
 *
 * A faculty member is asked, at login, whether the device they're signing in on is their own
 * personal device. The answer is persisted to `localStorage` (best-effort, matching
 * `@ums/shared`'s `TokenStorageService`/`ThemeService` try/catch-and-fall-back-silently pattern --
 * private-browsing storage can throw or silently no-op) so it survives a page reload within the
 * same browser profile, but is deliberately NEVER sent to the server and never persisted across
 * profiles/devices -- it is a pure client-tier UX signal, not part of the session/auth trust
 * boundary itself.
 *
 * {@link isPersonalDevice} defaults to `false` (i.e. "treat as shared/unidentified") on a brand
 * new device/profile with no stored answer -- the safe default per §5 is the SHORTER timeout and
 * NO "remember me", never the more permissive personal-device behavior, until the faculty member
 * explicitly says otherwise. {@link SessionTimeoutService} and the login screen's own "remember
 * me" affordance both key off this signal.
 */
@Injectable({ providedIn: 'root' })
export class DeviceTrustService {
  private readonly document = inject(DOCUMENT);

  private readonly isPersonalState = signal(this.readPersisted());

  /** Whether this device has been identified, by the faculty member themselves, as their own personal device. */
  readonly isPersonalDevice = this.isPersonalState.asReadonly();

  /** Called from the login screen's "is this your personal device?" prompt/toggle. */
  setIsPersonalDevice(isPersonal: boolean): void {
    this.isPersonalState.set(isPersonal);
    this.writePersisted(isPersonal);
  }

  /**
   * Clears the stored device-trust answer -- called on logout so a shared kiosk never silently
   * inherits a previous faculty member's "this is my personal device" choice for whoever logs in
   * next (requirement-spec.md §5's cache/session-hygiene posture, applied to this signal too).
   */
  clear(): void {
    this.isPersonalState.set(false);
    try {
      this.document.defaultView?.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable (private browsing, disabled cookies) -- nothing to clean up.
    }
  }

  private readPersisted(): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writePersisted(isPersonal: boolean): void {
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, String(isPersonal));
    } catch {
      // Storage unavailable -- the in-memory signal still reflects the choice for this tab's life.
    }
  }
}
