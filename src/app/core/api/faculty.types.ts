/**
 * Wire DTOs for `Faculty` module endpoints. Field names/shapes verified against
 * `ums-core/src/UMS.Modules/Faculty/UMS.Modules.Faculty.Application/**\/*.cs` directly, never
 * guessed.
 */

/** `UMS.Modules.Faculty.Application.FacultyMembers.FacultyMemberDto` -- employment-profile shape (confirmed field-for-field against source). */
export interface FacultyMemberDto {
  readonly id: string;
  readonly userId: string;
  readonly employeeId: string;
  readonly departmentId: string;
  readonly designationId: string;
  readonly employmentType: string;
  readonly status: string;
  readonly isDepartmentHead: boolean;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly joiningDate: string;
  readonly createdAt: string;
  readonly version: number;
}

/** `UMS.Modules.Faculty.Application.FacultyMembers.FacultyMemberListPage`. */
export interface FacultyMemberListPage {
  readonly items: readonly FacultyMemberDto[];
  readonly totalCount: number;
  readonly skip: number;
  readonly take: number;
}

/**
 * `UMS.Modules.Faculty.Application.CourseAssignments` -- one row of the faculty member's own
 * teaching load, per `CourseAssignmentQueryService.ListByFacultyMemberAsync`. This is Faculty's
 * own eventually-consistent PROJECTION of Academic's authoritative `InstructorAssigned` event
 * (`services/faculty/requirement-spec.md` §2) -- see design-decisions.md "CourseAssignment
 * Freshness UX" for why this app never polls it and instead offers a manual refresh affordance.
 */
export interface CourseAssignmentDto {
  readonly id: string;
  readonly facultyMemberId: string;
  readonly courseOfferingId: string;
  readonly departmentId: string;
  readonly semesterId?: string;
  readonly assignedAt: string;
}
