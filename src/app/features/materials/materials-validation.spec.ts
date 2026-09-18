import { MAX_MATERIAL_FILE_SIZE_BYTES, validateMaterialFile } from './materials-validation';

describe('validateMaterialFile', () => {
  it('accepts an ordinary allowed-type, in-range file', () => {
    expect(
      validateMaterialFile({ name: 'syllabus.pdf', size: 1024, type: 'application/pdf' }),
    ).toEqual({
      valid: true,
      errorKey: null,
    });
  });

  it('rejects an empty (zero-byte) file', () => {
    expect(validateMaterialFile({ name: 'empty.pdf', size: 0, type: 'application/pdf' })).toEqual({
      valid: false,
      errorKey: 'materials.error.emptyFile',
    });
  });

  it('rejects a file above the size ceiling', () => {
    expect(
      validateMaterialFile({
        name: 'huge.mp4',
        size: MAX_MATERIAL_FILE_SIZE_BYTES + 1,
        type: 'video/mp4',
      }),
    ).toEqual({ valid: false, errorKey: 'materials.error.tooLarge' });
  });

  it('accepts a file exactly at the size ceiling', () => {
    expect(
      validateMaterialFile({
        name: 'max.mp4',
        size: MAX_MATERIAL_FILE_SIZE_BYTES,
        type: 'video/mp4',
      }),
    ).toEqual({ valid: true, errorKey: null });
  });

  it('rejects an unsupported mime type', () => {
    expect(
      validateMaterialFile({ name: 'virus.exe', size: 1024, type: 'application/x-msdownload' }),
    ).toEqual({ valid: false, errorKey: 'materials.error.unsupportedType' });
  });

  it('accepts a file with no reported type (some browsers omit it) rather than falsely rejecting', () => {
    expect(validateMaterialFile({ name: 'unknown', size: 1024, type: '' })).toEqual({
      valid: true,
      errorKey: null,
    });
  });
});
