import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG, DEFAULT_APP_CONFIG } from '../config/app-config';
import { AcademicApi } from './academic.api';

describe('AcademicApi', () => {
  let api: AcademicApi;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { ...DEFAULT_APP_CONFIG, apiBaseUrl: baseUrl } },
      ],
    });
    api = TestBed.inject(AcademicApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists course offerings filtered by semester query param', () => {
    api.listCourseOfferings('sem-1').subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/academic/course-offerings` &&
        r.params.get('semester') === 'sem-1',
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('fetches one course offering by id', () => {
    api.getCourseOffering('off-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/course-offerings/off-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('fetches one enrollment by id', () => {
    api.getEnrollment('enr-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/enrollments/enr-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('marks attendance via POST and returns the full session snapshot', () => {
    const request = {
      courseOfferingId: 'off-1',
      sessionDate: '2026-09-18',
      correctionWindowClose: null,
      enrollmentId: 'enr-1',
      status: 'Present' as const,
    };
    api.markAttendance(request).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/attendance`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({
      id: 'sess-1',
      courseOfferingId: 'off-1',
      sessionDate: '2026-09-18',
      correctionWindowClose: '2026-09-20T00:00:00Z',
      records: [],
    });
  });

  it('normalizes a failed markAttendance call into a UmsApiError', (done) => {
    api
      .markAttendance({
        courseOfferingId: 'off-1',
        sessionDate: '2026-09-18',
        correctionWindowClose: null,
        enrollmentId: 'enr-1',
        status: 'Present',
      })
      .subscribe({
        error: (err: { status: number }) => {
          expect(err.status).toBe(409);
          done();
        },
      });

    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/attendance`);
    req.flush(
      { title: 'Correction window closed', code: 'attendance.correction_window_closed' },
      { status: 409, statusText: 'Conflict' },
    );
  });

  it('submits a grade via POST /academic/grades', () => {
    const request = { enrollmentId: 'enr-1', scores: [{ assessmentId: 'a-1', score: 80 }] };
    api.submitGrade(request).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/grades`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({
      id: 'g-1',
      enrollmentId: 'enr-1',
      calculatedScore: 80,
      letterGrade: 'A',
      scores: [],
      submittedAt: 't',
    });
  });

  it('submits a correction via POST /academic/grades/{id}/correct', () => {
    const request = { scores: [{ assessmentId: 'a-1', score: 85 }], reason: 'typo fix' };
    api.correctGrade('g-1', request).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/grades/g-1/correct`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });

  it('locks a result batch via POST /academic/results/{id}/lock', () => {
    api.lockResultBatch('off-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/results/off-1/lock`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('rejects a result batch via POST /academic/results/{id}/reject', () => {
    api.rejectResultBatch('off-1', { reason: 'bad scores' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/results/off-1/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'bad scores' });
    req.flush({});
  });

  it('approves a result batch via POST /academic/results/{id}/approve', () => {
    api.approveResultBatch('off-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/results/off-1/approve`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('publishes a result batch via POST /academic/results/{id}/publish', () => {
    api.publishResultBatch('off-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/results/off-1/publish`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('archives a result batch via POST /academic/results/{id}/archive', () => {
    api.archiveResultBatch('off-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/academic/results/off-1/archive`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});
