/**
 * Wire DTOs for `Academic` module endpoints this app calls directly (requirement-spec.md §6's
 * cross-module note: "attendance-marking and grade-entry screens call the Academic module's API
 * DIRECTLY... no Faculty-backend proxy"). Field names/shapes verified against
 * `ums-core/src/UMS.Modules/Academic/UMS.Modules.Academic.Application/**\/*.cs` directly (System.
 * Text.Json default camelCase over the wire), never guessed.
 */

export interface SectionDto {
  readonly id: string;
  readonly code: string;
  readonly dayOfWeek: number;
  readonly start: string;
  readonly end: string;
}

export interface AssessmentDto {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
}

export interface ExamDto {
  readonly id: string;
  readonly name: string;
  readonly assessments: readonly AssessmentDto[];
}

/**
 * `UMS.Modules.Academic.Application.CourseOfferings.CourseOfferingDto`. Note there is no
 * per-student roster field here -- only `enrolledCount` (a number). **Confirmed backend gap**: no
 * endpoint anywhere in `ums-core` returns a per-student enrollment list for one CourseOffering
 * (verified against `EnrollmentEndpoints.cs`, which only exposes `POST /enrollments` and
 * `GET /enrollments/{id}` by single id -- no `GET /course-offerings/{id}/enrollments` or
 * equivalent list-by-offering route). `AttendanceApi`/`AttendanceStore`'s own doc comments carry
 * the consequence of this gap for roster loading.
 */
export interface CourseOfferingDto {
  readonly id: string;
  readonly courseId: string;
  readonly semesterId: string;
  readonly departmentId: string;
  readonly capacity: number;
  readonly enrolledCount: number;
  readonly hasAvailableSeats: boolean;
  readonly instructorFacultyMemberId: string | null;
  readonly sections: readonly SectionDto[];
  readonly exams: readonly ExamDto[];
  readonly createdAt: string;
}

/** `UMS.Modules.Academic.Application.Enrollments` -- single-enrollment shape (get-by-id only, confirmed). */
export interface EnrollmentDto {
  readonly id: string;
  readonly studentId: string;
  readonly courseOfferingId: string;
  readonly sectionId: string | null;
  readonly status: string;
}

/**
 * The four-state set `requirement-spec.md` §3.2/archive/srs1.md §10.2 resolves attendance status
 * to, matching `UMS.Modules.Academic.Domain.Attendance.AttendanceStatus` exactly.
 */
export type AttendanceStatusCode = 'Present' | 'Absent' | 'Late' | 'Excused';

/** `UMS.Modules.Academic.Application.Attendance.AttendanceRecordDto`. */
export interface AttendanceRecordDto {
  readonly enrollmentId: string;
  readonly status: string;
  readonly markedByFacultyMemberId: string;
  readonly markedAt: string;
}

/**
 * `UMS.Modules.Academic.Application.Attendance.AttendanceSessionDto` -- the full response body of
 * `POST /api/v1/academic/attendance`. **Confirmed backend gap**: there is no `GET` counterpart
 * (verified against `AttendanceEndpoints.cs`, which maps only `POST /attendance`) -- this DTO
 * shape is only ever observed as a side effect of marking at least one record, never as an
 * independent "open this session and see what's already marked" read. `AttendanceApi.fetchSession`
 * documents the consequence.
 */
export interface AttendanceSessionDto {
  readonly id: string;
  readonly courseOfferingId: string;
  readonly sessionDate: string;
  readonly correctionWindowClose: string;
  readonly records: readonly AttendanceRecordDto[];
}

/** `UMS.Modules.Academic.Application.Attendance.MarkAttendanceRequest`. */
export interface MarkAttendanceRequest {
  readonly courseOfferingId: string;
  readonly sessionDate: string;
  readonly correctionWindowClose: string | null;
  readonly enrollmentId: string;
  readonly status: AttendanceStatusCode;
}
