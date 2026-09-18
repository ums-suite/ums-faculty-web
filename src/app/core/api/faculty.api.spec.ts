import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG, DEFAULT_APP_CONFIG } from '../config/app-config';
import { FacultyApi } from './faculty.api';

describe('FacultyApi', () => {
  let api: FacultyApi;
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
    api = TestBed.inject(FacultyApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetches a FacultyMember by id', () => {
    api.getFacultyMember('fac-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/faculty/members/fac-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('lists course assignments filtered by facultyMemberId query param', () => {
    api.listCourseAssignments('fac-1').subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/faculty/course-assignments` &&
        r.params.get('facultyMemberId') === 'fac-1',
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('lists faculty members with skip/take and an optional departmentId filter', () => {
    api.listFacultyMembers('dept-1', 0, 50).subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/faculty/members` &&
        r.params.get('departmentId') === 'dept-1' &&
        r.params.get('skip') === '0' &&
        r.params.get('take') === '50',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], totalCount: 0, skip: 0, take: 50 });
  });

  it('omits departmentId when not provided', () => {
    api.listFacultyMembers().subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/api/v1/faculty/members` && !r.params.has('departmentId'),
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], totalCount: 0, skip: 0, take: 200 });
  });
});
