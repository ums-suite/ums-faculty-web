import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AcademicApi } from '../../core/api/academic.api';
import type { GradeDto, ResultPublicationDto } from '../../core/api/academic.types';
import type { InAppNotificationDto } from '../../core/api/notifications.types';
import { GradeLockListenerService } from './grade-lock-listener.service';
import { GradingStore } from './grading.store';
import type { AssessmentColumn, GradeRosterStudent } from './grading.types';

describe('GradingStore', () => {
  let academicApiSpy: jasmine.SpyObj<AcademicApi>;
  let lockListenerStub: {
    lockedNotice: ReturnType<typeof signal<InAppNotificationDto | null>>;
    start: jasmine.Spy;
    stop: jasmine.Spy;
    acknowledge: jasmine.Spy;
  };
  let store: GradingStore;

  const alice: GradeRosterStudent = {
    enrollmentId: 'e-alice',
    studentId: 's-alice',
    name: 'Alice',
  };
  const assessments: AssessmentColumn[] = [
    { assessmentId: 'midterm', examName: 'Midterm Exam', name: 'Midterm', weight: 0.4 },
    { assessmentId: 'final', examName: 'Final Exam', name: 'Final', weight: 0.6 },
  ];

  function gradeDto(overrides: Partial<GradeDto> = {}): GradeDto {
    return {
      id: 'g-1',
      enrollmentId: 'e-alice',
      calculatedScore: 82,
      letterGrade: 'A+',
      scores: [{ assessmentId: 'midterm', score: 70 }],
      submittedAt: 't',
      ...overrides,
    };
  }

  function resultDto(overrides: Partial<ResultPublicationDto> = {}): ResultPublicationDto {
    return {
      id: 'rp-1',
      courseOfferingId: 'off-1',
      status: 'Verified',
      calculatedAt: 't',
      rejectedAt: null,
      rejectionReason: null,
      lockedAt: 't',
      approvedAt: null,
      publishedAt: null,
      archivedAt: null,
      correctionCount: 0,
      ...overrides,
    };
  }

  beforeEach(() => {
    academicApiSpy = jasmine.createSpyObj('AcademicApi', [
      'submitGrade',
      'correctGrade',
      'lockResultBatch',
      'rejectResultBatch',
      'approveResultBatch',
      'publishResultBatch',
      'archiveResultBatch',
    ]);
    lockListenerStub = {
      lockedNotice: signal<InAppNotificationDto | null>(null),
      start: jasmine.createSpy('start'),
      stop: jasmine.createSpy('stop'),
      acknowledge: jasmine.createSpy('acknowledge'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AcademicApi, useValue: academicApiSpy },
        { provide: GradeLockListenerService, useValue: lockListenerStub },
      ],
    });
    store = TestBed.inject(GradingStore);
  });

  it('openCourseOffering resets state and starts the lock listener', () => {
    store.openCourseOffering('off-1', assessments);
    expect(store.status()).toBe('Draft');
    expect(store.rows()).toEqual([]);
    expect(lockListenerStub.start).toHaveBeenCalled();
  });

  it('loadRoster inserts rows with every assessment column present', () => {
    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice]);
    expect(store.rows().length).toBe(1);
    expect(Object.keys(store.rows()[0].cells)).toEqual(['midterm', 'final']);
  });

  it('updateCell records a valid entry and rejects an above-maximum one', () => {
    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice]);

    store.updateCell('e-alice', 'midterm', '70');
    expect(store.rows()[0].cells['midterm'].value).toBe(70);

    store.updateCell('e-alice', 'final', '150');
    expect(store.rows()[0].cells['final'].value).toBeNull();
    expect(store.rows()[0].cells['final'].error).toBe('grading.error.aboveMaximum');
  });

  it('updateCell is a no-op once marks are no longer editable', () => {
    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice]);
    academicApiSpy.lockResultBatch.and.returnValue(of(resultDto({ status: 'Verified' })));
    store.updateCell('e-alice', 'midterm', '70');
    store.lock();

    store.updateCell('e-alice', 'final', '90');
    expect(store.rows()[0].cells['final'].value).toBeNull();
  });

  it('submitRow submits only cells with an entered value and applies the response', () => {
    academicApiSpy.submitGrade.and.returnValue(of(gradeDto()));
    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice]);
    store.updateCell('e-alice', 'midterm', '70');

    store.submitRow('e-alice');

    expect(academicApiSpy.submitGrade).toHaveBeenCalledWith({
      enrollmentId: 'e-alice',
      scores: [{ assessmentId: 'midterm', score: 70 }],
    });
    expect(store.status()).toBe('Calculated');
    expect(store.rows()[0].gradeId).toBe('g-1');
  });

  it('submitRow does nothing when the row has a client-side validation error', () => {
    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice]);
    store.updateCell('e-alice', 'midterm', '999');

    store.submitRow('e-alice');

    expect(academicApiSpy.submitGrade).not.toHaveBeenCalled();
  });

  it('submitRow surfaces a server rejection (e.g. grade.already_locked) via a generic submitError key', () => {
    academicApiSpy.submitGrade.and.returnValue(
      throwError(() => ({ code: 'grade.already_locked' })),
    );
    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice]);
    store.updateCell('e-alice', 'midterm', '70');

    store.submitRow('e-alice');

    expect(store.rows()[0].submitError).toBe('grading.error.submitFailed');
  });

  it('submitAllDirty submits every dirty, error-free row and leaves invalid ones untouched', () => {
    academicApiSpy.submitGrade.and.returnValue(of(gradeDto()));
    const bob: GradeRosterStudent = { enrollmentId: 'e-bob', studentId: 's-bob', name: 'Bob' };
    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice, bob]);
    store.updateCell('e-alice', 'midterm', '70');
    store.updateCell('e-bob', 'midterm', '999'); // invalid, never recorded

    store.submitAllDirty();

    expect(academicApiSpy.submitGrade).toHaveBeenCalledTimes(1);
    expect(academicApiSpy.submitGrade).toHaveBeenCalledWith(
      jasmine.objectContaining({ enrollmentId: 'e-alice' }),
    );
  });

  it('lock/approve/publish/archive each call the matching API and adopt the authoritative status', () => {
    store.openCourseOffering('off-1', assessments);

    academicApiSpy.lockResultBatch.and.returnValue(of(resultDto({ status: 'Verified' })));
    store.lock();
    expect(store.status()).toBe('Verified');

    academicApiSpy.approveResultBatch.and.returnValue(of(resultDto({ status: 'Approved' })));
    store.approve();
    expect(store.status()).toBe('Approved');

    academicApiSpy.publishResultBatch.and.returnValue(of(resultDto({ status: 'Published' })));
    store.publish();
    expect(store.status()).toBe('Published');

    academicApiSpy.archiveResultBatch.and.returnValue(of(resultDto({ status: 'Archived' })));
    store.archive();
    expect(store.status()).toBe('Archived');
  });

  it('reject calls the API with a reason and returns the batch to Calculated', () => {
    academicApiSpy.rejectResultBatch.and.returnValue(of(resultDto({ status: 'Calculated' })));
    store.openCourseOffering('off-1', assessments);
    store.reject('needs redo');
    expect(academicApiSpy.rejectResultBatch).toHaveBeenCalledWith('off-1', {
      reason: 'needs redo',
    });
    expect(store.status()).toBe('Calculated');
  });

  it('a transition failure is surfaced via lastActionError without changing status', () => {
    academicApiSpy.lockResultBatch.and.returnValue(
      throwError(() => ({ code: 'resultpublication.invalid_transition' })),
    );
    store.openCourseOffering('off-1', assessments);
    store.lock();
    expect(store.status()).toBe('Draft');
    expect(store.lastActionError()).toBe('grading.error.transitionFailed');
  });

  it('stageCorrection only applies to a Published batch with a known gradeId, retaining the previous value', () => {
    academicApiSpy.submitGrade.and.returnValue(
      of(gradeDto({ scores: [{ assessmentId: 'midterm', score: 60 }] })),
    );
    academicApiSpy.lockResultBatch.and.returnValue(of(resultDto({ status: 'Verified' })));
    academicApiSpy.approveResultBatch.and.returnValue(of(resultDto({ status: 'Approved' })));
    academicApiSpy.publishResultBatch.and.returnValue(of(resultDto({ status: 'Published' })));

    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice]);
    store.updateCell('e-alice', 'midterm', '60');
    store.submitRow('e-alice');
    store.lock();
    store.approve();
    store.publish();

    store.stageCorrection('e-alice', { midterm: 75 }, 'transcription error');

    const pending = store.pendingCorrection();
    expect(pending?.previousScores['midterm']).toBe(60);
    expect(pending?.proposedScores['midterm']).toBe(75);
  });

  it('stageCorrection is a no-op unless the batch is Published', () => {
    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice]);
    store.stageCorrection('e-alice', { midterm: 75 }, 'reason');
    expect(store.pendingCorrection()).toBeNull();
  });

  it('confirmCorrection calls correctGrade and re-enters at Verified', () => {
    academicApiSpy.submitGrade.and.returnValue(
      of(gradeDto({ scores: [{ assessmentId: 'midterm', score: 60 }] })),
    );
    academicApiSpy.lockResultBatch.and.returnValue(of(resultDto({ status: 'Verified' })));
    academicApiSpy.approveResultBatch.and.returnValue(of(resultDto({ status: 'Approved' })));
    academicApiSpy.publishResultBatch.and.returnValue(of(resultDto({ status: 'Published' })));
    academicApiSpy.correctGrade.and.returnValue(
      of(gradeDto({ scores: [{ assessmentId: 'midterm', score: 75 }], calculatedScore: 75 })),
    );

    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice]);
    store.updateCell('e-alice', 'midterm', '60');
    store.submitRow('e-alice');
    store.lock();
    store.approve();
    store.publish();
    store.stageCorrection('e-alice', { midterm: 75 }, 'fix');

    store.confirmCorrection();

    expect(academicApiSpy.correctGrade).toHaveBeenCalledWith('g-1', {
      scores: [{ assessmentId: 'midterm', score: 75 }],
      reason: 'fix',
    });
    expect(store.status()).toBe('Verified');
    expect(store.pendingCorrection()).toBeNull();
  });

  it('assessmentDiscrepancy is null until a submission snapshot exists', () => {
    store.openCourseOffering('off-1', assessments);
    expect(store.assessmentDiscrepancy()).toBeNull();
  });

  it('assessmentDiscrepancy flags a weight change after a grade was submitted (FWEB-21)', () => {
    academicApiSpy.submitGrade.and.returnValue(of(gradeDto()));
    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice]);
    store.updateCell('e-alice', 'midterm', '70');
    store.submitRow('e-alice');
    expect(store.assessmentDiscrepancy()).toBeNull();

    // Department Head's review screen refreshes the CourseOffering's current Assessment config --
    // simulate its weight having changed since the submission above.
    store.refreshAssessments([{ ...assessments[0], weight: 0.5 }, assessments[1]]);

    const discrepancy = store.assessmentDiscrepancy();
    expect(discrepancy?.changedWeights).toEqual([
      { assessmentId: 'midterm', name: 'Midterm', previousWeight: 0.4, currentWeight: 0.5 },
    ]);
    expect(discrepancy?.removedAssessmentIds).toEqual([]);
  });

  it('assessmentDiscrepancy flags a removed Assessment after a grade was submitted', () => {
    academicApiSpy.submitGrade.and.returnValue(of(gradeDto()));
    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice]);
    store.updateCell('e-alice', 'midterm', '70');
    store.submitRow('e-alice');

    store.refreshAssessments([assessments[1]]);

    expect(store.assessmentDiscrepancy()?.removedAssessmentIds).toEqual(['midterm']);
  });

  it('an externally-triggered lock notice freezes editing and surfaces a notice (edge-cases.md)', () => {
    store.openCourseOffering('off-1', assessments);
    store.loadRoster([alice]);
    store.updateCell('e-alice', 'midterm', '70');
    expect(store.canEditMarks()).toBe(true);

    lockListenerStub.lockedNotice.set({
      id: 'n-1',
      category: 'GradeLocked',
      title: 'Locked',
      body: 'Locked by a Department Head',
      isRead: false,
      createdAt: 't',
    });
    TestBed.flushEffects();

    expect(store.canEditMarks()).toBe(false);
    expect(store.status()).toBe('Verified');
    expect(store.lockedElsewhereNotice()?.title).toBe('Locked');
    // The not-yet-submitted local value must still be visible, never silently cleared.
    expect(store.rows()[0].cells['midterm'].value).toBe(70);

    store.acknowledgeLockedElsewhere();
    expect(store.lockedElsewhereNotice()).toBeNull();
    expect(lockListenerStub.acknowledge).toHaveBeenCalled();
  });

  it('a lock notice arriving after the batch is already non-editable only surfaces the notice, without altering status', () => {
    academicApiSpy.lockResultBatch.and.returnValue(of(resultDto({ status: 'Verified' })));
    store.openCourseOffering('off-1', assessments);
    store.lock();

    lockListenerStub.lockedNotice.set({
      id: 'n-2',
      category: 'GradeLocked',
      title: 'Locked',
      body: 'body',
      isRead: false,
      createdAt: 't',
    });
    TestBed.flushEffects();

    expect(store.status()).toBe('Verified');
    expect(store.lockedElsewhereNotice()).not.toBeNull();
  });

  it('workflow transitions are no-ops before a CourseOffering is open', () => {
    store.lock();
    expect(academicApiSpy.lockResultBatch).not.toHaveBeenCalled();
  });
});
