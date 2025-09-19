import { handleResponse } from '../../core/response-handler';
import { JustTCGApiResponse, PaginationMeta, Set, UsageMeta } from '../../types';
import { BaseResource } from './base';

// Define the specific shape of the raw response for this endpoint
interface RawSetsApiResponse {
  data: Set[];
  meta: PaginationMeta; // The sets endpoint is paginated
  _metadata: UsageMeta;
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
    /** The maximum number of results to return. Default is 20. */
    limit?: number;
    /** The number of results to skip for pagination. */
    offset?: number;
  }): Promise<JustTCGApiResponse<Set[]>> {
    const rawResponse = await this._get<RawSetsApiResponse>('/sets', params);
    return handleResponse(rawResponse);
  }

  /**
   * Fetches all sets for a given game, handling pagination automatically.
   * This method is an async generator, yielding one set at a time.
   * @param params Parameters to filter the sets, 'game' is required.
   * @yields A Set object for each set found.
   */
  public async *fetchAll(params: {
    /** The name of the game to filter sets by (e.g., 'Pokemon'). */
    game: string;
  }): AsyncGenerator<Set> {
    const limit = 100; // A reasonable page size for fetching in the background
    let offset = 0;
    let hasMore = true;

    do {
      const response = await this.list({ ...params, limit, offset });

      if (response.data && response.data.length > 0) {
        for (const set of response.data) {
          yield set;
        }
      }

      hasMore = response.pagination?.hasMore ?? false;
      offset += limit;
    } while (hasMore);
  }
}
