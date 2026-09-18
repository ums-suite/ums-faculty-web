import type { LectureMaterialDto, LectureMaterialTypeCode } from '../../core/api/learning.types';

/** FWEB-22/FWEB-23 domain types. */

export type UploadPhase =
  | 'validating'
  | 'requesting'
  | 'uploading'
  | 'confirming'
  | 'publishing'
  | 'scheduled'
  | 'success'
  | 'error';

/** One in-flight (or scheduled) upload -- the browser `File` is held only in memory for this tab's life, never persisted, matching the platform's usual "don't persist raw file bytes client-side" posture. */
export interface PendingUpload {
  readonly localId: string;
  readonly materialType: LectureMaterialTypeCode;
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly moduleGroup: string;
  readonly title: string;
  /** `null` -- a brand-new LectureMaterial; otherwise the existing LectureMaterial this becomes a NEW version of (FWEB-22's "replace creates a new version, never a silent overwrite"). */
  readonly replacesMaterialId: string | null;
  /** FWEB-23: a future publish-at datetime (ISO 8601) -- `null` means publish immediately. See `MaterialsStore`'s own class doc for the confirmed scheduling-gap this resolves around. */
  readonly scheduledFor: string | null;
  readonly phase: UploadPhase;
  readonly progress: number;
  readonly errorKey: string | null;
  readonly artifactId: string | null;
}

export { type LectureMaterialDto, type LectureMaterialTypeCode };
