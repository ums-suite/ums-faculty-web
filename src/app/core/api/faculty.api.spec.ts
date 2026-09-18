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

  it('lists leave requests filtered by facultyMemberId/skip/take', () => {
    api.listLeaveRequests('fac-1', 0, 50).subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/api/v1/faculty/leave-requests` &&
        r.params.get('facultyMemberId') === 'fac-1' &&
        r.params.get('skip') === '0' &&
        r.params.get('take') === '50',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], skip: 0, take: 50 });
  });

  it('submits a leave request via POST /faculty/leave-requests', () => {
    const request = {
      facultyMemberId: 'fac-1',
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      reason: 'conference',
    };
    api.submitLeaveRequest(request).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/faculty/leave-requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });

  it('cancels a leave request with its expected version', () => {
    api.cancelLeaveRequest('lr-1', { version: 2 }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/faculty/leave-requests/lr-1/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ version: 2 });
    req.flush({});
  });

  it('attaches a supporting document to a leave request', () => {
    api.attachSupportingDocument('lr-1', { generatedDocumentId: 'doc-1', version: 1 }).subscribe();
    const req = httpMock.expectOne(
      `${baseUrl}/api/v1/faculty/leave-requests/lr-1/supporting-document`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('approves a leave request at the department-head step', () => {
    api.approveByDepartmentHead('lr-1', { version: 1 }).subscribe();
    const req = httpMock.expectOne(
      `${baseUrl}/api/v1/faculty/leave-requests/lr-1/approve/department-head`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('approves a leave request at the authority step', () => {
    api.approveByAuthority('lr-1', { version: 1 }).subscribe();
    const req = httpMock.expectOne(
      `${baseUrl}/api/v1/faculty/leave-requests/lr-1/approve/authority`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('rejects a leave request at the department-head step', () => {
    api.rejectByDepartmentHead('lr-1', { reason: 'coverage unavailable', version: 1 }).subscribe();
    const req = httpMock.expectOne(
      `${baseUrl}/api/v1/faculty/leave-requests/lr-1/reject/department-head`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('rejects a leave request at the authority step', () => {
    api.rejectByAuthority('lr-1', { reason: null, version: 1 }).subscribe();
    const req = httpMock.expectOne(
      `${baseUrl}/api/v1/faculty/leave-requests/lr-1/reject/authority`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('fetches a research profile by facultyMemberId', () => {
    api.getResearchProfile('fac-1').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/faculty/members/fac-1/research-profile`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('updates a research profile via PUT', () => {
    const request = { publications: [], ongoingResearch: null, grants: null, version: 1 };
    api.updateResearchProfile('fac-1', request).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/api/v1/faculty/members/fac-1/research-profile`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });
});
