export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(
  pageValue: unknown,
  limitValue: unknown,
  defaultLimit: number,
  maximumLimit: number
): PaginationOptions | null {
  const parsePositiveInteger = (value: unknown, fallback: number): number | null => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;

    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  };

  const page = parsePositiveInteger(pageValue, 1);
  const requestedLimit = parsePositiveInteger(limitValue, defaultLimit);

  if (page === null || requestedLimit === null) return null;

  const limit = Math.min(requestedLimit, maximumLimit);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) return null;

  return { page, limit, skip };
}
