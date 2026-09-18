import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CurrentUserService } from '@ums/shared';
import { map, Observable, of, tap } from 'rxjs';
import { FacultyApi } from '../api/faculty.api';

const STORAGE_KEY = 'fweb.faculty-identity.faculty-member-id';

/**
 * Resolves "which `FacultyMember` am I" for the currently logged-in user (FWEB-5/FWEB-6).
 *
 * **Confirmed backend gap** (`FacultyApi.getFacultyMember`'s own doc comment): `ums-core` has no
 * self-lookup endpoint that maps the caller's own `userId` (from their JWT) to their
 * `FacultyMemberId` -- every Faculty/Academic endpoint that scopes to "my own" data (course
 * assignments, attendance-marking eligibility, leave, research profile) instead requires the
 * FacultyMemberId to already be known. This service is the one seam that gap lives behind:
 *
 * - {@link facultyMemberId} is persisted to `localStorage` once resolved (same try/catch
 *   best-effort pattern as `@ums/shared`'s `TokenStorageService`) so it survives a page reload
 *   without re-resolving.
 * - {@link resolveFromDirectory} is the one *available* (if awkward) resolution path today: page
 *   through `FacultyApi.listFacultyMembers` (department-scoped, per `FacultyMemberEndpoints.cs`)
 *   and match on `userId`. It requires already knowing a plausible department id and
 *   `faculty.profile.read` permission at that scope, and is O(department size) -- a real but
 *   awkward workaround, not a substitute for a real self-lookup endpoint. Flagged for cross-team
 *   follow-up (a `GET /api/v1/faculty/members/me` endpoint would remove the need for this
 *   entirely).
 * - Cleared on logout, exactly like {@link DeviceTrustService} -- this identity must never leak
 *   into the next faculty member's session on a shared device.
 */
@Injectable({ providedIn: 'root' })
export class FacultyIdentityService {
  private readonly document = inject(DOCUMENT);
  private readonly currentUser = inject(CurrentUserService);
  private readonly facultyApi = inject(FacultyApi);

  private readonly facultyMemberIdState = signal<string | null>(this.readPersisted());
  readonly facultyMemberId = this.facultyMemberIdState.asReadonly();

  readonly userId = this.currentUser.userId;
  readonly isResolved = computed(() => this.facultyMemberIdState() !== null);

  /** Records a known FacultyMemberId, e.g. resolved out-of-band or via {@link resolveFromDirectory}. */
  setFacultyMemberId(id: string): void {
    this.facultyMemberIdState.set(id);
    this.writePersisted(id);
  }

  clear(): void {
    this.facultyMemberIdState.set(null);
    try {
      this.document.defaultView?.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable -- nothing to clean up.
    }
  }

  /** See class doc -- the awkward, department-scoped directory-match workaround for the confirmed self-lookup gap. */
  resolveFromDirectory(departmentId?: string): Observable<string | null> {
    const myUserId = this.currentUser.userId();
    if (!myUserId) {
      return of(null);
    }
    return this.facultyApi.listFacultyMembers(departmentId).pipe(
      map((page) => page.items.find((m) => m.userId === myUserId)?.id ?? null),
      tap((id) => {
        if (id) {
          this.setFacultyMemberId(id);
        }
      }),
    );
  }

  private readPersisted(): string | null {
    try {
      return this.document.defaultView?.localStorage.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private writePersisted(id: string): void {
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage unavailable -- the in-memory signal still reflects it for this tab's life.
    }
  }
}
