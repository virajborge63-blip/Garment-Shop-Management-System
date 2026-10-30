import { describe, expect, it } from 'vitest';
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  storeAuthToken,
} from '../src/utils/authToken.ts';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('auth token storage', () => {
  it('uses local storage for remembered sessions and clears the session copy', () => {
    const local = createStorage();
    const session = createStorage();
    session.setItem('erp_token', 'old-session-token');

    storeAuthToken('remembered-token', true, local, session);

    expect(local.getItem('erp_token')).toBe('remembered-token');
    expect(session.getItem('erp_token')).toBeNull();
    expect(getStoredAuthToken(local, session)).toBe('remembered-token');
  });

  it('uses session storage when remember me is disabled and clears the local copy', () => {
    const local = createStorage();
    const session = createStorage();
    local.setItem('erp_token', 'old-local-token');

    storeAuthToken('temporary-token', false, local, session);

    expect(local.getItem('erp_token')).toBeNull();
    expect(session.getItem('erp_token')).toBe('temporary-token');
    expect(getStoredAuthToken(local, session)).toBe('temporary-token');
  });

  it('clears tokens from both stores on logout or invalid session', () => {
    const local = createStorage();
    const session = createStorage();
    local.setItem('erp_token', 'local-token');
    session.setItem('erp_token', 'session-token');

    clearStoredAuthToken(local, session);

    expect(local.getItem('erp_token')).toBeNull();
    expect(session.getItem('erp_token')).toBeNull();
  });
});
