export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' ||
    process.argv[1]?.endsWith('server.cjs') === true ||
    process.env.npm_lifecycle_event === 'start';
}

export function getTrustProxyHops(): number {
  const configuredHops = process.env.TRUST_PROXY;
  if (configuredHops === undefined) {
    return 0;
  }

  const normalizedHops = configuredHops.trim();
  if (!/^\d+$/.test(normalizedHops)) {
    throw new Error('TRUST_PROXY must be a non-negative integer.');
  }

  const hops = Number(normalizedHops);
  if (!Number.isSafeInteger(hops)) {
    throw new Error('TRUST_PROXY must be a non-negative integer.');
  }
  return hops;
}
