import { HttpClient } from '../core/http-client';
import { GamesResource } from './resources/games';
import { SetsResource } from './resources/sets';

export class V1Client {
  public readonly games: GamesResource;
  public readonly sets: SetsResource;

  constructor(httpClient: HttpClient) {
    this.games = new GamesResource(httpClient);
    this.sets = new SetsResource(httpClient);
  }
}