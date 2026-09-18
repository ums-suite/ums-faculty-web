import { Pipe, type PipeTransform, inject } from '@angular/core';
import { TranslationService } from './translation.service';
import type { TranslationParams } from './translation-dictionary.types';

/**
 * Template-ergonomic wrapper over `TranslationService.t()`: `{{ 'shell.nav.dashboard' | translate }}`.
 *
 * `pure: false` is deliberate, not an oversight: a pure pipe only re-evaluates when one of its
 * *own* arguments changes by reference, but this pipe's output actually depends on
 * `TranslationService`'s internal locale signal, which changes independently of the key argument
 * passed to it. Marking it impure makes Angular re-invoke `transform()` on every change-detection
 * pass for the host view, which is how it picks up a live locale switch with no page reload.
 */
@Pipe({ name: 'translate', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly translationService = inject(TranslationService);

  transform(key: string, params?: TranslationParams): string {
    return this.translationService.t(key, params);
  }
}
