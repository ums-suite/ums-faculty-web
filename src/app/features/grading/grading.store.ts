import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { AcademicApi } from '../../core/api/academic.api';
import type {
  AssessmentScoreDto,
  GradeDto,
  ResultPublicationDto,
} from '../../core/api/academic.types';
import {
  computeClassDistribution,
  computeRowGrade,
  type ClassDistribution,
} from './grade-calculation';
import { GradeLockListenerService } from './grade-lock-listener.service';
import {
  badgeVariant,
  bannerLabelKey,
  canApprove,
  canArchive,
  canEditMarks,
  canLock,
  canPublish,
  canReject,
  canRequestCorrection,
  type StatusBadgeVariant,
} from './grade-lock-state';
import {
  applyCellInput,
  applyGradeSubmitted,
  applyRosterRefresh,
  applySubmitFailed,
  markRowSaving,
  rowHasErrors,
  rowIsDirty,
} from './grading-reconciliation';
import {
  EMPTY_GRADING_STATE,
  type AssessmentColumn,
  type GradeEntryRow,
  type GradeRosterStudent,
  type GradeWorkflowStatus,
  type GradingState,
  type PendingCorrection,
} from './grading.types';

export interface AssessmentDiscrepancy {
  readonly changedWeights: readonly {
    readonly assessmentId: string;
    readonly name: string;
    readonly previousWeight: number;
    readonly currentWeight: number;
  }[];
  readonly removedAssessmentIds: readonly string[];
}

/**
 * The Grading feature store (FWEB-17 through FWEB-21) -- this pass's second highest-scrutiny
 * area alongside Attendance (requirement-spec.md §4's ≥90%-coverage bar names this store's own
 * mark-validation/lock-state logic explicitly). Orchestrates the pure `grade-calculation.ts`/
 * `grade-lock-state.ts`/`grading-reconciliation.ts` modules against real side effects
 * (`AcademicApi`'s submit/lock/reject/approve/publish/archive/correct calls,
 * `GradeLockListenerService`'s poll) without embedding any of that logic itself.
 *
 * **Roster loading is the same confirmed, flagged backend gap as Attendance's**: there is no
 * `ums-core` endpoint listing a CourseOffering's enrolled students, so {@link loadRoster} accepts
 * entries directly from its caller (`GradingComponent`) rather than fetching them -- identical
 * seam shape to `AttendanceStore.loadRoster`.
 *
 * **A previously-submitted Grade/ResultPublication status can only ever be known from a response
 * THIS store has itself observed** (`academic.types.ts`'s `GradeDto`/`ResultPublicationDto` doc
 * comments carry the confirmed gap: no `GET` exists for either). {@link status} therefore starts
 * `'Draft'` and only ever changes from a real submit/lock/reject/approve/publish/archive response
 * (or FWEB-18's `GradeLockListenerService` notice) -- it is an honest "last known from an action
 * taken this session" value, never a fabricated read of server truth this app cannot actually
 * obtain.
 */
@Injectable({ providedIn: 'root' })
export class GradingStore {
  private readonly academicApi = inject(AcademicApi);
  private readonly lockListener = inject(GradeLockListenerService);

  private readonly courseOfferingIdState = signal<string | null>(null);
  private readonly assessmentsState = signal<readonly AssessmentColumn[]>([]);
  private readonly stateState = signal<GradingState>(EMPTY_GRADING_STATE);
  private readonly statusState = signal<GradeWorkflowStatus>('Draft');
  private readonly lastActionErrorState = signal<string | null>(null);
  private readonly submissionAssessmentSnapshotState = signal<Readonly<
    Record<string, { readonly name: string; readonly weight: number }>
  > | null>(null);
  private readonly pendingCorrectionState = signal<PendingCorrection | null>(null);
  private readonly lockedElsewhereNoticeState = signal<{
    readonly title: string;
    readonly body: string;
  } | null>(null);
  private readonly frozenState = signal(false);
  private readonly isSelfReviewState = signal(false);

  readonly courseOfferingId = this.courseOfferingIdState.asReadonly();
  readonly assessments = this.assessmentsState.asReadonly();
  readonly rows = computed<readonly GradeEntryRow[]>(() => {
    const state = this.stateState();
    return state.knownEnrollmentIds.map((id) => state.rows[id]);
  });
  readonly status = this.statusState.asReadonly();
  readonly lastActionError = this.lastActionErrorState.asReadonly();
  readonly pendingCorrection = this.pendingCorrectionState.asReadonly();
  readonly lockedElsewhereNotice = this.lockedElsewhereNoticeState.asReadonly();
  readonly isSelfReview = this.isSelfReviewState.asReadonly();

  readonly statusBannerKey = computed<string>(() => bannerLabelKey(this.statusState()));
  readonly statusBadgeVariant = computed<StatusBadgeVariant>(() =>
    badgeVariant(this.statusState()),
  );

  /** invariant §8.2's live gate -- also `false` once a mid-typing external lock has frozen this session (edge-cases.md). */
  readonly canEditMarks = computed(() => canEditMarks(this.statusState()) && !this.frozenState());
  readonly canLock = computed(() => canLock(this.statusState()));
  readonly canReject = computed(() => canReject(this.statusState()));
  readonly canApprove = computed(() => canApprove(this.statusState()));
  readonly canPublish = computed(() => canPublish(this.statusState()));
  readonly canArchive = computed(() => canArchive(this.statusState()));
  readonly canRequestCorrection = computed(() => canRequestCorrection(this.statusState()));

  private readonly weightsByAssessmentId = computed(
    () => new Map(this.assessmentsState().map((a) => [a.assessmentId, a.weight])),
  );

  /** FWEB-17's always-visible running total/computed-grade column -- server value once known, else a live client-side preview (FWEB-20). */
  readonly rowPreview = computed(() => {
    const weights = this.weightsByAssessmentId();
    const previews = new Map<
      string,
      { readonly percentage: number; readonly letterGrade: string } | null
    >();
    for (const row of this.rows()) {
      if (row.calculatedScore !== null && row.letterGrade !== null) {
        previews.set(row.enrollmentId, {
          percentage: row.calculatedScore,
          letterGrade: row.letterGrade,
        });
        continue;
      }
      const entered = new Map<string, number>();
      for (const [assessmentId, cell] of Object.entries(row.cells)) {
        if (cell.value !== null) {
          entered.set(assessmentId, cell.value);
        }
      }
      previews.set(row.enrollmentId, computeRowGrade(entered, weights));
    }
    return previews;
  });

  /** FWEB-20's live class-average/grade-distribution preview. */
  readonly classDistribution = computed<ClassDistribution>(() => {
    const previews = this.rowPreview();
    const percentages: number[] = [];
    for (const preview of previews.values()) {
      if (preview) {
        percentages.push(preview.percentage);
      }
    }
    return computeClassDistribution(percentages);
  });

  readonly hasUnsavedChanges = computed(() => this.rows().some(rowIsDirty));

  /** FWEB-21: an explicit, never-silent flag when an Assessment's configured weight (or its very existence) has changed since grades were last submitted for this batch. */
  readonly assessmentDiscrepancy = computed<AssessmentDiscrepancy | null>(() => {
    const snapshot = this.submissionAssessmentSnapshotState();
    if (!snapshot) {
      return null;
    }
    const current = this.assessmentsState();
    const currentIds = new Set(current.map((a) => a.assessmentId));
    const changedWeights = current
      .filter((a) => snapshot[a.assessmentId] && snapshot[a.assessmentId].weight !== a.weight)
      .map((a) => ({
        assessmentId: a.assessmentId,
        name: a.name,
        previousWeight: snapshot[a.assessmentId].weight,
        currentWeight: a.weight,
      }));
    const removedAssessmentIds = Object.keys(snapshot).filter((id) => !currentIds.has(id));

    return changedWeights.length === 0 && removedAssessmentIds.length === 0
      ? null
      : { changedWeights, removedAssessmentIds };
  });

  constructor() {
    effect(() => {
      const notice = this.lockListener.lockedNotice();
      if (notice) {
        this.handleLockedElsewhere(notice.title, notice.body);
      }
    });
  }

  /** Opens a Grading session for one CourseOffering, resetting all local state (FWEB-17). `isSelfReview` names edge-cases.md's "Department Head reviewing their own course" case -- never used to skip the explicit review action, only to surface a notice. */
  openCourseOffering(
    courseOfferingId: string,
    assessments: readonly AssessmentColumn[],
    isSelfReview = false,
  ): void {
    this.courseOfferingIdState.set(courseOfferingId);
    this.assessmentsState.set(assessments);
    this.stateState.set(EMPTY_GRADING_STATE);
    this.statusState.set('Draft');
    this.lastActionErrorState.set(null);
    this.submissionAssessmentSnapshotState.set(null);
    this.pendingCorrectionState.set(null);
    this.lockedElsewhereNoticeState.set(null);
    this.frozenState.set(false);
    this.isSelfReviewState.set(isSelfReview);
    this.lockListener.start();
  }

  closeCourseOffering(): void {
    this.lockListener.stop();
  }

  /**
   * Re-fetches just the current Assessment configuration for the already-open CourseOffering,
   * WITHOUT resetting roster/submission state -- FWEB-21's Department-Head review-screen refresh
   * action, so a weight/removal discrepancy against the last-submission snapshot can be detected
   * (edge-cases.md "Grade submitted, then the assessment's maximum marks configuration changes
   * before Department Head review"). Distinct from {@link openCourseOffering}, which is a full
   * reset -- honesty note carried on the class doc still applies: the submission snapshot this
   * compares against is only ever known from an action taken THIS browser session.
   */
  refreshAssessments(assessments: readonly AssessmentColumn[]): void {
    this.assessmentsState.set(assessments);
  }

  /** See class doc -- accepts roster entries directly rather than fetching them (confirmed backend gap). */
  loadRoster(entries: readonly GradeRosterStudent[]): void {
    const assessmentIds = this.assessmentsState().map((a) => a.assessmentId);
    this.stateState.update((s) => applyRosterRefresh(s, entries, assessmentIds));
  }

  /** One cell's raw typed input (invariant §8.4) -- silently ignored once marks are no longer editable, never applied to a "successfully" edited but unsendable value. */
  updateCell(enrollmentId: string, assessmentId: string, rawValue: string): void {
    if (!this.canEditMarks()) {
      return;
    }
    const { state } = applyCellInput(this.stateState(), enrollmentId, assessmentId, rawValue);
    this.stateState.set(state);
  }

  /** Submits one row's currently-entered, currently-valid scores. */
  submitRow(enrollmentId: string): void {
    if (!this.canEditMarks()) {
      return;
    }
    const row = this.stateState().rows[enrollmentId];
    if (!row || rowHasErrors(row)) {
      return;
    }
    const scores: AssessmentScoreDto[] = Object.entries(row.cells)
      .filter(([, cell]) => cell.value !== null)
      .map(([assessmentId, cell]) => ({ assessmentId, score: cell.value as number }));
    if (scores.length === 0) {
      return;
    }

    this.stateState.update((s) => markRowSaving(s, enrollmentId, true));
    this.academicApi.submitGrade({ enrollmentId, scores }).subscribe({
      next: (dto: GradeDto) => {
        this.stateState.update((s) => applyGradeSubmitted(s, enrollmentId, dto));
        if (this.statusState() === 'Draft') {
          this.statusState.set('Calculated');
        }
        this.recordSubmissionSnapshot();
      },
      error: () => {
        this.stateState.update((s) =>
          applySubmitFailed(s, enrollmentId, 'grading.error.submitFailed'),
        );
      },
    });
  }

  /** FWEB-18's "distinctly separated, confirmed" submit action -- the component gates the call to this on its own confirmation dialog; this method itself submits every currently-dirty, currently-valid row. */
  submitAllDirty(): void {
    for (const row of this.rows()) {
      if (rowIsDirty(row) && !rowHasErrors(row)) {
        this.submitRow(row.enrollmentId);
      }
    }
  }

  /** Department-Head review-lock (`Calculated` -> `Verified`) -- the component gates this on its own confirmation dialog (§5). */
  lock(): void {
    this.runTransition((id) => this.academicApi.lockResultBatch(id));
  }

  reject(reason: string): void {
    this.runTransition((id) => this.academicApi.rejectResultBatch(id, { reason }));
  }

  approve(): void {
    this.runTransition((id) => this.academicApi.approveResultBatch(id));
  }

  publish(): void {
    this.runTransition((id) => this.academicApi.publishResultBatch(id));
  }

  archive(): void {
    this.runTransition((id) => this.academicApi.archiveResultBatch(id));
  }

  /** FWEB-19: stages a correction for review before it's ever sent -- the prior value stays visible alongside the proposed one (never a silent in-place change). No-op unless the batch is genuinely `Published` and this row's Grade is actually known to this client. */
  stageCorrection(
    enrollmentId: string,
    proposedScores: Readonly<Record<string, number>>,
    reason: string,
  ): void {
    if (!this.canRequestCorrection()) {
      return;
    }
    const row = this.stateState().rows[enrollmentId];
    if (!row?.gradeId) {
      return;
    }
    const previousScores: Record<string, number> = {};
    for (const [assessmentId, cell] of Object.entries(row.cells)) {
      previousScores[assessmentId] = cell.savedValue ?? 0;
    }
    this.pendingCorrectionState.set({
      enrollmentId,
      gradeId: row.gradeId,
      previousScores,
      proposedScores,
      reason,
    });
  }

  cancelCorrection(): void {
    this.pendingCorrectionState.set(null);
  }

  confirmCorrection(): void {
    const pending = this.pendingCorrectionState();
    if (!pending) {
      return;
    }
    const scores: AssessmentScoreDto[] = Object.entries(pending.proposedScores).map(
      ([assessmentId, score]) => ({
        assessmentId,
        score,
      }),
    );
    this.academicApi.correctGrade(pending.gradeId, { scores, reason: pending.reason }).subscribe({
      next: (dto) => {
        this.stateState.update((s) => applyGradeSubmitted(s, pending.enrollmentId, dto));
        this.pendingCorrectionState.set(null);
        // A correction re-enters at Verified server-side (GradeCorrectionService) -- reflect that
        // authoritatively even though this particular call's own response is a GradeDto, not a
        // ResultPublicationDto (confirmed gap, see academic.types.ts's GradeDto doc).
        this.statusState.set('Verified');
      },
      error: () => this.lastActionErrorState.set('grading.error.correctionFailed'),
    });
  }

  acknowledgeLockedElsewhere(): void {
    this.lockedElsewhereNoticeState.set(null);
    this.lockListener.acknowledge();
  }

  private handleLockedElsewhere(title: string, body: string): void {
    this.lockedElsewhereNoticeState.set({ title, body });
    if (canEditMarks(this.statusState())) {
      // The batch was locked by someone else while this faculty member was still mid-typing
      // (edge-cases.md) -- freeze further edits immediately; any not-yet-submitted local values
      // stay visible (never cleared) but are no longer submittable.
      this.frozenState.set(true);
      this.statusState.set('Verified');
    }
  }

  private runTransition(
    call: (courseOfferingId: string) => Observable<ResultPublicationDto>,
  ): void {
    const courseOfferingId = this.courseOfferingIdState();
    if (!courseOfferingId) {
      return;
    }
    call(courseOfferingId).subscribe({
      next: (dto) => {
        this.statusState.set(dto.status as GradeWorkflowStatus);
        this.lastActionErrorState.set(null);
        this.frozenState.set(false);
      },
      error: () => this.lastActionErrorState.set('grading.error.transitionFailed'),
    });
  }

  private recordSubmissionSnapshot(): void {
    const snapshot: Record<string, { name: string; weight: number }> = {};
    for (const assessment of this.assessmentsState()) {
      snapshot[assessment.assessmentId] = { name: assessment.name, weight: assessment.weight };
    }
    this.submissionAssessmentSnapshotState.set(snapshot);
  }
}
