# ums-faculty-web

The faculty portal — attendance, grading, course materials, leave, and research profile. An internal, efficiency-critical tool for Faculty and Department Heads.

- **Full spec:** [`ums-platform/docs/client/ums-faculty-web/requirement-spec.md`](https://github.com/ums-suite/ums-platform/blob/main/docs/client/ums-faculty-web/requirement-spec.md)
- **Design system:** [`ums-design-system`](https://github.com/ums-suite/ums-design-system) · **API contracts:** [`ums-shared`](https://github.com/ums-suite/ums-shared)
- **Tech:** Angular 22, Bengali/English i18n

## Status

All 29 tickets (FWEB-1 through FWEB-29) are built: cross-cutting infrastructure, Dashboard, the full Attendance feature, Grading & Result Submission, Course Materials, Leave, Research Profile, and the Notification Center. See this repo's `docs/client/ums-faculty-web/tickets.md` for the full ticket list and [`ums-platform/PLATFORM_BLUEPRINT.md`](https://github.com/ums-suite/ums-platform/blob/main/PLATFORM_BLUEPRINT.md) for how this fits the wider suite.

**Getting started:**

```bash
npm ci
npm start          # ng serve
npm run build      # production build
npm run test:ci    # unit tests with coverage
npm run lint        # eslint
npm run stylelint   # stylelint
```

**Confirmed backend gaps** (flagged in code at their exact call site, not guessed around) that block some flows end-to-end against a real `ums-core` today:

- Attendance (FWEB-10..16): no endpoint lists a `CourseOffering`'s enrolled students, no `GET` for an existing `AttendanceSession`, no bulk-attendance-mark endpoint, no attendance-statistics/low-attendance-threshold-config endpoint (`core/api/academic.api.ts`, `features/attendance/attendance.store.ts`).
- Faculty self-lookup: no "resolve my own FacultyMemberId" endpoint from the caller's own JWT (`core/auth/faculty-identity.service.ts`).
- Grading (FWEB-17..21): `Assessment` has no configurable "max marks" field, only a `weight` fraction — the real, fixed `0..100` per-score range is what invariant #4 is enforced against (`features/grading/grade-calculation.ts`). No `GET` exists for a Grade or a CourseOffering's `ResultPublication` status independently of a mutating action's own response (`core/api/academic.types.ts`). Academic's real `GradeLocked` domain event has no Notifications-module consumer yet — the mid-typing lock-notice listener is built against the plausible assumed shape design-decisions.md itself describes (`features/grading/grade-lock-listener.service.ts`).
- Course Materials (FWEB-22/23): `LectureMaterial` (the real backend home for this feature — `Learning` module, not `Content`) has no scheduled-release/`publishAt` field; resolved with an upload-now/publish-later client mechanism (`features/materials/materials.store.ts`). No multipart/resumable-upload API exists against the single presigned-PUT flow, so retry resumes from the artifact-confirm step or restarts from scratch, never a silent partial file.
- Leave (FWEB-24..26): no leave-balance concept exists anywhere in `ums-core` (`core/api/faculty.types.ts`). No Faculty-scoped presigned-upload wrapper exists for a LeaveRequest's own attachment, unlike Learning's own Instructor-gated equivalent for lecture materials — built against Documents' own endpoint on the working assumption a Faculty member's grant covers it (`core/api/documents.types.ts`). No grade-due-date field exists anywhere in Academic, so FWEB-26's overlap warning is a CourseAssignment-overlap proxy per design-decisions.md, not a literal deadline comparison (`features/leave/leave-overlap.ts`).
- Research Profile (FWEB-27/28): `PublicationDto` has no per-entry visibility field — FWEB-28's draft/public toggle is a client-side decision about what's included in the next PUT, since the server has no staged-publication concept at all (`core/api/faculty.types.ts`, `features/research/research-visibility.ts`).
