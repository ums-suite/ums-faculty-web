/**
 * Wire DTOs for `Documents` module endpoints this app calls directly for FWEB-24's leave-document
 * attachment (`UMS.Modules.Documents.Api/Endpoints/UploadEndpoints.cs`,
 * `UMS.Modules.Documents.Application/Uploads/*.cs`, verified against source).
 *
 * **Confirmed backend gap, flagged**: `POST /api/v1/documents/uploads` is gated by
 * `document.document.generate` -- per `Learning`'s own `LectureMaterialEndpoints.cs` doc comment,
 * this permission is "a Registrar-level capability", and Learning ships its OWN
 * Instructor-gated wrapper endpoints specifically because a plain instructor cannot be assumed to
 * hold it. `Faculty`'s `LeaveRequestEndpoints.cs` has no equivalent wrapper for a LeaveRequest's
 * own supporting-document upload -- there is no Faculty-scoped presigned-upload endpoint at all.
 * This client is built against the only real upload mechanism visible in `ums-core` today (this
 * one), on the working assumption a FacultyMember's own role grant includes
 * `document.document.generate` for their own uploads -- unconfirmed, and flagged here for
 * cross-team follow-up (a `faculty.leave.attach-document`-gated wrapper, mirroring Learning's own
 * precedent, would close this gap cleanly).
 */
export interface RequestUploadRequestBody {
  readonly ownerId: string;
  readonly artifactType: string;
  readonly mimeType: string;
}

export interface UploadedArtifactDto {
  readonly id: string;
  readonly ownerId: string;
  readonly artifactType: string;
  readonly mimeType: string;
  readonly status: string;
  readonly sizeBytes: number | null;
  readonly requestedAt: string;
  readonly readyAt: string | null;
  readonly uploadUrl: string | null;
  readonly downloadUrl: string | null;
}
