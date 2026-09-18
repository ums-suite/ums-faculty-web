import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  UmsBadgeComponent,
  UmsBarChartComponent,
  UmsButtonComponent,
  UmsConfirmationDialogComponent,
  UmsEmptyStateComponent,
} from '@ums/design-system';
import { AcademicApi } from '../../core/api/academic.api';
import type { CourseOfferingDto } from '../../core/api/academic.types';
import { GlobalStore } from '../../core/state/global.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { GradeCorrectionDialogComponent } from './grade-correction-dialog.component';
import { GradeEntryTableComponent } from './grade-entry-table.component';
import { GradingStore } from './grading.store';
import type { AssessmentColumn } from './grading.types';

type WorkflowAction = 'submit' | 'lock' | 'reject' | 'approve' | 'publish' | 'archive';

/**
 * Grading page (FWEB-17 through FWEB-21): the dense mark-entry spreadsheet, the persistent
 * workflow-state banner, the distinctly separated/confirmed submit-and-lock actions, FWEB-20's
 * live distribution preview, FWEB-21's assessment-discrepancy flag, and FWEB-19's correction flow.
 *
 * **Roster loading is the same confirmed, flagged backend gap Attendance documents** -- there is
 * no `ums-core` endpoint listing a CourseOffering's enrolled students, so this page cannot itself
 * populate a real roster; it calls `AcademicApi.getCourseOffering` for assessment/instructor
 * context and renders an honest "roster unavailable" state otherwise, exactly mirroring
 * `AttendanceComponent`'s own precedent.
 */
@Component({
  selector: 'app-grading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsBarChartComponent,
    UmsButtonComponent,
    UmsConfirmationDialogComponent,
    UmsEmptyStateComponent,
    GradeCorrectionDialogComponent,
    GradeEntryTableComponent,
    TranslatePipe,
  ],
  templateUrl: './grading.component.html',
  styleUrl: './grading.component.scss',
})
export class GradingComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly academicApi = inject(AcademicApi);
  private readonly globalStore = inject(GlobalStore);
  private readonly translation = inject(TranslationService);
  protected readonly store = inject(GradingStore);

  protected readonly courseOffering = signal<CourseOfferingDto | null>(null);
  protected readonly correctionRowId = signal<string | null>(null);
  protected readonly confirmingAction = signal<WorkflowAction | null>(null);

  protected readonly isDepartmentHead = computed(() => this.globalStore.isDepartmentHead());
  protected readonly correctionRow = computed(() => {
    const id = this.correctionRowId();
    return id ? (this.store.rows().find((r) => r.enrollmentId === id) ?? null) : null;
  });

  protected readonly distributionCategories = computed(() =>
    this.store.classDistribution().bands.map((b) => b.letter),
  );
  protected readonly distributionSeries = computed(() => [
    {
      name: this.translation.t('grading.distribution.students'),
      data: this.store.classDistribution().bands.map((b) => b.count),
    },
  ]);

  ngOnInit(): void {
    const courseOfferingId = this.route.snapshot.queryParamMap.get('courseOfferingId');
    if (!courseOfferingId) {
      return;
    }

    this.academicApi.getCourseOffering(courseOfferingId).subscribe((offering) => {
      this.courseOffering.set(offering);
      const assessments: AssessmentColumn[] = offering.exams.flatMap((exam) =>
        exam.assessments.map((a) => ({
          assessmentId: a.id,
          examName: exam.name,
          name: a.name,
          weight: a.weight,
        })),
      );
      const isSelfReview =
        this.isDepartmentHead() &&
        offering.instructorFacultyMemberId === this.globalStore.facultyMemberId();
      this.store.openCourseOffering(courseOfferingId, assessments, isSelfReview);
    });
  }

  ngOnDestroy(): void {
    this.store.closeCourseOffering();
  }

  protected onCellChange(event: {
    enrollmentId: string;
    assessmentId: string;
    rawValue: string;
  }): void {
    this.store.updateCell(event.enrollmentId, event.assessmentId, event.rawValue);
  }

  protected onSubmitRow(enrollmentId: string): void {
    this.store.submitRow(enrollmentId);
  }

  protected onOpenCorrection(enrollmentId: string): void {
    this.correctionRowId.set(enrollmentId);
  }

  protected onCloseCorrection(): void {
    this.correctionRowId.set(null);
  }

  protected startConfirm(action: WorkflowAction): void {
    this.confirmingAction.set(action);
  }

  protected onConfirmed(note: string): void {
    const action = this.confirmingAction();
    this.confirmingAction.set(null);
    switch (action) {
      case 'submit':
        this.store.submitAllDirty();
        break;
      case 'lock':
        this.store.lock();
        break;
      case 'reject':
        this.store.reject(note);
        break;
      case 'approve':
        this.store.approve();
        break;
      case 'publish':
        this.store.publish();
        break;
      case 'archive':
        this.store.archive();
        break;
    }
  }

  protected onCancelConfirm(): void {
    this.confirmingAction.set(null);
  }

  protected confirmTitleKey(action: WorkflowAction | null): string {
    return action ? `grading.confirm.${action}.title` : '';
  }

  protected confirmDescriptionKey(action: WorkflowAction | null): string {
    return action ? `grading.confirm.${action}.description` : '';
  }
}
