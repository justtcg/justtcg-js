import { HttpClient, QueryParams } from '../../core/http-client';

export class BaseResource {
  protected httpClient: HttpClient;
  private pathPrefix: string;

  constructor(httpClient: HttpClient, pathPrefix: string) {
    this.httpClient = httpClient;
    this.pathPrefix = pathPrefix;
  }

  protected async _get<T>(path: string, params?: QueryParams): Promise<T> {
    // Parse 'query' parameter to the 'q' format expected by the API
    if (params && 'query' in params && typeof params.query === 'string') {
      params.q = params.query;
      delete params.query;
    }
    return this.httpClient.get<T>(`${this.pathPrefix}${path}`, params);
  }

  protected async _post<T>(path: string, body: unknown): Promise<T> {
    return this.httpClient.post<T>(`${this.pathPrefix}${path}`, body);
  }
}
