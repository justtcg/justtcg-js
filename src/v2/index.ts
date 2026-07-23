import { HttpClient } from '../core/http-client';
import { V2CardsResource } from './resources/cards';

/**
 * The v2 API surface (public beta).
 *
 * v2 is additive: `client.v1` is untouched and keeps its own types, ids, and response shape. See
 * `docs/V2_IMPLEMENTATION_PLAN.md` for the field-by-field migration table.
 */
export class V2Client {
  public readonly cards: V2CardsResource;

  constructor(httpClient: HttpClient) {
    const pathPrefix = '/v2';

    this.cards = new V2CardsResource(httpClient, pathPrefix);
  }
}
