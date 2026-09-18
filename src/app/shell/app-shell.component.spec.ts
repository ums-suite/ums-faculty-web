import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShellComponent } from './app-shell.component';

describe('AppShellComponent', () => {
  let fixture: ComponentFixture<AppShellComponent>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('creates', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('builds one nav item per feature area', () => {
    const items = (
      fixture.componentInstance as unknown as { navItems: () => unknown[] }
    ).navItems();
    expect(items.length).toBe(7);
  });

  it('toggleLocale flips between en and bn', () => {
    const instance = fixture.componentInstance as unknown as {
      toggleLocale: () => void;
      globalStore: { locale: () => string };
    };
    const before = instance.globalStore.locale();
    instance.toggleLocale();
    expect(instance.globalStore.locale()).not.toBe(before);
  });

  it('toggleTheme cycles system -> light -> dark -> system', () => {
    const instance = fixture.componentInstance as unknown as {
      toggleTheme: () => void;
      globalStore: { themeMode: () => string };
    };
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      seen.add(instance.globalStore.themeMode());
      instance.toggleTheme();
    }
    expect(seen.size).toBe(3);
  });
});
