import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { TokenStorageService } from '@ums/shared';
import { AUTH_ROUTES, RETURN_URL_QUERY_PARAM } from './auth-routes.constants';

/**
 * Route-level "must be logged in" gate (FWEB-4). A generic authenticated-vs-anonymous check --
 * every screen in this app requires a `Session` per requirement-spec.md §2/§10.1, since there is
 * no anonymous, SEO-relevant surface here.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  if (tokenStorage.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([AUTH_ROUTES.login], {
    queryParams: { [RETURN_URL_QUERY_PARAM]: state.url },
  });
};

/**
 * The inverse of {@link authGuard} for the anonymous-only login screen -- an already logged-in
 * faculty member navigating back to `/login` is sent to {@link AUTH_ROUTES.authenticatedHome}
 * instead of being shown the login form again.
 */
export const guestGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  if (!tokenStorage.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([AUTH_ROUTES.authenticatedHome]);
};
