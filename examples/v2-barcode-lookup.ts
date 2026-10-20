import { JustTCG, NotFoundError, ValidationError } from '../src';

/**
 * Price sealed product from the barcode on the box (v2 public beta).
 *
 * `getByBarcode` takes the code printed under the barcode: a 12-digit UPC-A, 13-digit EAN-13 or
 * JAN, 8-digit EAN-8, or 14-digit GTIN-14. Spaces and hyphens are ignored, so scanner or typed
 * input can go straight in. One barcode can belong to several listings, so the result is an array.
 *
 * Coverage is currently sealed Magic: The Gathering, Pokémon and Yu-Gi-Oh! product.
 *
 * Run with: npx tsx examples/v2-barcode-lookup.ts 820650850714
 */
async function barcodeLookup(gtin: string) {
  const client = new JustTCG();

  try {
    const { data, usage } = await client.v2.cards.getByBarcode(gtin);

    console.log(`${data.length} listing(s) for ${gtin}:`);
    for (const card of data) {
      // Sealed product has a single raw variant; markets[0] is the primary market.
      const market = card.variants[0]?.markets[0];
      const price = market?.price?.toFixed(2) ?? 'no current price';
      console.log(
        `  ${card.name} (${card.set.name ?? card.game.name}): ${price} ${market?.currency ?? ''}`,
      );
    }

    console.log(`\nAPI requests remaining: ${usage.remaining ?? 'unknown'}`);
  } catch (error) {
    if (error instanceof ValidationError) {
      // The check digit didn't add up: most often a mistyped or partially scanned code.
      console.error(`'${gtin}' is not a valid barcode: ${error.message}`);
    } else if (error instanceof NotFoundError) {
      // A valid code that no product carries yet. A 12–14 digit code passed to search() is matched
      // the same way first and then falls back to a name search, if you would rather get something.
      console.error(`No product found for barcode ${gtin}.`);
    } else {
      console.error('An error occurred:', (error as Error).message);
    }
    process.exit(1);
  }
}

barcodeLookup(process.argv[2] ?? '820650850714');
