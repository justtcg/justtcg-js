import { JustTCGApiResponse, PaginationMeta, UsageMeta } from '../types';

/**
 * The raw shape of a successful response from the JustTCG API server.
 */
interface RawApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  _metadata: {
    apiRequestLimit: number;
    apiRequestsUsed: number;
    apiRequestsRemaining: number;
    apiPlan: string;
  };
  error?: string;
  code?: string;
}

/**
 * Transforms a raw API response into the clean, structured format for the SDK user.
 * @param rawResponse The raw response object from the API.
 * @returns A JustTCGApiResponse object.
 */
export function handleResponse<T>(rawResponse: RawApiResponse<T>): JustTCGApiResponse<T> {
  const usage: UsageMeta = {
    apiRequestLimit: rawResponse._metadata.apiRequestLimit,
    apiRequestsRemaining: rawResponse._metadata.apiRequestsRemaining,
    apiRequestsUsed: rawResponse._metadata.apiRequestsUsed,
    apiPlan: rawResponse._metadata.apiPlan,
  };

  const pagination: PaginationMeta | undefined = rawResponse.meta
    ? {
        total: rawResponse.meta.total,
        limit: rawResponse.meta.limit,
        offset: rawResponse.meta.offset,
        hasMore: rawResponse.meta.hasMore,
      }
    : undefined;

  return {
    data: rawResponse.data,
    pagination,
    usage,
    ...(rawResponse.error && { error: rawResponse.error }),
    ...(rawResponse.code && { code: rawResponse.code }),
  };
}
