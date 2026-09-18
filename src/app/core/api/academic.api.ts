import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProvisionalModuleApiBase } from '../http/provisional-module-api.base';
import type {
  AttendanceSessionDto,
  CorrectGradeRequest,
  CourseOfferingDto,
  EnrollmentDto,
  GradeDto,
  MarkAttendanceRequest,
  RejectGradeBatchRequest,
  ResultPublicationDto,
  SubmitGradeRequest,
} from './academic.types';

/**
 * Interim client for `Academic` module endpoints this app calls directly (FWEB-5, per
 * requirement-spec.md §6's cross-module note: no Faculty-backend proxy sits in front of Academic
 * for roster/Enrollment/Attendance data). Each method's own doc comment names the exact route
 * verified against `ums-core`'s `UMS.Modules.Academic.Api.Endpoints.*` source, never guessed.
 */
@Injectable({ providedIn: 'root' })
export class AcademicApi extends ProvisionalModuleApiBase {
  /** `GET /api/v1/academic/course-offerings?semester={id}` (confirmed, `CourseOfferingEndpoints.cs`). */
  listCourseOfferings(semesterId: string): Observable<CourseOfferingDto[]> {
    const params = new HttpParams().set('semester', semesterId);
    return this.normalizeErrors(
      this.http.get<CourseOfferingDto[]>(this.apiUrl('academic/course-offerings'), { params }),
    );
  }

  /** `GET /api/v1/academic/course-offerings/{id}` (confirmed). Used to resolve section schedule/department for the "next class" card and attendance-session header. */
  getCourseOffering(id: string): Observable<CourseOfferingDto> {
    return this.normalizeErrors(
      this.http.get<CourseOfferingDto>(this.apiUrl(`academic/course-offerings/${id}`)),
    );
  }

  /**
   * `GET /api/v1/academic/enrollments/{id}` (confirmed, single-id only). **Confirmed gap: there is
   * no list-enrollments-by-CourseOffering endpoint** -- `AttendanceStore`'s roster loading cannot
   * be driven end-to-end from this client alone until one ships; see `attendance.store.ts`'s own
   * doc comment for how the store is shaped to isolate this gap behind a swappable roster source.
   */
  getEnrollment(id: string): Observable<EnrollmentDto> {
    return this.normalizeErrors(
      this.http.get<EnrollmentDto>(this.apiUrl(`academic/enrollments/${id}`)),
    );
  }

  /**
   * `POST /api/v1/academic/attendance` (confirmed, `AttendanceEndpoints.cs`) -- marks or re-marks
   * exactly one (Student, session) record and returns the FULL {@link AttendanceSessionDto}
   * (every record in the session, not just the one just written). This is the only read signal
   * this endpoint family provides -- there is no separate session/roster `GET` (see
   * `academic.types.ts`'s `AttendanceSessionDto` doc for the confirmed gap this implies).
   *
   * The session is created server-side on its first mark if it doesn't already exist -- callers
   * never need a separate "create session" call (FWEB-10's "session creation/open" is a purely
   * client-side concept layered on top of this single endpoint).
   */
  markAttendance(request: MarkAttendanceRequest): Observable<AttendanceSessionDto> {
    return this.normalizeErrors(
      this.http.post<AttendanceSessionDto>(this.apiUrl('academic/attendance'), request),
    );
  }

  /**
   * `POST /api/v1/academic/grades` (confirmed, `GradeEndpoints.cs`, `academic.grade.enter`) --
   * submits/resubmits one Enrollment's Assessment scores. Accepted only while the CourseOffering's
   * ResultPublication is `Draft`/`Calculated` server-side; rejected with `grade.already_locked`
   * once a Department Head has locked the batch (invariant §8.2, enforced authoritatively here,
   * never only by this app's own UI).
   */
  submitGrade(request: SubmitGradeRequest): Observable<GradeDto> {
    return this.normalizeErrors(this.http.post<GradeDto>(this.apiUrl('academic/grades'), request));
  }

  /**
   * `POST /api/v1/academic/grades/{id}/correct` (confirmed, `academic.grade.correct`) -- FWEB-19's
   * controlled correction workflow. Only accepted while the batch is `Published`
   * (`grade.correction_requires_published`); re-enters the state machine at `Verified`.
   */
  correctGrade(gradeId: string, request: CorrectGradeRequest): Observable<GradeDto> {
    return this.normalizeErrors(
      this.http.post<GradeDto>(this.apiUrl(`academic/grades/${gradeId}/correct`), request),
    );
  }

  /** `POST /api/v1/academic/results/{courseOfferingId}/lock` (confirmed, `academic.grade.lock`) -- the Department Head review-lock step, `Calculated` -> `Verified`. */
  lockResultBatch(courseOfferingId: string): Observable<ResultPublicationDto> {
    return this.normalizeErrors(
      this.http.post<ResultPublicationDto>(
        this.apiUrl(`academic/results/${courseOfferingId}/lock`),
        {},
      ),
    );
  }

  /** `POST /api/v1/academic/results/{courseOfferingId}/reject` (confirmed, `academic.grade.lock`) -- returns the batch to Faculty for re-entry. */
  rejectResultBatch(
    courseOfferingId: string,
    request: RejectGradeBatchRequest,
  ): Observable<ResultPublicationDto> {
    return this.normalizeErrors(
      this.http.post<ResultPublicationDto>(
        this.apiUrl(`academic/results/${courseOfferingId}/reject`),
        request,
      ),
    );
  }

  /** `POST /api/v1/academic/results/{courseOfferingId}/approve` (confirmed, `academic.result.approve`), `Verified` -> `Approved`. */
  approveResultBatch(courseOfferingId: string): Observable<ResultPublicationDto> {
    return this.normalizeErrors(
      this.http.post<ResultPublicationDto>(
        this.apiUrl(`academic/results/${courseOfferingId}/approve`),
        {},
      ),
    );
  }

  /** `POST /api/v1/academic/results/{courseOfferingId}/publish` (confirmed, `academic.result.publish`), `Approved` -> `Published`. */
  publishResultBatch(courseOfferingId: string): Observable<ResultPublicationDto> {
    return this.normalizeErrors(
      this.http.post<ResultPublicationDto>(
        this.apiUrl(`academic/results/${courseOfferingId}/publish`),
        {},
      ),
    );
  }

  /** `POST /api/v1/academic/results/{courseOfferingId}/archive` (confirmed, `academic.result.publish`), `Published` -> `Archived`. */
  archiveResultBatch(courseOfferingId: string): Observable<ResultPublicationDto> {
    return this.normalizeErrors(
      this.http.post<ResultPublicationDto>(
        this.apiUrl(`academic/results/${courseOfferingId}/archive`),
        {},
      ),
    );
  }
}
