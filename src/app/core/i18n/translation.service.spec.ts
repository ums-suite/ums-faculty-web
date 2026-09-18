import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LocaleService } from '@ums/shared';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  let localeSignal: ReturnType<typeof signal<'en' | 'bn'>>;
  let service: TranslationService;

  beforeEach(() => {
    localeSignal = signal<'en' | 'bn'>('en');
    TestBed.configureTestingModule({
      providers: [{ provide: LocaleService, useValue: { locale: localeSignal } }],
    });
    service = TestBed.inject(TranslationService);
  });

  it('returns the English string for a known key', () => {
    expect(service.t('common.retry')).toBe('Retry');
  });

  it('switches dictionaries reactively when the locale signal changes', () => {
    expect(service.t('common.retry')).toBe('Retry');
    localeSignal.set('bn');
    expect(service.t('common.retry')).toBe('আবার চেষ্টা করুন');
  });

  it('interpolates {{placeholder}} params', () => {
    expect(service.t('shell.comingSoon.body', { label: 'Grading' })).toBe(
      "Grading isn't built yet — check back soon.",
    );
  });

  it('leaves an unmatched placeholder untouched', () => {
    expect(service.t('shell.comingSoon.body', {})).toBe(
      "{{label}} isn't built yet — check back soon.",
    );
  });

  it('falls back to the raw key for a missing translation', () => {
    expect(service.t('nonexistent.key')).toBe('nonexistent.key');
  });
});
