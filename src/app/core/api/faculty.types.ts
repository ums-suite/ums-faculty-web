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

/**
 * `LeaveRequest` wire DTOs (FWEB-24..26), verified against
 * `ums-core/src/UMS.Modules/Faculty/UMS.Modules.Faculty.Application/LeaveRequests/*.cs`.
 *
 * **Confirmed backend gap: no leave-balance concept exists anywhere in `ums-core`** -- verified by
 * searching the entire `Faculty` module source for any "balance"-named field, endpoint, or domain
 * concept; there is none. FWEB-24's "leave-balance display" therefore has no real data to read --
 * `LeaveStore`/the Leave page render an honest "not available" state rather than a fabricated
 * number, matching this build's own precedent (`dashboard.types.ts`'s `attendanceCompletionPercent`
 * gap note).
 */
export const LEAVE_REQUEST_STATUSES = [
  'Draft',
  'Submitted',
  'DeptHeadApproved',
  'Approved',
  'Rejected',
  'Cancelled',
] as const;
export type LeaveRequestStatusCode = (typeof LEAVE_REQUEST_STATUSES)[number];

export interface LeaveRequestDto {
  readonly id: string;
  readonly facultyMemberId: string;
  readonly requesterUserId: string;
  /** `yyyy-MM-dd`, matching .NET's `DateOnly` wire format. */
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: string;
  readonly localizedReason: string;
  readonly status: string;
  /**
   * `Faculty`'s own "Self-Approval Routing Enforcement Mechanism" (design-decisions.md, Faculty
   * module): a Department Head's own self-authored request is routed DIRECTLY to the Authorized
   * Authority, server-side, at submission time -- the Department Head step is genuinely bypassed
   * for this one request, not merely hidden. `leave-approval-chain.ts` renders this real routing
   * fact honestly (the chain's fixed 3-node order per invariant §8.5 is never reordered or given a
   * user-facing skip control; this flag only changes which node the ALREADY-DECIDED server routing
   * passed through).
   */
  readonly routedDirectlyToAuthority: boolean;
  readonly supportingDocumentReference: string | null;
  readonly createdAt: string;
  readonly submittedAt: string | null;
  readonly decidedAt: string | null;
  readonly version: number;
}

export interface LeaveRequestListPage {
  readonly items: readonly LeaveRequestDto[];
  readonly skip: number;
  readonly take: number;
}

export interface SubmitLeaveRequestRequest {
  readonly facultyMemberId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: string;
  readonly reasonTranslations?: Readonly<Record<string, string>>;
}

export interface VersionedRequestBody {
  readonly version: number;
}

export interface RejectLeaveRequestRequest {
  readonly reason: string | null;
  readonly version: number;
}

export interface AttachSupportingDocumentRequest {
  readonly generatedDocumentId: string;
  readonly version: number;
}

/**
 * `ResearchProfile` wire DTOs (FWEB-27/FWEB-28), verified against
 * `ums-core/src/UMS.Modules/Faculty/UMS.Modules.Faculty.Application/ResearchProfiles/*.cs`.
 *
 * **Confirmed backend gap: `PublicationDto` has no per-entry visibility/draft field at all** --
 * `ResearchProfile.Update` unconditionally REPLACES the entire publications list with whatever is
 * PUT, and the GET is `AllowAnonymous` (the exact same list `ums-public-web`'s faculty directory
 * reads). There is no server-side concept of "staged, not yet public" for one entry. FWEB-28's
 * resolution (`ResearchStore`'s own class doc carries the mechanism): a draft-visibility entry is
 * simply never included in the PUT body until explicitly toggled to public and saved -- since the
 * public GET reflects only what was last PUT, an entry that was never sent is, by construction,
 * never visible on the public directory mid-edit. Draft entries persist to this browser's
 * `localStorage` (never the server) so they survive a reload on the same device.
 */
export interface PublicationDto {
  readonly title: string;
  readonly venue: string;
  readonly year: number;
  readonly url: string | null;
}

export interface ResearchProfileDto {
  readonly id: string;
  readonly facultyMemberId: string;
  readonly publications: readonly PublicationDto[];
  readonly ongoingResearch: string | null;
  readonly grants: string | null;
  readonly version: number;
}

export interface UpdateResearchProfileRequest {
  readonly publications: readonly PublicationDto[];
  readonly ongoingResearch: string | null;
  readonly grants: string | null;
  readonly version: number;
}
