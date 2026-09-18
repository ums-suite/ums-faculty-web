import { isLoginFormValid, validateLoginForm } from './login-form.validation';

describe('login-form.validation', () => {
  it('flags a blank identifier', () => {
    const errors = validateLoginForm({ identifier: '  ', password: 'secret' });
    expect(errors.identifier).toBe('validation.identifier.required');
    expect(errors.password).toBeUndefined();
  });

  it('flags a blank password', () => {
    const errors = validateLoginForm({ identifier: 'jdoe', password: '' });
    expect(errors.password).toBe('validation.password.required');
  });

  it('is valid with both fields present', () => {
    const errors = validateLoginForm({ identifier: 'jdoe', password: 'secret' });
    expect(isLoginFormValid(errors)).toBe(true);
  });

  it('is invalid when any field is missing', () => {
    expect(isLoginFormValid(validateLoginForm({ identifier: '', password: '' }))).toBe(false);
  });
});
