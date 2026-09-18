/** Central route-path constants for auth-adjacent redirects (FWEB-4), mirroring sibling apps. */
export const AUTH_ROUTES = {
  login: '/login',
  authenticatedHome: '/dashboard',
} as const;

export const RETURN_URL_QUERY_PARAM = 'returnUrl';
