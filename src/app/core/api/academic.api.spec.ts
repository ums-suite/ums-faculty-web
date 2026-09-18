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
});
