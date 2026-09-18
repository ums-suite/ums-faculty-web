/** Pure validation for the login form (FWEB-4). Kept outside the component so it is trivially unit-testable with no DI/HttpClient. */
export interface LoginFormValues {
  readonly identifier: string;
  readonly password: string;
}

export interface LoginFormErrors {
  readonly identifier?: string;
  readonly password?: string;
}

export function validateLoginForm(values: LoginFormValues): LoginFormErrors {
  const errors: { -readonly [K in keyof LoginFormErrors]?: string } = {};

  if (!values.identifier.trim()) {
    errors.identifier = 'validation.identifier.required';
  }

  if (!values.password) {
    errors.password = 'validation.password.required';
  }

  return errors;
}

export function isLoginFormValid(errors: LoginFormErrors): boolean {
  return Object.keys(errors).length === 0;
}
