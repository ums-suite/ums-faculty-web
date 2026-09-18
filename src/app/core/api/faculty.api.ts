import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type {
  AttachSupportingDocumentRequest,
  CourseAssignmentDto,
  FacultyMemberDto,
  FacultyMemberListPage,
  LeaveRequestDto,
  LeaveRequestListPage,
  RejectLeaveRequestRequest,
  ResearchProfileDto,
  SubmitLeaveRequestRequest,
  UpdateResearchProfileRequest,
  VersionedRequestBody,
} from './faculty.types';

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

  /** `GET /api/v1/faculty/leave-requests?facultyMemberId=&skip=&take=` (confirmed, `LeaveRequestEndpoints.cs`) -- FWEB-25's retained leave-history list (approved/rejected/cancelled, never pruned to only the pending one). */
  listLeaveRequests(
    facultyMemberId: string,
    skip = 0,
    take = 50,
  ): Observable<LeaveRequestListPage> {
    const params = new HttpParams()
      .set('facultyMemberId', facultyMemberId)
      .set('skip', skip)
      .set('take', take);
    return this.normalizeErrors(
      this.http.get<LeaveRequestListPage>(this.apiUrl('faculty/leave-requests'), { params }),
    );
  }

  /** `POST /api/v1/faculty/leave-requests` (confirmed, `faculty.leave.create`) -- FWEB-24's submission. Routing (invariant §8.5) is decided entirely server-side. */
  submitLeaveRequest(request: SubmitLeaveRequestRequest): Observable<LeaveRequestDto> {
    return this.normalizeErrors(
      this.http.post<LeaveRequestDto>(this.apiUrl('faculty/leave-requests'), request),
    );
  }

  /** `POST /api/v1/faculty/leave-requests/{id}/cancel` (confirmed) -- FWEB-25's "cancel a still-pending request" (Draft/Submitted/DeptHeadApproved only, enforced server-side). */
  cancelLeaveRequest(id: string, body: VersionedRequestBody): Observable<LeaveRequestDto> {
    return this.normalizeErrors(
      this.http.post<LeaveRequestDto>(this.apiUrl(`faculty/leave-requests/${id}/cancel`), body),
    );
  }

  /** `POST /api/v1/faculty/leave-requests/{id}/supporting-document` (confirmed) -- links an already-uploaded-and-confirmed Documents artifact to this LeaveRequest. */
  attachSupportingDocument(
    id: string,
    body: AttachSupportingDocumentRequest,
  ): Observable<LeaveRequestDto> {
    return this.normalizeErrors(
      this.http.post<LeaveRequestDto>(
        this.apiUrl(`faculty/leave-requests/${id}/supporting-document`),
        body,
      ),
    );
  }

  /** `POST /api/v1/faculty/leave-requests/{id}/approve/department-head` (confirmed, `faculty.leave.approve.department`) -- out of this app's own UI scope per FWEB-24..26's ticket text (no Department-Head-approves-OTHERS'-leave screen named), exposed here for completeness/future use. */
  approveByDepartmentHead(id: string, body: VersionedRequestBody): Observable<LeaveRequestDto> {
    return this.normalizeErrors(
      this.http.post<LeaveRequestDto>(
        this.apiUrl(`faculty/leave-requests/${id}/approve/department-head`),
        body,
      ),
    );
  }

  /** `POST /api/v1/faculty/leave-requests/{id}/approve/authority` (confirmed, `faculty.leave.approve.authority`). */
  approveByAuthority(id: string, body: VersionedRequestBody): Observable<LeaveRequestDto> {
    return this.normalizeErrors(
      this.http.post<LeaveRequestDto>(
        this.apiUrl(`faculty/leave-requests/${id}/approve/authority`),
        body,
      ),
    );
  }

  /** `POST /api/v1/faculty/leave-requests/{id}/reject/department-head` (confirmed). */
  rejectByDepartmentHead(id: string, body: RejectLeaveRequestRequest): Observable<LeaveRequestDto> {
    return this.normalizeErrors(
      this.http.post<LeaveRequestDto>(
        this.apiUrl(`faculty/leave-requests/${id}/reject/department-head`),
        body,
      ),
    );
  }

  /** `POST /api/v1/faculty/leave-requests/{id}/reject/authority` (confirmed). */
  rejectByAuthority(id: string, body: RejectLeaveRequestRequest): Observable<LeaveRequestDto> {
    return this.normalizeErrors(
      this.http.post<LeaveRequestDto>(
        this.apiUrl(`faculty/leave-requests/${id}/reject/authority`),
        body,
      ),
    );
  }

  /** `GET /api/v1/faculty/members/{facultyMemberId}/research-profile` (confirmed, `AllowAnonymous`) -- the SAME query `ums-public-web`'s faculty directory reads (requirement-spec.md §3.6). */
  getResearchProfile(facultyMemberId: string): Observable<ResearchProfileDto> {
    return this.normalizeErrors(
      this.http.get<ResearchProfileDto>(
        this.apiUrl(`faculty/members/${facultyMemberId}/research-profile`),
      ),
    );
  }

  /** `PUT /api/v1/faculty/members/{facultyMemberId}/research-profile` (confirmed, `faculty.research.publish` for the owning FacultyMember) -- REPLACES the entire publications list; see `faculty.types.ts`'s `PublicationDto` doc for the confirmed no-per-entry-visibility gap this implies. */
  updateResearchProfile(
    facultyMemberId: string,
    request: UpdateResearchProfileRequest,
  ): Observable<ResearchProfileDto> {
    return this.normalizeErrors(
      this.http.put<ResearchProfileDto>(
        this.apiUrl(`faculty/members/${facultyMemberId}/research-profile`),
        request,
      ),
    );
  }
}
