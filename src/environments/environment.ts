import type { Environment } from './environment.types';

/**
 * Production environment defaults. Swapped for `environment.development.ts` via `angular.json`'s
 * `development` configuration `fileReplacements` (see `npm start` / `ng serve`).
 */
export const environment: Environment = {
  production: true,
  apiBaseUrl: '/api',
};
