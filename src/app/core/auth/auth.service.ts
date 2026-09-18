import { Injectable, inject } from '@angular/core';
import { IdentityApiService, TokenStorageService, type UmsTokenPair } from '@ums/shared';
import { Observable, tap } from 'rxjs';
import { DeviceTrustService } from './device-trust.service';
import { FacultyIdentityService } from './faculty-identity.service';

/**
 * This app's own login/logout facade over `@ums/shared`'s session primitives (FWEB-4,
 * requirement-spec.md §2 Auth row, §5, ADR-0005). `@ums/shared` deliberately does not ship this
 * facade itself, to stay out of domain/flow logic per ADR-0017.
 *
 * Session mechanics (established by `@ums/shared`, not re-derived here): a signed access/refresh
 * token pair, held in `TokenStorageService`'s signal; `authInterceptor` attaches the bearer token
 * and single-flights refresh-on-401; `AuthRefreshCoordinator` owns the actual rotation call. This
 * app never parses or attaches a token by hand outside that existing machinery.
 *
 * The generated `IdentityApiService`'s auth methods are untyped (`Observable<any>`); this service
 * is the one place that risk is contained, casting the response to {@link UmsTokenPair}.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly identityApi = inject(IdentityApiService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly deviceTrust = inject(DeviceTrustService);
  private readonly facultyIdentity = inject(FacultyIdentityService);

  /**
   * `POST /api/v1/identity/auth/login`. Stores the returned token pair on success.
   *
   * `isPersonalDevice` records this login's own "is this your personal device?" answer
   * (requirement-spec.md §5) via {@link DeviceTrustService} -- callers pass the login screen's own
   * toggle value; omitting it leaves any previously-recorded answer for this browser profile
   * untouched (e.g. a returning user on their own already-identified device re-authenticating
   * after a session-timeout logout need not re-answer).
   */
  login(
    identifier: string,
    password: string,
    isPersonalDevice?: boolean,
  ): Observable<UmsTokenPair> {
    if (isPersonalDevice !== undefined) {
      this.deviceTrust.setIsPersonalDevice(isPersonalDevice);
    }
    return (
      this.identityApi.apiV1IdentityAuthLoginPost({
        identifier,
        password,
      }) as Observable<UmsTokenPair>
    ).pipe(tap((pair) => this.tokenStorage.setTokens(pair)));
  }

  /**
   * `POST /api/v1/identity/auth/logout` (this session only). Clears local session state
   * regardless of whether the server call succeeds -- a logout that fails server-side must never
   * leave the faculty member looking logged-in on their own device. Also clears the device-trust
   * answer (requirement-spec.md §5's cache-hygiene posture: a shared kiosk must never silently
   * carry a "personal device" choice into the next faculty member's session) and, since offline-
   * queued attendance data cached by the service worker is sensitive student data, callers are
   * expected to also invoke `AttendanceCacheClearService.clear()` alongside this (wired at the
   * app-shell logout action, not duplicated inside this generic auth facade).
   */
  logout(): Observable<unknown> {
    return this.identityApi.apiV1IdentityAuthLogoutPost().pipe(
      tap({
        next: () => this.clearLocalSession(),
        error: () => this.clearLocalSession(),
      }),
    );
  }

  /** `POST /api/v1/identity/auth/logout-all` (every session/device) -- same local-clear guarantee as {@link logout}. */
  logoutAll(): Observable<unknown> {
    return this.identityApi.apiV1IdentityAuthLogoutAllPost().pipe(
      tap({
        next: () => this.clearLocalSession(),
        error: () => this.clearLocalSession(),
      }),
    );
  }

  private clearLocalSession(): void {
    this.tokenStorage.clear();
    this.deviceTrust.clear();
    this.facultyIdentity.clear();
  }
}
