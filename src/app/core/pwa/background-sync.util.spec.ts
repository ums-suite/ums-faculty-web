import { registerAttendanceSync } from './background-sync.util';

describe('registerAttendanceSync', () => {
  afterEach(() => {
    delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
  });

  it('resolves false when serviceWorker is not supported', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });

    const result = await registerAttendanceSync();
    expect(result).toBe(false);
  });

  it('resolves false when the registration has no sync manager', async () => {
    const fakeRegistration = {} as ServiceWorkerRegistration;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(fakeRegistration) },
      configurable: true,
    });

    const result = await registerAttendanceSync();
    expect(result).toBe(false);
  });

  it('registers the sync tag when a sync manager is present', async () => {
    const register = jasmine.createSpy('register').and.resolveTo(undefined);
    const fakeRegistration = { sync: { register } } as unknown as ServiceWorkerRegistration;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(fakeRegistration) },
      configurable: true,
    });

    const result = await registerAttendanceSync('my-tag');
    expect(result).toBe(true);
    expect(register).toHaveBeenCalledWith('my-tag');
  });

  it('resolves false when registration throws', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.reject(new Error('boom')) },
      configurable: true,
    });

    const result = await registerAttendanceSync();
    expect(result).toBe(false);
  });
});
