import { JustTCG } from '../src';

interface PriceAlert {
  cardId: string;
  threshold: number;
  direction: 'above' | 'below';
}

class PriceTracker {
  private client: JustTCG;
  private alerts: PriceAlert[] = [];

  constructor() {
    this.client = new JustTCG();
  }

  addAlert(cardId: string, threshold: number, direction: 'above' | 'below') {
    this.alerts.push({ cardId, threshold, direction });
  }

  async checkPrices() {
    console.log('Checking prices for tracked cards...');

    for (const alert of this.alerts) {
      try {
        const response = await this.client.v1.cards.get({
          cardId: alert.cardId,
          limit: 1
        });

        if (response.data.length > 0) {
          const card = response.data[0];
          const topVariant = card.variants.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];
          const currentPrice = topVariant?.price ?? 0;

          if (this.shouldAlert(alert, currentPrice)) {
            this.sendAlert(alert, card.name, currentPrice);
          }
          else {
            console.log(`No alert for ${card.name}. Current price: $${currentPrice.toFixed(2)}`);
          }
        }
      } catch (error) {
        console.error(`Error checking ${alert.cardId}:`, error);
      }
    }
  }

  private shouldAlert(alert: PriceAlert, price: number): boolean {
    if (alert.direction === 'above') {
      return price >= alert.threshold;
    } else {
      return price <= alert.threshold;
    }
  }

  private sendAlert(alert: PriceAlert, cardName: string, price: number) {
    console.log(`🚨 ALERT: ${cardName} is now $${price.toFixed(2)} (${alert.direction} $${alert.threshold})`);
  }
}

// Usage
const tracker = new PriceTracker();
tracker.addAlert('pokemon-base-set-charizard-holo-rare', 500, 'above');
tracker.addAlert('magic-the-gathering-collector-s-edition-black-lotus-ce-rare', 2000, 'below');

// Initial price check
tracker.checkPrices();

// Check prices every 5 minutes
setInterval(() => {
  tracker.checkPrices();
}, 5 * 60 * 1000);