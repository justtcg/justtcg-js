import { HttpClient } from '../core/http-client';
import { CardsResource } from './resources/cards';
import { GamesResource } from './resources/games';
import { SetsResource } from './resources/sets';

export class V1Client {
  public readonly games: GamesResource;
  public readonly sets: SetsResource;
  public readonly cards: CardsResource;

  constructor(httpClient: HttpClient) {
    this.games = new GamesResource(httpClient);
    this.sets = new SetsResource(httpClient);
    this.cards = new CardsResource(httpClient);
  }
}