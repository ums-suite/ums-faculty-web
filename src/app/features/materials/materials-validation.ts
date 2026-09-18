/**
 * Client-side file type/size validation (FWEB-22, requirement-spec.md §5: "File uploads... are
 * validated client-side for type/size before transmission as a first line of defense, with the
 * backend remaining the authoritative check"). Pure and Angular-free so it's trivial to unit test.
 */

/** requirement-spec.md §5's own named example ("multi-hundred-MB video") -- generous enough for lecture video, still a real client-side ceiling so an obviously-oversized file fails fast rather than starting a doomed multi-hundred-MB upload. */
export const MAX_MATERIAL_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB

export const ALLOWED_MATERIAL_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'text/plain',
  'image/png',
  'image/jpeg',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export interface FileValidationResult {
  readonly valid: boolean;
  readonly errorKey: string | null;
}

export function validateMaterialFile(file: {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}): FileValidationResult {
  if (file.size <= 0) {
    return { valid: false, errorKey: 'materials.error.emptyFile' };
  }
  if (file.size > MAX_MATERIAL_FILE_SIZE_BYTES) {
    return { valid: false, errorKey: 'materials.error.tooLarge' };
  }
  if (file.type && !ALLOWED_MATERIAL_MIME_TYPES.has(file.type)) {
    return { valid: false, errorKey: 'materials.error.unsupportedType' };
  }
  return { valid: true, errorKey: null };
}
