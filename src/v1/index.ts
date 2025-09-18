import { HttpClient } from '../core/http-client';
import { GamesResource } from './resources/games';

export class V1Client {
  public readonly games: GamesResource;
  // We will add .sets and .cards here later

  constructor(httpClient: HttpClient) {
    this.games = new GamesResource(httpClient);
  }
}