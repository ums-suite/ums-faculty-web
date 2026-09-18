import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { UmsButtonComponent } from '@ums/design-system';
import { AttendanceStatsComponent } from './attendance-stats.component';

describe('AttendanceStatsComponent', () => {
  let fixture: ComponentFixture<AttendanceStatsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AttendanceStatsComponent] });
    fixture = TestBed.createComponent(AttendanceStatsComponent);
    fixture.componentRef.setInput('stats', [
      {
        enrollmentId: 'e-1',
        presentCount: 5,
        absentCount: 1,
        lateCount: 0,
        excusedCount: 0,
        totalSessions: 6,
        attendancePercent: 83,
      },
    ]);
    fixture.componentRef.setInput('roster', [
      {
        enrollmentId: 'e-1',
        studentId: 's-1',
        name: 'Alice',
        mark: { status: 'Present', explicitlySet: true, syncState: 'synced' },
      },
    ]);
    fixture.detectChanges();
  });

  it('renders an "as of" timestamp', () => {
    expect(fixture.nativeElement.textContent).toContain('As of');
  });

  it('resolves student names from the roster for the table rows', () => {
    const instance = fixture.componentInstance as unknown as {
      tableRows: () => readonly { name: string }[];
    };
    expect(instance.tableRows()[0].name).toBe('Alice');
  });

  it('triggers a CSV download when exportCsv is invoked', () => {
    const clickSpy = jasmine.createSpy('click');
    const fakeAnchor = { href: '', download: '', click: clickSpy };
    spyOn(document, 'createElement').and.returnValue(fakeAnchor as unknown as HTMLAnchorElement);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:mock');
    spyOn(URL, 'revokeObjectURL');

    (fixture.componentInstance as unknown as { exportCsv: () => void }).exportCsv();

    expect(clickSpy).toHaveBeenCalled();
  });

  it('disables the PDF export button (confirmed backend gap)', () => {
    const buttons = fixture.debugElement.queryAll(By.directive(UmsButtonComponent));
    const pdfButton = buttons[1].componentInstance as UmsButtonComponent;
    expect(pdfButton.disabled()).toBe(true);
  });
});
