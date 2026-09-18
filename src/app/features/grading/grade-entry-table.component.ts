import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UmsBadgeComponent, UmsButtonComponent, UmsInputComponent } from '@ums/design-system';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { AssessmentColumn, GradeEntryRow } from './grading.types';

/**
 * The dense, spreadsheet-like mark-entry table (FWEB-17, §7 Grade entry key screen): student rows
 * x Assessment-component columns, inline numeric entry, an always-visible running
 * total/computed-grade column. Purely presentational -- `GradingComponent` owns all state via
 * `GradingStore`; this component only renders it and emits raw input events, so every
 * mark-validation decision lives in the one place (`grade-calculation.ts`) the ≥90%-coverage bar
 * targets.
 */
@Component({
  selector: 'app-grade-entry-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UmsBadgeComponent, UmsButtonComponent, UmsInputComponent, TranslatePipe],
  templateUrl: './grade-entry-table.component.html',
  styleUrl: './grade-entry-table.component.scss',
})
export class GradeEntryTableComponent {
  readonly assessments = input.required<readonly AssessmentColumn[]>();
  readonly rows = input.required<readonly GradeEntryRow[]>();
  readonly previews =
    input.required<
      ReadonlyMap<string, { readonly percentage: number; readonly letterGrade: string } | null>
    >();
  readonly editable = input<boolean>(true);

  readonly cellChange = output<{ enrollmentId: string; assessmentId: string; rawValue: string }>();
  readonly submitRow = output<string>();
  readonly requestCorrection = output<string>();
  readonly canRequestCorrection = input<boolean>(false);

  protected cellValue(row: GradeEntryRow, assessmentId: string): string {
    const cell = row.cells[assessmentId];
    return cell?.value === null || cell?.value === undefined ? '' : String(cell.value);
  }

  protected onCellInput(enrollmentId: string, assessmentId: string, rawValue: string): void {
    this.cellChange.emit({ enrollmentId, assessmentId, rawValue });
  }
}
