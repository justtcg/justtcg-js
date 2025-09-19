import { handleResponse } from '../../core/response-handler';
import { HttpClient } from '../../core/http-client';
import { JustTCGApiResponse, PaginationMeta, Set, UsageMeta } from '../../types';

// Define the specific shape of the raw response for this endpoint
interface RawSetsApiResponse {
  data: Set[];
  meta: PaginationMeta; // The sets endpoint is paginated
  _metadata: UsageMeta;
}

export class SetsResource {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Retrieves a paginated list of sets, optionally filtered by game.
   * @param params Optional parameters to filter the list of sets.
   * @returns A JustTCG API response containing an array of Set objects.
   */
  public async list(params?: {
  game?: string;
  limit?: number;
  offset?: number;
}): Promise<JustTCGApiResponse<Set[]>> {
    const rawResponse = await this.httpClient.get<RawSetsApiResponse>('/sets', params);
    return handleResponse(rawResponse);
  }
}