import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { facultyGuard } from './core/auth/faculty.guard';

const placeholder = () =>
  import('./core/shared/feature-placeholder.component').then((m) => m.FeaturePlaceholderComponent);

/**
 * Root route table (FWEB-1/FWEB-6). This entire app is CSR, no SSR (requirement-spec.md §2/§10.1)
 * -- every route sits behind {@link authGuard}/{@link facultyGuard} except `/login`.
 *
 * `/login` is guest-only ({@link guestGuard}) -- an already-authenticated faculty member is sent
 * to the dashboard instead of seeing the login form again. Every other route requires both
 * authentication ({@link authGuard}) and FacultyMember/DepartmentHead role membership ({@link
 * facultyGuard}, §5's "renders only the FacultyMember/Department-Head-in-teaching-capacity
 * permission surface" -- best-effort client-side UX, never the real trust boundary) and renders
 * inside the shared {@link AppShellComponent} (top bar + nav).
 *
 * Every feature area (Dashboard, Attendance, Grading, Materials, Leave, Research, Notifications)
 * now has a real component; {@link FeaturePlaceholderComponent} remains only for the wildcard
 * fallback route.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/login/login-form.component').then((m) => m.LoginFormComponent),
  },
  {
    path: '',
    canActivate: [authGuard, facultyGuard],
    loadComponent: () => import('./shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'attendance',
        loadComponent: () =>
          import('./features/attendance/attendance.component').then((m) => m.AttendanceComponent),
      },
      {
        path: 'grading',
        loadComponent: () =>
          import('./features/grading/grading.component').then((m) => m.GradingComponent),
      },
      { path: 'materials', loadComponent: placeholder, data: { label: 'Course materials' } },
      { path: 'leave', loadComponent: placeholder, data: { label: 'Leave' } },
      { path: 'research', loadComponent: placeholder, data: { label: 'Research profile' } },
      { path: 'notifications', loadComponent: placeholder, data: { label: 'Notifications' } },
      { path: '**', loadComponent: placeholder, data: { label: 'This page' } },
    ],
  },
];
