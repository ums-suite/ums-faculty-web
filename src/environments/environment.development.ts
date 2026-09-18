import type { Environment } from './environment.types';

/** Local dev default -- matches `ums-devops/scripts/dev-up.sh`'s Host port. */
export const environment: Environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080',
};
