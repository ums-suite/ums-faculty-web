import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AttendanceRosterComponent } from './attendance-roster.component';
import type { AttendanceRosterRow } from './attendance.types';

function row(overrides: Partial<AttendanceRosterRow> = {}): AttendanceRosterRow {
  return {
    enrollmentId: 'e-1',
    studentId: 's-1',
    name: 'Alice',
    mark: { status: 'Unmarked', explicitlySet: false, syncState: 'synced' },
    ...overrides,
  };
}

describe('AttendanceRosterComponent', () => {
  let fixture: ComponentFixture<AttendanceRosterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AttendanceRosterComponent] });
    fixture = TestBed.createComponent(AttendanceRosterComponent);
  });

  it('shows the empty state when there are no rows', () => {
    fixture.componentRef.setInput('rows', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No students on this roster yet.');
  });

  it('renders one row per student with a "new student" badge for unmarked entries', () => {
    fixture.componentRef.setInput('rows', [row(), row({ enrollmentId: 'e-2', name: 'Bob' })]);
    fixture.detectChanges();
    const rowEls = fixture.nativeElement.querySelectorAll('.attendance-roster__row');
    expect(rowEls.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('New — not yet marked');
  });

  it('clicking a status button emits markChange with the right enrollmentId/status', () => {
    fixture.componentRef.setInput('rows', [row()]);
    fixture.detectChanges();
    const emitted: { enrollmentId: string; status: string }[] = [];
    fixture.componentInstance.markChange.subscribe((e) => emitted.push(e));

    const presentButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('[data-status="Present"]');
    presentButton.click();

    expect(emitted).toEqual([{ enrollmentId: 'e-1', status: 'Present' }]);
  });

  it('pressing P/A/L/E while a row has focus emits the matching status (real keyboard handling)', () => {
    fixture.componentRef.setInput('rows', [row()]);
    fixture.detectChanges();
    const emitted: { enrollmentId: string; status: string }[] = [];
    fixture.componentInstance.markChange.subscribe((e) => emitted.push(e));

    const rowEl: HTMLElement = fixture.nativeElement.querySelector('.attendance-roster__row');
    rowEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(emitted).toEqual([{ enrollmentId: 'e-1', status: 'Absent' }]);
  });

  it('is case-insensitive for the keyboard shortcut', () => {
    fixture.componentRef.setInput('rows', [row()]);
    fixture.detectChanges();
    const emitted: { enrollmentId: string; status: string }[] = [];
    fixture.componentInstance.markChange.subscribe((e) => emitted.push(e));

    const rowEl: HTMLElement = fixture.nativeElement.querySelector('.attendance-roster__row');
    rowEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'L' }));

    expect(emitted).toEqual([{ enrollmentId: 'e-1', status: 'Late' }]);
  });

  it('ArrowDown moves focus to the next row', () => {
    fixture.componentRef.setInput('rows', [row(), row({ enrollmentId: 'e-2', name: 'Bob' })]);
    fixture.detectChanges();

    const rowEls: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.attendance-roster__row'),
    );
    rowEls[0].focus();
    rowEls[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

    expect(document.activeElement).toBe(rowEls[1]);
  });

  it('ArrowUp moves focus to the previous row', () => {
    fixture.componentRef.setInput('rows', [row(), row({ enrollmentId: 'e-2', name: 'Bob' })]);
    fixture.detectChanges();

    const rowEls: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.attendance-roster__row'),
    );
    rowEls[1].focus();
    rowEls[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));

    expect(document.activeElement).toBe(rowEls[0]);
  });

  it('ArrowDown on the last row is a harmless no-op (no next sibling)', () => {
    fixture.componentRef.setInput('rows', [row()]);
    fixture.detectChanges();
    const rowEl: HTMLElement = fixture.nativeElement.querySelector('.attendance-roster__row');
    rowEl.focus();
    expect(() =>
      rowEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' })),
    ).not.toThrow();
  });

  it('ignores an unrelated keypress', () => {
    fixture.componentRef.setInput('rows', [row()]);
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.markChange.subscribe((e) => emitted.push(e));

    const rowEl: HTMLElement = fixture.nativeElement.querySelector('.attendance-roster__row');
    rowEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));

    expect(emitted).toEqual([]);
  });

  it('shows and clears the "updated from another device" notice', () => {
    fixture.componentRef.setInput('rows', [
      row({
        mark: {
          status: 'Absent',
          explicitlySet: true,
          syncState: 'synced',
          updatedFromAnotherDevice: true,
        },
      }),
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('was updated from another device');

    const emitted: string[] = [];
    fixture.componentInstance.acknowledgeUpdated.subscribe((id) => emitted.push(id));
    const noticeButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.attendance-roster__updated-notice',
    );
    noticeButton.click();
    expect(emitted).toEqual(['e-1']);
  });

  it('emits openHistory when the history icon button is clicked', () => {
    fixture.componentRef.setInput('rows', [row()]);
    fixture.detectChanges();
    const emitted: string[] = [];
    fixture.componentInstance.openHistory.subscribe((id) => emitted.push(id));

    const historyButton: HTMLButtonElement = fixture.nativeElement.querySelector('ums-icon-button');
    historyButton.click();

    expect(emitted).toEqual(['e-1']);
  });
});
