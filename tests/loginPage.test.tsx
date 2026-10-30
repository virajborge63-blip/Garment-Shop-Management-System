import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/context/AuthContext.tsx', () => ({
  useAuth: () => ({
    login: async () => {},
    error: null,
    warning: null,
    clearError: () => {},
    isLoading: false,
  }),
}));

import { LoginPage } from '../src/components/auth/LoginPage.tsx';

describe('LoginPage password reset guidance', () => {
  it('renders the manual contact-owner instruction without a reset form', () => {
    const markup = renderToStaticMarkup(<LoginPage />);

    expect(markup).toContain('Contact the owner to reset your password.');
    expect(markup).not.toContain('forgot-email');
    expect(markup).not.toContain('Request Reset');
  });
});
