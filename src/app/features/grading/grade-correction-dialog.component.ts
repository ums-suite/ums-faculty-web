import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  UmsBadgeComponent,
  UmsButtonComponent,
  UmsFormFieldComponent,
  UmsInputComponent,
  UmsModalComponent,
  UmsTextareaComponent,
} from '@ums/design-system';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { GradingStore } from './grading.store';
import type { AssessmentColumn, GradeEntryRow } from './grading.types';

/**
 * FWEB-19's post-lock "request correction" flow. There is genuinely NO raw edit control here --
 * invariant §8.2 -- this dialog only ever exists to STAGE a proposed correction (via
 * `GradingStore.stageCorrection`) and then, as a second, distinctly separate step, review the
 * prior-vs-proposed diff before actually confirming it (`GradingStore.confirmCorrection`), never a
 * silent in-place change (edge-cases.md "Correction requested on an already-Published result").
 */
@Component({
  selector: 'app-grade-correction-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsButtonComponent,
    UmsFormFieldComponent,
    UmsInputComponent,
    UmsModalComponent,
    UmsTextareaComponent,
    TranslatePipe,
  ],
  templateUrl: './grade-correction-dialog.component.html',
  styleUrl: './grade-correction-dialog.component.scss',
})
export class GradeCorrectionDialogComponent {
  protected readonly store = inject(GradingStore);

  readonly row = input<GradeEntryRow | null>(null);
  readonly assessments = input.required<readonly AssessmentColumn[]>();
  readonly closed = output();

  protected readonly draftScores = signal<Readonly<Record<string, string>>>({});
  protected readonly reason = signal('');

  protected readonly open = computed(() => this.row() !== null);
  protected readonly reviewing = computed(() => this.store.pendingCorrection() !== null);

  protected draftValue(assessmentId: string): string {
    const draft = this.draftScores();
    if (assessmentId in draft) {
      return draft[assessmentId];
    }
    const current = this.row()?.cells[assessmentId]?.savedValue;
    return current === null || current === undefined ? '' : String(current);
  }

  protected onDraftInput(assessmentId: string, rawValue: string): void {
    this.draftScores.update((d) => ({ ...d, [assessmentId]: rawValue }));
  }

  protected onReview(): void {
    const row = this.row();
    if (!row) {
      return;
    }
    const proposedScores: Record<string, number> = {};
    for (const assessment of this.assessments()) {
      const raw = this.draftValue(assessment.assessmentId).trim();
      const savedValue = row.cells[assessment.assessmentId]?.savedValue ?? 0;
      proposedScores[assessment.assessmentId] = raw === '' ? savedValue : Number(raw);
    }
    this.store.stageCorrection(row.enrollmentId, proposedScores, this.reason().trim());
  }

  protected onConfirm(): void {
    this.store.confirmCorrection();
    this.onClose();
  }

  protected onBackToEdit(): void {
    this.store.cancelCorrection();
  }

  protected onClose(): void {
    this.store.cancelCorrection();
    this.draftScores.set({});
    this.reason.set('');
    this.closed.emit();
  }
}
