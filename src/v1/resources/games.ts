import { handleResponse } from '../../core/response-handler';
import { Game, JustTCGApiResponse, UsageMeta } from '../../types';
import { BaseResource } from './base';

// Define the specific shape of the raw response for this endpoint
interface RawGamesApiResponse {
  data: Game[];
  _metadata: UsageMeta; // The games endpoint does not have pagination `meta`
}

export class GamesResource extends BaseResource {
  /**
   * Retrieves a list of all supported games.
   * @returns A JustTCG API response containing an array of Game objects.
   */
  public async list(): Promise<JustTCGApiResponse<Game[]>> {
    // Use our new, strongly-typed interface instead of `any`
    const rawResponse = await this._get<RawGamesApiResponse>('/games');
    return handleResponse(rawResponse);
  }
}
