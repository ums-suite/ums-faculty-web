import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LearningApi } from '../../core/api/learning.api';
import type {
  LectureMaterialDto,
  LectureMaterialUploadSlotDto,
} from '../../core/api/learning.types';
import { MaterialsStore } from './materials.store';

describe('MaterialsStore', () => {
  let learningApiSpy: jasmine.SpyObj<LearningApi>;
  let httpSpy: jasmine.SpyObj<HttpClient>;
  let store: MaterialsStore;
  const courseOfferingId = 'off-1';

  function slot(
    overrides: Partial<LectureMaterialUploadSlotDto> = {},
  ): LectureMaterialUploadSlotDto {
    return {
      artifactId: 'artifact-1',
      status: 'PendingUpload',
      uploadUrl: 'https://storage.example/put',
      ...overrides,
    };
  }

  function material(overrides: Partial<LectureMaterialDto> = {}): LectureMaterialDto {
    return {
      id: 'm-1',
      courseOfferingId,
      materialType: 'Document',
      moduleGroup: 'Week 1',
      sortOrder: 0,
      title: 'Syllabus',
      description: null,
      resolvedLanguage: 'En',
      publishedByUserId: 'u-1',
      createdAt: 't',
      currentVersion: null,
      versions: [],
      ...overrides,
    };
  }

  function pdfFile(name = 'notes.pdf'): File {
    return new File(['x'.repeat(10)], name, { type: 'application/pdf' });
  }

  beforeEach(() => {
    learningApiSpy = jasmine.createSpyObj('LearningApi', [
      'listMaterials',
      'requestUpload',
      'confirmUpload',
      'createMaterial',
      'publishVersion',
    ]);
    httpSpy = jasmine.createSpyObj('HttpClient', ['put']);
    learningApiSpy.listMaterials.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        { provide: LearningApi, useValue: learningApiSpy },
        { provide: HttpClient, useValue: httpSpy },
      ],
    });
    store = TestBed.inject(MaterialsStore);
    // Isolate localStorage between tests.
    TestBed.inject(DOCUMENT).defaultView?.localStorage.removeItem(
      `fweb.materials.scheduled.${courseOfferingId}`,
    );
  });

  afterEach(() => store.closeCourseOffering());

  it('openCourseOffering loads the material list', () => {
    learningApiSpy.listMaterials.and.returnValue(of([material()]));
    store.openCourseOffering(courseOfferingId);
    expect(store.materials().length).toBe(1);
  });

  it('startUpload rejects an invalid file up front without calling the API', () => {
    const badFile = new File([], 'empty.pdf', { type: 'application/pdf' });
    store.openCourseOffering(courseOfferingId);
    store.startUpload(badFile, { materialType: 'Document', moduleGroup: 'Week 1', title: 'Notes' });

    expect(learningApiSpy.requestUpload).not.toHaveBeenCalled();
    expect(store.uploads()[0].phase).toBe('error');
    expect(store.uploads()[0].errorKey).toBe('materials.error.emptyFile');
  });

  it('startUpload runs the full pipeline and publishes immediately when not scheduled', () => {
    learningApiSpy.requestUpload.and.returnValue(of(slot()));
    httpSpy.put.and.returnValue(of({ type: HttpEventType.Response } as never));
    learningApiSpy.confirmUpload.and.returnValue(of(slot({ status: 'Ready' })));
    learningApiSpy.createMaterial.and.returnValue(of(material()));

    store.openCourseOffering(courseOfferingId);
    store.startUpload(pdfFile(), {
      materialType: 'Document',
      moduleGroup: 'Week 1',
      title: 'Notes',
    });

    expect(learningApiSpy.requestUpload).toHaveBeenCalledWith(courseOfferingId, {
      mimeType: 'application/pdf',
    });
    expect(learningApiSpy.confirmUpload).toHaveBeenCalledWith(courseOfferingId, {
      artifactId: 'artifact-1',
    });
    expect(learningApiSpy.createMaterial).toHaveBeenCalledWith(
      courseOfferingId,
      jasmine.objectContaining({
        materialType: 'Document',
        moduleGroup: 'Week 1',
        titleEn: 'Notes',
        artifactId: 'artifact-1',
      }),
    );
    expect(store.uploads()[0].phase).toBe('success');
  });

  it('startUpload with replacesMaterialId publishes a new VERSION instead of creating fresh', () => {
    learningApiSpy.requestUpload.and.returnValue(of(slot()));
    httpSpy.put.and.returnValue(of({ type: HttpEventType.Response } as never));
    learningApiSpy.confirmUpload.and.returnValue(of(slot({ status: 'Ready' })));
    learningApiSpy.publishVersion.and.returnValue(of(material()));

    store.openCourseOffering(courseOfferingId);
    store.startUpload(pdfFile(), {
      materialType: 'Document',
      moduleGroup: 'Week 1',
      title: 'Notes v2',
      replacesMaterialId: 'm-1',
    });

    expect(learningApiSpy.publishVersion).toHaveBeenCalledWith('m-1', {
      artifactId: 'artifact-1',
      externalUrl: null,
      changeNote: 'Notes v2',
    });
    expect(learningApiSpy.createMaterial).not.toHaveBeenCalled();
  });

  it('a future scheduledFor defers publish until due (FWEB-23)', () => {
    learningApiSpy.requestUpload.and.returnValue(of(slot()));
    httpSpy.put.and.returnValue(of({ type: HttpEventType.Response } as never));
    learningApiSpy.confirmUpload.and.returnValue(of(slot({ status: 'Ready' })));

    const future = new Date(Date.now() + 60_000).toISOString();
    store.openCourseOffering(courseOfferingId);
    store.startUpload(pdfFile(), {
      materialType: 'Document',
      moduleGroup: 'Week 2',
      title: 'Later',
      scheduledFor: future,
    });

    expect(store.uploads()[0].phase).toBe('scheduled');
    expect(learningApiSpy.createMaterial).not.toHaveBeenCalled();
  });

  it('checkScheduledReleases fires a due scheduled upload', () => {
    learningApiSpy.requestUpload.and.returnValue(of(slot()));
    httpSpy.put.and.returnValue(of({ type: HttpEventType.Response } as never));
    learningApiSpy.confirmUpload.and.returnValue(of(slot({ status: 'Ready' })));
    learningApiSpy.createMaterial.and.returnValue(of(material()));

    const past = new Date(Date.now() - 1000).toISOString();
    store.openCourseOffering(courseOfferingId);
    store.startUpload(pdfFile(), {
      materialType: 'Document',
      moduleGroup: 'Week 2',
      title: 'Now due',
      scheduledFor: new Date(Date.now() + 60_000).toISOString(),
    });
    // Force it into the past to simulate time passing, then re-check.
    const localId = store.uploads()[0].localId;
    (store as unknown as { updateUpload: (id: string, patch: object) => void }).updateUpload(
      localId,
      {
        scheduledFor: past,
      },
    );

    store.checkScheduledReleases();

    expect(learningApiSpy.createMaterial).toHaveBeenCalled();
  });

  it('a mid-upload failure surfaces an error state', () => {
    learningApiSpy.requestUpload.and.returnValue(of(slot()));
    httpSpy.put.and.returnValue(throwError(() => new Error('network down')));

    store.openCourseOffering(courseOfferingId);
    store.startUpload(pdfFile(), {
      materialType: 'Document',
      moduleGroup: 'Week 1',
      title: 'Notes',
    });

    expect(store.uploads()[0].phase).toBe('error');
    expect(store.uploads()[0].errorKey).toBe('materials.error.uploadFailed');
  });

  it('retryUpload resumes from publish when the artifact was already confirmed', () => {
    learningApiSpy.requestUpload.and.returnValue(of(slot()));
    httpSpy.put.and.returnValue(of({ type: HttpEventType.Response } as never));
    learningApiSpy.confirmUpload.and.returnValue(of(slot({ status: 'Ready' })));
    learningApiSpy.createMaterial.and.returnValue(throwError(() => new Error('server down')));

    store.openCourseOffering(courseOfferingId);
    store.startUpload(pdfFile(), {
      materialType: 'Document',
      moduleGroup: 'Week 1',
      title: 'Notes',
    });
    expect(store.uploads()[0].phase).toBe('error');
    expect(store.uploads()[0].artifactId).toBe('artifact-1');

    learningApiSpy.createMaterial.and.returnValue(of(material()));
    const localId = store.uploads()[0].localId;
    store.retryUpload(localId);

    expect(learningApiSpy.requestUpload).toHaveBeenCalledTimes(1); // never re-uploaded
    expect(store.uploads()[0].phase).toBe('success');
  });

  it('retryUpload does a from-scratch retry when the failure happened before confirm', () => {
    learningApiSpy.requestUpload.and.returnValue(throwError(() => new Error('network down')));

    store.openCourseOffering(courseOfferingId);
    store.startUpload(pdfFile(), {
      materialType: 'Document',
      moduleGroup: 'Week 1',
      title: 'Notes',
    });
    expect(store.uploads()[0].artifactId).toBeNull();

    learningApiSpy.requestUpload.and.returnValue(of(slot()));
    httpSpy.put.and.returnValue(of({ type: HttpEventType.Response } as never));
    learningApiSpy.confirmUpload.and.returnValue(of(slot({ status: 'Ready' })));
    learningApiSpy.createMaterial.and.returnValue(of(material()));

    const localId = store.uploads()[0].localId;
    store.retryUpload(localId);

    expect(learningApiSpy.requestUpload).toHaveBeenCalledTimes(2);
    expect(store.uploads()[0].phase).toBe('success');
  });

  it('removeUpload drops the entry entirely', () => {
    store.openCourseOffering(courseOfferingId);
    const badFile = new File([], 'empty.pdf', { type: 'application/pdf' });
    const localId = store.startUpload(badFile, {
      materialType: 'Document',
      moduleGroup: 'Week 1',
      title: 'Notes',
    });

    store.removeUpload(localId);

    expect(store.uploads().length).toBe(0);
  });

  it('a scheduled upload persists to localStorage and reloads on reopen (same device)', () => {
    learningApiSpy.requestUpload.and.returnValue(of(slot()));
    httpSpy.put.and.returnValue(of({ type: HttpEventType.Response } as never));
    learningApiSpy.confirmUpload.and.returnValue(of(slot({ status: 'Ready' })));

    const future = new Date(Date.now() + 60_000).toISOString();
    store.openCourseOffering(courseOfferingId);
    store.startUpload(pdfFile(), {
      materialType: 'Video',
      moduleGroup: 'Week 3',
      title: 'Lecture recording',
      scheduledFor: future,
    });

    // Simulate a fresh page load: re-opening resets all in-memory state and re-reads localStorage,
    // exactly like a real page reload would (the persisted metadata is the only thing surviving).
    store.openCourseOffering(courseOfferingId);

    const restored = store.uploads().find((u) => u.title === 'Lecture recording');
    expect(restored?.phase).toBe('scheduled');
    expect(restored?.materialType).toBe('Video');
    expect(restored?.artifactId).toBe('artifact-1');
  });
});
