type TokenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const TOKEN_KEY = 'erp_token';

export function getStoredAuthToken(
  local: Pick<TokenStorage, 'getItem'> = localStorage,
  session: Pick<TokenStorage, 'getItem'> = sessionStorage,
): string | null {
  return local.getItem(TOKEN_KEY) ?? session.getItem(TOKEN_KEY);
}

export function storeAuthToken(
  token: string,
  rememberMe: boolean,
  local: TokenStorage = localStorage,
  session: TokenStorage = sessionStorage,
): void {
  const destination = rememberMe ? local : session;
  const other = rememberMe ? session : local;
  other.removeItem(TOKEN_KEY);
  destination.setItem(TOKEN_KEY, token);
}

export function clearStoredAuthToken(
  local: Pick<TokenStorage, 'removeItem'> = localStorage,
  session: Pick<TokenStorage, 'removeItem'> = sessionStorage,
): void {
  local.removeItem(TOKEN_KEY);
  session.removeItem(TOKEN_KEY);
}
