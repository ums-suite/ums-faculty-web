/**
 * Wire DTOs for the `Learning` module's LectureMaterial endpoints (FWEB-22/FWEB-23). Field names
 * verified against `ums-core/src/UMS.Modules/Learning/UMS.Modules.Learning.Application/
 * LectureMaterials/*.cs` directly, never guessed. This is `requirement-spec.md` §6's "Course
 * Materials" feature area -- the real backend module implementing it is `Learning`, not `Content`
 * (the spec's own module-consumption table names `Content` for "course-material storage metadata
 * alongside Documents"; `Learning`'s `LectureMaterial` is the actual, real, already-implemented
 * home for this data, confirmed by reading `ums-core` source directly rather than guessing off the
 * spec's own module list).
 */

export interface LectureMaterialVersionDto {
  readonly id: string;
  readonly versionNumber: number;
  readonly artifactId: string | null;
  readonly externalUrl: string | null;
  readonly changeNote: string | null;
  readonly publishedByUserId: string;
  readonly publishedAt: string;
}

export interface LectureMaterialVersionSummaryDto {
  readonly id: string;
  readonly versionNumber: number;
  readonly publishedAt: string;
  readonly isCurrent: boolean;
}

export interface LectureMaterialDto {
  readonly id: string;
  readonly courseOfferingId: string;
  readonly materialType: string;
  readonly moduleGroup: string;
  readonly sortOrder: number;
  readonly title: string;
  readonly description: string | null;
  readonly resolvedLanguage: string;
  readonly publishedByUserId: string;
  readonly createdAt: string;
  readonly currentVersion: LectureMaterialVersionDto | null;
  readonly versions: readonly LectureMaterialVersionSummaryDto[];
}

/** `RequestLectureMaterialUploadRequest` -- the presigned-upload request (LRN-13, the same mechanism `Documents`' own upload endpoints use, per `LectureMaterialService`'s own doc comment). */
export interface RequestLectureMaterialUploadRequest {
  readonly mimeType: string;
}

/** `LectureMaterialUploadSlotDto` -- `uploadUrl` is a presigned direct-to-object-storage PUT target (`@ums/shared`'s `authInterceptor` correctly skips attaching the bearer token to this since it targets a different origin than `apiBaseUrl`, per the platform-wide upload pattern, ADR-0010). */
export interface LectureMaterialUploadSlotDto {
  readonly artifactId: string;
  readonly status: string;
  readonly uploadUrl: string | null;
}

export interface ConfirmLectureMaterialUploadRequest {
  readonly artifactId: string;
}

/** `CreateLectureMaterialRequest` -- English title/description required, Bengali optional (ADR-0011). */
export interface CreateLectureMaterialRequest {
  readonly materialType: string;
  readonly moduleGroup: string;
  readonly sortOrder: number;
  readonly titleEn: string;
  readonly descriptionEn: string | null;
  readonly titleBn: string | null;
  readonly descriptionBn: string | null;
  readonly artifactId: string | null;
  readonly externalUrl: string | null;
}

/** `PublishLectureMaterialVersionRequest` -- FWEB-22's "replacing a file creates a new version, never a silent overwrite": this is that new-version call, never a mutation of an existing one. */
export interface PublishLectureMaterialVersionRequest {
  readonly artifactId: string | null;
  readonly externalUrl: string | null;
  readonly changeNote: string | null;
}

/** The real, fixed `UMS.Modules.Learning.Domain.LectureMaterials.LectureMaterialType` enum (confirmed against source, not guessed). */
export type LectureMaterialTypeCode = 'Video' | 'Document' | 'Link';
