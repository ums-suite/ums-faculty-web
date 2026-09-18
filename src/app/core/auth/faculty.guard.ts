import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { CurrentUserService } from '@ums/shared';
import { AUTH_ROUTES } from './auth-routes.constants';

/**
 * Renders only the `FacultyMember`/Department-Head-in-teaching-capacity permission surface
 * (requirement-spec.md §5: "This app renders only the FacultyMember/Department-Head-in-teaching-
 * capacity permission surface... enforced server-side (ADR-0006), never by this app simply
 * choosing not to render a control").
 *
 * **Known gap, matching `@ums/shared`'s own documented one** ("Known gap: permission resolution"
 * in its README): Identity's access token carries Role *names* only, not a resolved
 * `faculty.*`/`academic.*` Permission set, and there is no "my effective permissions" endpoint yet
 * for a client to call. This guard therefore can only check **role membership**
 * (`CurrentUserService.hasAnyRole`), not the actual permission strings the backend itself enforces
 * on every faculty-owned endpoint (which remains the real security boundary regardless of what
 * this guard does -- UX convenience, never the trust boundary, exactly like every other
 * client-side check in this app). `FACULTY_ROLE_NAMES` is this app's best-current assumption for
 * the seeded/assigned Role names Identity uses for teaching staff; no such names are hardcoded
 * anywhere in `ums-core` (roles are created/assigned dynamically through Identity's own role
 * management), so this must be confirmed with the Identity/Faculty team rather than trusted as
 * authoritative. Flagged in this app's PR as a cross-team follow-up, matching `ums-student-web`'s
 * identical `studentGuard` caveat.
 */
export const FACULTY_ROLE_NAMES = ['FacultyMember', 'DepartmentHead'] as const;

export const facultyGuard: CanActivateFn = () => {
  const currentUser = inject(CurrentUserService);
  const router = inject(Router);

  if (currentUser.hasAnyRole(FACULTY_ROLE_NAMES)) {
    return true;
  }

  return router.createUrlTree([AUTH_ROUTES.login]);
};
