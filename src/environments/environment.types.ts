/**
 * Shared shape for `environment.ts`/`environment.development.ts`. Deliberately its own file
 * (neither of the two swapped via `angular.json`'s `fileReplacements`) -- `environment.ts` is
 * replaced wholesale by `environment.development.ts`'s content in the `development`
 * configuration, so if `environment.development.ts` imported this type FROM `./environment`
 * instead, the replacement would make it import from itself.
 */
export interface Environment {
  readonly production: boolean;
  /**
   * `ums-core`'s base origin. Must match what `provideApi()` (the generated `@ums/shared`
   * client's `BASE_PATH`) AND `UMS_AUTH_CONFIG.baseUrl` are both configured with --
   * `AuthRefreshCoordinator` calls `${baseUrl}/api/v1/identity/auth/refresh` directly,
   * independent of the generated client, so the two must never drift apart.
   */
  readonly apiBaseUrl: string;
}
