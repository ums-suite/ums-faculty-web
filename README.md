# ums-faculty-web

The faculty portal — attendance, grading, course materials, leave, and research profile. An internal, efficiency-critical tool for Faculty and Department Heads.

- **Full spec:** [`ums-platform/docs/client/ums-faculty-web/requirement-spec.md`](https://github.com/ums-suite/ums-platform/blob/main/docs/client/ums-faculty-web/requirement-spec.md)
- **Design system:** [`ums-design-system`](https://github.com/ums-suite/ums-design-system) · **API contracts:** [`ums-shared`](https://github.com/ums-suite/ums-shared)
- **Tech:** Angular 22, Bengali/English i18n

## Status

Cross-cutting infrastructure, Dashboard, and the full Attendance feature (FWEB-1 through FWEB-16) are built. Grading, Course Materials, Leave, Research Profile, and the Notification Center (FWEB-17 onward) are scaffolded (stub stores, placeholder routes) but not yet implemented — see [`ums-platform/PLATFORM_BLUEPRINT.md`](https://github.com/ums-suite/ums-platform/blob/main/PLATFORM_BLUEPRINT.md) and this repo's `docs/client/ums-faculty-web/tickets.md` for the full ticket list.

**Getting started:**

```bash
npm ci
npm start          # ng serve
npm run build      # production build
npm run test:ci    # unit tests with coverage
npm run lint        # eslint
npm run stylelint   # stylelint
```

**Confirmed backend gaps** (flagged in code, not guessed around) that block some flows end-to-end against a real `ums-core` today: no endpoint lists a `CourseOffering`'s enrolled students, no `GET` for an existing `AttendanceSession`, no bulk-attendance-mark endpoint, no attendance-statistics/low-attendance-threshold-config endpoint, and no "resolve my own FacultyMemberId" self-lookup endpoint. Each is documented at its exact call site (`src/app/core/api/academic.api.ts`, `src/app/features/attendance/attendance.store.ts`, `src/app/core/auth/faculty-identity.service.ts`).
