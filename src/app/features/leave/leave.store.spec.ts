import { HttpClient, HttpEventType } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DocumentsApi } from '../../core/api/documents.api';
import { FacultyApi } from '../../core/api/faculty.api';
import type { LeaveRequestDto } from '../../core/api/faculty.types';
import { FacultyIdentityService } from '../../core/auth/faculty-identity.service';
import { LeaveStore } from './leave.store';

describe('LeaveStore', () => {
  let facultyApiSpy: jasmine.SpyObj<FacultyApi>;
  let documentsApiSpy: jasmine.SpyObj<DocumentsApi>;
  let httpSpy: jasmine.SpyObj<HttpClient>;
  let store: LeaveStore;

  function leaveDto(overrides: Partial<LeaveRequestDto> = {}): LeaveRequestDto {
    return {
      id: 'lr-1',
      facultyMemberId: 'fac-1',
      requesterUserId: 'u-1',
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      reason: 'conference',
      localizedReason: 'conference',
      status: 'Submitted',
      routedDirectlyToAuthority: false,
      supportingDocumentReference: null,
      createdAt: 't',
      submittedAt: 't',
      decidedAt: null,
      version: 1,
      ...overrides,
    };
  }

  beforeEach(() => {
    facultyApiSpy = jasmine.createSpyObj('FacultyApi', [
      'listLeaveRequests',
      'listCourseAssignments',
      'submitLeaveRequest',
      'cancelLeaveRequest',
      'attachSupportingDocument',
    ]);
    documentsApiSpy = jasmine.createSpyObj('DocumentsApi', ['requestUpload', 'confirmUpload']);
    httpSpy = jasmine.createSpyObj('HttpClient', ['put']);
    facultyApiSpy.listLeaveRequests.and.returnValue(of({ items: [], skip: 0, take: 50 }));
    facultyApiSpy.listCourseAssignments.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        { provide: FacultyApi, useValue: facultyApiSpy },
        { provide: DocumentsApi, useValue: documentsApiSpy },
        { provide: HttpClient, useValue: httpSpy },
        {
          provide: FacultyIdentityService,
          useValue: { facultyMemberId: signal('fac-1') },
        },
      ],
    });
    store = TestBed.inject(LeaveStore);
  });

  it('refresh loads both the leave-history list and course assignments', () => {
    facultyApiSpy.listLeaveRequests.and.returnValue(of({ items: [leaveDto()], skip: 0, take: 50 }));
    store.refresh();
    expect(store.leaveRequests().length).toBe(1);
  });

  it('leaveBalance is always null -- confirmed backend gap, never fabricated', () => {
    expect(store.leaveBalance).toBeNull();
  });

  it('submit adds the new request to the list without an attachment', () => {
    facultyApiSpy.submitLeaveRequest.and.returnValue(of(leaveDto()));
    store.submit({ startDate: '2026-10-01', endDate: '2026-10-05', reason: 'conference' }, null);
    expect(store.leaveRequests()[0].id).toBe('lr-1');
    expect(documentsApiSpy.requestUpload).not.toHaveBeenCalled();
  });

  it('submit with a file runs the full attachment pipeline and marks it successful', () => {
    facultyApiSpy.submitLeaveRequest.and.returnValue(of(leaveDto()));
    documentsApiSpy.requestUpload.and.returnValue(
      of({
        id: 'artifact-1',
        ownerId: 'fac-1',
        artifactType: 'LeaveSupportingDocument',
        mimeType: 'application/pdf',
        status: 'PendingUpload',
        sizeBytes: null,
        requestedAt: 't',
        readyAt: null,
        uploadUrl: 'https://storage.example/put',
        downloadUrl: null,
      }),
    );
    httpSpy.put.and.returnValue(of({ type: HttpEventType.Response } as never));
    documentsApiSpy.confirmUpload.and.returnValue(
      of({
        id: 'artifact-1',
        ownerId: 'fac-1',
        artifactType: 'LeaveSupportingDocument',
        mimeType: 'application/pdf',
        status: 'Ready',
        sizeBytes: 100,
        requestedAt: 't',
        readyAt: 't',
        uploadUrl: null,
        downloadUrl: 'https://storage.example/get',
      }),
    );
    facultyApiSpy.attachSupportingDocument.and.returnValue(
      of(leaveDto({ supportingDocumentReference: 'artifact-1' })),
    );

    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    store.submit({ startDate: '2026-10-01', endDate: '2026-10-05', reason: 'conference' }, file);

    expect(facultyApiSpy.attachSupportingDocument).toHaveBeenCalledWith('lr-1', {
      generatedDocumentId: 'artifact-1',
      version: 1,
    });
    expect(store.attachmentUpload()?.phase).toBe('success');
  });

  it('a failed attachment upload never loses the already-submitted leave request', () => {
    facultyApiSpy.submitLeaveRequest.and.returnValue(of(leaveDto()));
    documentsApiSpy.requestUpload.and.returnValue(throwError(() => new Error('network down')));

    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    store.submit({ startDate: '2026-10-01', endDate: '2026-10-05', reason: 'conference' }, file);

    expect(store.leaveRequests()[0].id).toBe('lr-1');
    expect(store.attachmentUpload()?.phase).toBe('error');
  });

  it('retryAttachment reuses the same held file without re-asking for the whole form', () => {
    facultyApiSpy.submitLeaveRequest.and.returnValue(of(leaveDto()));
    documentsApiSpy.requestUpload.and.returnValue(throwError(() => new Error('network down')));
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    store.submit({ startDate: '2026-10-01', endDate: '2026-10-05', reason: 'conference' }, file);
    expect(store.attachmentUpload()?.phase).toBe('error');

    documentsApiSpy.requestUpload.and.returnValue(
      of({
        id: 'artifact-1',
        ownerId: 'fac-1',
        artifactType: 'LeaveSupportingDocument',
        mimeType: 'application/pdf',
        status: 'PendingUpload',
        sizeBytes: null,
        requestedAt: 't',
        readyAt: null,
        uploadUrl: 'https://storage.example/put',
        downloadUrl: null,
      }),
    );
    httpSpy.put.and.returnValue(of({ type: HttpEventType.Response } as never));
    documentsApiSpy.confirmUpload.and.returnValue(
      of({
        id: 'artifact-1',
        ownerId: 'fac-1',
        artifactType: 'LeaveSupportingDocument',
        mimeType: 'application/pdf',
        status: 'Ready',
        sizeBytes: 100,
        requestedAt: 't',
        readyAt: 't',
        uploadUrl: null,
        downloadUrl: null,
      }),
    );
    facultyApiSpy.attachSupportingDocument.and.returnValue(of(leaveDto()));

    store.retryAttachment();

    expect(store.attachmentUpload()?.phase).toBe('success');
  });

  it('cancel replaces the leave request with its cancelled server response', () => {
    facultyApiSpy.listLeaveRequests.and.returnValue(of({ items: [leaveDto()], skip: 0, take: 50 }));
    facultyApiSpy.cancelLeaveRequest.and.returnValue(
      of(leaveDto({ status: 'Cancelled', version: 2 })),
    );
    store.refresh();

    store.cancel(store.leaveRequests()[0]);

    expect(store.leaveRequests()[0].status).toBe('Cancelled');
  });

  it('overlapWarnings reflects the loaded leave list and assignments', () => {
    facultyApiSpy.listLeaveRequests.and.returnValue(of({ items: [leaveDto()], skip: 0, take: 50 }));
    facultyApiSpy.listCourseAssignments.and.returnValue(
      of([
        {
          id: 'ca-1',
          facultyMemberId: 'fac-1',
          courseOfferingId: 'off-1',
          departmentId: 'd-1',
          assignedAt: '2026-09-01T00:00:00Z',
        },
      ]),
    );
    store.refresh();

    expect(store.overlapWarnings()).toEqual([
      { leaveRequestId: 'lr-1', overlappingCourseOfferingIds: ['off-1'] },
    ]);
  });
});
