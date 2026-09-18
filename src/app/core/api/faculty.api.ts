import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type { CourseAssignmentDto, FacultyMemberDto, FacultyMemberListPage } from './faculty.types';

/**
 * Interim client for `Faculty` module endpoints (FWEB-5). Each method's own doc comment names the
 * exact route verified against `ums-core`'s `UMS.Modules.Faculty.Api.Endpoints.*` source.
 */
@Injectable({ providedIn: 'root' })
export class FacultyApi extends ProvisionalModuleApiBase {
  /**
   * `GET /api/v1/faculty/members/{id}` (confirmed, `FacultyMemberEndpoints.cs`, requires
   * `faculty.profile.read`). **Confirmed backend gap: there is no "my own FacultyMember record"
   * self-lookup endpoint** -- every route that takes a FacultyMember id requires the CALLER to
   * already know it, and the only server-side "resolve FacultyMember from the calling user's own
   * identity" path (`IFacultyMemberLookup.GetByUserIdAsync`) is an internal cross-module interface,
   * never exposed over HTTP. This app therefore cannot bootstrap "which FacultyMember am I" purely
   * from a login response today; {@link GlobalStore}'s doc comment carries the interim workaround
   * (an app-config-supplied/manually-resolved id) and flags this for cross-team follow-up.
   */
  getFacultyMember(id: string): Observable<FacultyMemberDto> {
    return this.normalizeErrors(
      this.http.get<FacultyMemberDto>(this.apiUrl(`faculty/members/${id}`)),
    );
  }

  /**
   * `GET /api/v1/faculty/members?departmentId=&skip=&take=` (confirmed, `FacultyMemberEndpoints.cs`,
   * requires `faculty.profile.read`) -- department-scoped page of FacultyMember records, each
   * carrying `userId`. Exposed here as the one available building block for the
   * "resolve my own FacultyMemberId" bootstrap gap documented on {@link getFacultyMember}: a
   * caller who already knows their own department id can page through this list client-side and
   * match on `userId` against `CurrentUserService.userId()`. This is a real but awkward
   * workaround (department-scoped, paginated, O(department size)) -- not a substitute for a real
   * self-lookup endpoint, and NOT used by default anywhere in this pass pending that endpoint.
   */
  listFacultyMembers(
    departmentId?: string,
    skip = 0,
    take = 200,
  ): Observable<FacultyMemberListPage> {
    let params = new HttpParams().set('skip', skip).set('take', take);
    if (departmentId) {
      params = params.set('departmentId', departmentId);
    }
    return this.normalizeErrors(
      this.http.get<FacultyMemberListPage>(this.apiUrl('faculty/members'), { params }),
    );
  }

  /**
   * `GET /api/v1/faculty/course-assignments?facultyMemberId={id}` (confirmed,
   * `CourseAssignmentEndpoints.cs`) -- Faculty's own eventually-consistent teaching-load
   * projection (see `faculty.types.ts`'s `CourseAssignmentDto` doc).
   */
  listCourseAssignments(facultyMemberId: string): Observable<CourseAssignmentDto[]> {
    const params = new HttpParams().set('facultyMemberId', facultyMemberId);
    return this.normalizeErrors(
      this.http.get<CourseAssignmentDto[]>(this.apiUrl('faculty/course-assignments'), { params }),
    );
  }
}
