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

/**
 * Grade Entry & Result Submission wire DTOs (FWEB-17..21). Verified directly against
 * `ums-core/src/UMS.Modules/Academic/UMS.Modules.Academic.Application/Grades/*.cs` and
 * `.../ResultPublications/*.cs`.
 *
 * **Confirmed backend gap, no configurable "max marks" per component**: `AssessmentDto.weight` is
 * the ONLY per-component configurable number (a 0.0-1.0 fraction of the aggregate) --
 * `GradeCalculator.Calculate` hard-validates every individual score to a fixed `0..100` range
 * (`grade.score_out_of_range`), never a per-Assessment configurable maximum. Domain Invariant #4
 * ("marks never exceed a component's configured maximum") is therefore satisfied here against
 * that real, fixed 0-100 range -- `grade-calculation.ts`'s `MAX_ASSESSMENT_SCORE` constant is the
 * one place this is encoded, not a per-Assessment field that doesn't exist server-side.
 */
export interface AssessmentScoreDto {
  readonly assessmentId: string;
  readonly score: number;
}

/**
 * `UMS.Modules.Academic.Application.Grades.GradeDto` -- the ONLY response shape
 * `POST /academic/grades` ever returns. **Confirmed backend gap**: there is no `GET` anywhere for
 * an existing Grade by enrollmentId (verified against `GradeEndpoints.cs`: only
 * `POST /` and `POST /{id}/correct`) and `EnrollmentDto` (this file) carries no nested Grade field
 * either -- a previously-submitted mark can only ever be known to this client if it was itself
 * present when the submitting response arrived (or a later correction/lock/publish response
 * mentions it), exactly the same shape of gap `AttendanceSessionDto`'s own doc names for sessions.
 * `GradingStore`'s own class doc carries the consequence (a per-session "observed" log, never a
 * fabricated read).
 */
export interface GradeDto {
  readonly id: string;
  readonly enrollmentId: string;
  readonly calculatedScore: number | null;
  readonly letterGrade: string | null;
  readonly scores: readonly AssessmentScoreDto[];
  readonly submittedAt: string | null;
}

/** `UMS.Modules.Academic.Application.Grades.SubmitGradeRequest`. */
export interface SubmitGradeRequest {
  readonly enrollmentId: string;
  readonly scores: readonly AssessmentScoreDto[];
}

/** `UMS.Modules.Academic.Application.Grades.CorrectGradeRequest` -- ACD-13's controlled re-publication-workflow correction (FWEB-19); `reason` is mandatory server-side. */
export interface CorrectGradeRequest {
  readonly scores: readonly AssessmentScoreDto[];
  readonly reason: string;
}

/**
 * The real `UMS.Modules.Academic.Domain.ResultPublications.ResultPublicationStatus` enum exactly
 * (`Draft, Calculated, Verified, Approved, Published, Archived`) -- `Verified` is the real
 * "locked, Department-Head-review-eligible" state (the endpoint that produces it is literally
 * named `lock`, `ResultPublicationEndpoints.cs`), surfaced to faculty as "Under Review" per
 * requirement-spec.md §7's banner wording (`grade-lock-state.ts`'s own doc carries this mapping).
 */
export type ResultPublicationStatusCode =
  'Draft' | 'Calculated' | 'Verified' | 'Approved' | 'Published' | 'Archived';

/**
 * `UMS.Modules.Academic.Application.ResultPublications.ResultPublicationDto`. **Confirmed backend
 * gap**: there is no `GET` endpoint anywhere that reads a CourseOffering's current
 * ResultPublication status independently -- verified against `ResultPublicationEndpoints.cs`,
 * which maps only the five state-transition `POST`s (`lock`/`reject`/`approve`/`publish`/
 * `archive`), each returning this DTO as a side effect of the mutation it performs. A faculty
 * member (or Department Head) who reopens the Grading screen without having just performed one of
 * those five actions in the CURRENT browser session has no way to learn the real current status
 * from this API surface alone. `GradingStore`'s own class doc carries the consequence (an honest
 * "status last known from an action taken this session" posture, never a fabricated read).
 */
export interface ResultPublicationDto {
  readonly id: string;
  readonly courseOfferingId: string;
  readonly status: string;
  readonly calculatedAt: string | null;
  readonly rejectedAt: string | null;
  readonly rejectionReason: string | null;
  readonly lockedAt: string | null;
  readonly approvedAt: string | null;
  readonly publishedAt: string | null;
  readonly archivedAt: string | null;
  readonly correctionCount: number;
}

/** `UMS.Modules.Academic.Application.ResultPublications.RejectGradeBatchRequest`. */
export interface RejectGradeBatchRequest {
  readonly reason: string;
}
