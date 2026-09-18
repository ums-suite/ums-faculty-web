import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * App-wide runtime configuration (FWEB-5). One injection token rather than importing
 * `environment` directly from every consumer, so a future per-deployment override (e.g. an
 * index.html-injected `window.__APP_CONFIG__`) has one seam to change.
 */
export interface AppConfig {
  /**
   * The origin `ums-core`'s Host is served from. Passed to `@ums/shared`'s `provideApi()` and to
   * `UMS_AUTH_CONFIG.baseUrl` (consumed by `AuthRefreshCoordinator`/`authInterceptor`) so both
   * always agree on the same base URL -- see `core/http/provide-core-http.ts`.
   */
  readonly apiBaseUrl: string;
  /** Short-poll interval (ms) for the notification-badge unread-count poll, FWEB-8. */
  readonly notificationPollIntervalMs: number;
  /**
   * Idle/session timeout (ms) applied on a device the faculty member has identified as their OWN
   * personal device (FWEB-4, requirement-spec.md §5's shared-lab-kiosk scenario). Longer than
   * {@link sharedDeviceSessionTimeoutMs} since a personal device carries materially lower
   * walk-away-and-someone-else-uses-it risk.
   */
  readonly personalDeviceSessionTimeoutMs: number;
  /**
   * Idle/session timeout (ms) applied by default and on any device NOT explicitly identified as
   * personal (shared departmental kiosk, lab machine, borrowed device) -- deliberately short per
   * §5: "session timeout on shared devices is shorter than the personal-device default."
   */
  readonly sharedDeviceSessionTimeoutMs: number;
  /**
   * Low-attendance flag threshold (percent, 0-100) used by FWEB-15 pending a real
   * university-configured value. **Confirmed backend gap**: no Organization/Academic endpoint
   * exposing a configurable low-attendance threshold was found in `ums-core` as of this pass
   * (verified against `UMS.Modules.Organization`/`UMS.Modules.Academic` source) -- this constant is
   * a placeholder default, flagged for cross-team follow-up once such a config surface exists.
   */
  readonly defaultLowAttendanceThresholdPercent: number;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  apiBaseUrl: environment.apiBaseUrl,
  notificationPollIntervalMs: 15_000,
  personalDeviceSessionTimeoutMs: 60 * 60_000,
  sharedDeviceSessionTimeoutMs: 10 * 60_000,
  defaultLowAttendanceThresholdPercent: 75,
};

/**
 * Root-provided with a real default (`environment.apiBaseUrl`) so any `providedIn: 'root'`
 * service that transitively depends on it resolves cleanly in a unit test that never calls
 * `provideCoreHttp()` -- `provide-core-http.ts`'s explicit provider still overrides this at real
 * app bootstrap.
 */
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_APP_CONFIG,
});
