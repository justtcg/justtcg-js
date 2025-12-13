import { handleResponse } from '../../core/response-handler';
import { JustTCGApiResponse, PaginationMeta, Set, UsageMeta } from '../../types';
import { BaseResource } from './base';

// Define the specific shape of the raw response for this endpoint
interface RawSetsApiResponse {
  data: Set[];
  meta: PaginationMeta; // The sets endpoint is paginated
  _metadata: UsageMeta;
  error?: string;
  code?: string;
}

export class SetsResource extends BaseResource {
  /**
   * Retrieves a paginated list of sets, optionally filtered by game.
   * @param params Optional parameters to filter the list of sets.
   * @returns A JustTCG API response containing an array of Set objects.
   */
  public async list(params?: {
    /** The name of the game to filter sets by (e.g., 'Pokemon'). */
    game?: string;
    /** Query string to search for sets by name. */
    q?: string;
    /** Order by a specific field. */
    orderBy?: 'name' | 'release_date';
    /** Order direction: ascending ('asc') or descending ('desc'). */
    order?: 'asc' | 'desc';
    /** The maximum number of results to return. Default is 20. */
    limit?: number;
    /** The number of results to skip for pagination. */
    offset?: number;
  }): Promise<JustTCGApiResponse<Set[]>> {
    const rawResponse = await this._get<RawSetsApiResponse>('/sets', params);
    return handleResponse(rawResponse);
  }
}
