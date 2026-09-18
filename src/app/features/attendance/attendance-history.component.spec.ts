import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { UmsModalComponent } from '@ums/design-system';
import { AttendanceHistoryComponent } from './attendance-history.component';

describe('AttendanceHistoryComponent', () => {
  let fixture: ComponentFixture<AttendanceHistoryComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AttendanceHistoryComponent] });
    fixture = TestBed.createComponent(AttendanceHistoryComponent);
    fixture.componentRef.setInput('studentName', 'Alice');
    fixture.componentRef.setInput('open', true);
  });

  it('shows the empty state with no entries', () => {
    fixture.componentRef.setInput('entries', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No recorded sessions yet.');
  });

  it('lists each session with its status badge', () => {
    fixture.componentRef.setInput('entries', [
      { sessionDate: '2026-09-01', status: 'Present' },
      { sessionDate: '2026-09-08', status: 'Absent' },
    ]);
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('.attendance-history__entry');
    expect(items.length).toBe(2);
  });

  it('emits closed when the modal requests dismissal', () => {
    fixture.componentRef.setInput('entries', []);
    fixture.detectChanges();
    let emittedCount = 0;
    fixture.componentInstance.closed.subscribe(() => (emittedCount += 1));

    const modal = fixture.debugElement.query(By.directive(UmsModalComponent))
      .componentInstance as UmsModalComponent;
    modal.closed.emit();

    expect(emittedCount).toBe(1);
  });
});
