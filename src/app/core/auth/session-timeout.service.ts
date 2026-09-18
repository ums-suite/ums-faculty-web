import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { TokenStorageService } from '@ums/shared';
import { APP_CONFIG } from '../config/app-config';
import { DeviceTrustService } from './device-trust.service';
import { AuthService } from './auth.service';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

/**
 * Idle-session timeout, shorter on a shared/unidentified device than on a faculty member's own
 * personal device (FWEB-4, requirement-spec.md §5's shared-lab-kiosk scenario: "session timeout on
 * shared devices is shorter than the personal-device default... this app never offers a 'remember
 * me' persistence option on a device the user has not identified as personal").
 *
 * A simple idle timer, reset on real user interaction (pointer/keyboard/touch -- not on ambient
 * events like `scroll`, which can fire without the faculty member actually being present), keyed
 * off {@link DeviceTrustService.isPersonalDevice}: {@link AppConfig.sharedDeviceSessionTimeoutMs}
 * on an unidentified/shared device (the default, safe posture), {@link
 * AppConfig.personalDeviceSessionTimeoutMs} once the faculty member has explicitly said this is
 * their own device. On timeout, forces a logout -- deliberately the same `AuthService.logout()`
 * path a manual logout uses, so cache-clearing/device-trust-clearing behavior is identical.
 *
 * Provided at root and injected once from `App` (purely so its constructor runs at bootstrap) so
 * the idle timer is live for the whole authenticated session, matching
 * {@link SessionExpiryService}'s own wiring pattern.
 */
@Injectable({ providedIn: 'root' })
export class SessionTimeoutService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly appConfig = inject(APP_CONFIG);
  private readonly deviceTrust = inject(DeviceTrustService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly authService = inject(AuthService);

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly boundReset = () => this.resetTimer();

  constructor() {
    const win = this.document.defaultView;
    if (!win) {
      return;
    }
    for (const eventName of ACTIVITY_EVENTS) {
      win.addEventListener(eventName, this.boundReset, { passive: true });
    }
    this.resetTimer();
  }

  private get timeoutMs(): number {
    return this.deviceTrust.isPersonalDevice()
      ? this.appConfig.personalDeviceSessionTimeoutMs
      : this.appConfig.sharedDeviceSessionTimeoutMs;
  }

  private resetTimer(): void {
    if (!this.tokenStorage.isAuthenticated()) {
      return;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => this.onIdleTimeout(), this.timeoutMs);
  }

  private onIdleTimeout(): void {
    this.authService.logout().subscribe();
  }

  ngOnDestroy(): void {
    const win = this.document.defaultView;
    for (const eventName of ACTIVITY_EVENTS) {
      win?.removeEventListener(eventName, this.boundReset);
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
  }
}
