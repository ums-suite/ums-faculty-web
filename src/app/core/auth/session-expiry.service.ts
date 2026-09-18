import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TokenStorageService } from '@ums/shared';
import { AUTH_ROUTES, RETURN_URL_QUERY_PARAM } from './auth-routes.constants';

/**
 * Redirects to login the instant `@ums/shared`'s `TokenStorageService.sessionExpired$` fires --
 * i.e. a genuine refresh failure (expired/reused/revoked refresh token), never a deliberate
 * logout the app already knows about (FWEB-4).
 *
 * Provided at root and injected once from `App` (purely so its constructor runs at bootstrap) so
 * the subscription is live for the whole app session, not re-created per route.
 */
@Injectable({ providedIn: 'root' })
export class SessionExpiryService {
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  constructor() {
    this.tokenStorage.sessionExpired$.subscribe(() => {
      void this.router.navigate([AUTH_ROUTES.login], {
        queryParams: { [RETURN_URL_QUERY_PARAM]: this.router.url },
      });
    });
  }
}
