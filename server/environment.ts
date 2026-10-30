export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' ||
    process.argv[1]?.endsWith('server.cjs') === true ||
    process.env.npm_lifecycle_event === 'start';
}
