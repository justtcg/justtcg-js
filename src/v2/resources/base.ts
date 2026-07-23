import { HttpClient, JustTCGResponse, QueryParams } from '../../core/http-client';

/**
 * Shared plumbing for the v2 resources.
 *
 * Distinct from the v1 `BaseResource` in two ways: it uses the raw request methods, because v2 puts
 * usage and pagination in the response headers, and it does not rewrite `query` to `q` — v2 takes
 * `q` natively.
 */
export class V2BaseResource {
  protected httpClient: HttpClient;
  private pathPrefix: string;

  constructor(httpClient: HttpClient, pathPrefix: string) {
    this.httpClient = httpClient;
    this.pathPrefix = pathPrefix;
  }

  protected async _get<T>(path: string, params?: QueryParams): Promise<JustTCGResponse<T>> {
    return this.httpClient.getRaw<T>(`${this.pathPrefix}${path}`, params);
  }

  protected async _post<T>(
    path: string,
    body: unknown,
    params?: QueryParams,
  ): Promise<JustTCGResponse<T>> {
    return this.httpClient.postRaw<T>(`${this.pathPrefix}${path}`, body, params);
  }
}
