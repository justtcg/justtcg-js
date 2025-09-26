import { JustTCG } from 'justtcg-js';

interface InventoryItem {
  variantId: string;
  quantity: number;
  purchasePrice: number;
}

class InventoryManager {
  private client: JustTCG;
  private inventory: InventoryItem[] = [];

  constructor() {
    this.client = new JustTCG();
  }

  addItem(variantId: string, quantity: number, purchasePrice: number) {
    this.inventory.push({ variantId, quantity, purchasePrice });
  }

  async updatePrices() {
    console.log('Updating inventory prices...');

    const variantIds = this.inventory.map(item => item.variantId);
    
    try {
      const response = await this.client.v1.cards.getByBatch(
        variantIds.map(variantId => ({ variantId }))
      );

      let totalValue = 0;
      let totalGainLoss = 0;

      console.log('--- Inventory Report ---');
      console.log('Card Name | Condition | Current Price | Purchase Price | Gain/Loss | Total Value');
      console.log('----------|-----------|---------------|----------------|-----------|------------');

      for (const item of this.inventory) {
        const card = response.data.find(c => 
          c.variants.some(v => v.id === item.variantId)
        );

        if (card) {
          const variant = card.variants.find(v => v.id === item.variantId);
          const currentPrice = variant?.price ?? 0;
          const itemValue = currentPrice * item.quantity;
          const gainLoss = (currentPrice - item.purchasePrice) * item.quantity;

          totalValue += itemValue;
          totalGainLoss += gainLoss;

          console.log(
            `${card.name.padEnd(20)} | ${variant?.condition!.padEnd(10)} | $${currentPrice.toFixed(2).padStart(12)} | $${item.purchasePrice.toFixed(2).padStart(13)} | ${gainLoss >= 0 ? '+' : ''}$${gainLoss.toFixed(2).padStart(7)} | $${itemValue.toFixed(2).padStart(10)}`
          );
        }
      }

      console.log('--- Summary ---');
      console.log(`Total Inventory Value: $${totalValue.toFixed(2)}`);
      console.log(`Total Gain/Loss: ${totalGainLoss >= 0 ? '+' : ''}$${totalGainLoss.toFixed(2)}`);
      console.log(`API requests remaining: ${response.usage.apiRequestsRemaining}`);

    } catch (error) {
      console.error('Error updating prices:', error);
    }
  }
}

// Usage
const inventory = new InventoryManager();
inventory.addItem('pokemon-base-set-charizard-holo-rare_near-mint_holofoil', 1, 150.00);
inventory.addItem('magic-the-gathering-collector-s-edition-black-lotus-ce-rare_lightly-played', 1, 2000.00);

// Update prices
inventory.updatePrices();