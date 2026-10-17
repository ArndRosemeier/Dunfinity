/**
 * A merchant's counter: what they sell (Kemal's and Ilse's `GEAR`, src/loot/hardware.ts) and, if
 * they buy, what of the grandchild's pack they take (finds for their value, spare items for half
 * what Kemal asks for them new). One counter for every merchant: Kemal and Ilse in the town now,
 * anyone below who ever sets up shop later (drawn by src/app/shopView.ts).
 *
 * Pure: the merchant, the lines on their counter, a trade.
 */
import type { Pack } from './finds';
import { GEAR, GEAR_ORDER, buyGear, hasGear, ilseSells, type GearKind } from './hardware';
import { ITEMS, QUALITY, type Item, type Kit } from './items';
import { ilsePays, sell } from './pawn';

export interface Merchant {
  /** Who stands behind the counter. */
  readonly who: string;
  /** The shop's name, over the window. */
  readonly title: string;
  /** What is on the counter, in order. */
  readonly goods: readonly GearKind[];
  /** Whether they buy what one brings; if not, what they say instead. */
  readonly buys: true | string;
}

/** The town's two counters: Kemal's always the same; Ilse's with what the stranger from below brought her once `below` (in town). */
export function townMerchant(shop: 'hardware' | 'pawn', below: boolean): Merchant {
  return shop === 'hardware'
    ? { who: 'Kemal', title: "Kemal's hardware", goods: GEAR_ORDER, buys: '"Used things? No, no. Ilse, across the street. She takes anything. Anything!"' }
    : { who: 'Ilse', title: "Ilse's pawn shop", goods: ilseSells(below), buys: true };
}

/** A line on the counter: something to buy, or a find or spare item of the pack to sell. */
export type ShopRow = { readonly what: 'buy'; readonly kind: GearKind } | { readonly what: 'find' | 'spare'; readonly i: number };

/** What a spare `item` fetches: its worth (`ItemDef.worth`), or half of what Kemal asks for it new; its quality and any property count (0: nobody buys it). */
export function resale(item: Item): number {
  const g = Object.values(GEAR).find((d) => d.item === item.kind), worth = ITEMS[item.kind].worth ?? (g ? g.price / 2 : 0);
  return Math.floor(worth * QUALITY[item.quality].factor * (item.of ? 1.5 : 1));
}

/** The counter's lines: the goods, then (if they buy) the finds and the spare items that fetch something. */
export function shopRows(m: Merchant, pack: Pack): ShopRow[] {
  const rows: ShopRow[] = m.goods.map((kind) => ({ what: 'buy', kind }));
  if (m.buys !== true) return rows;
  pack.items.forEach((_, i) => rows.push({ what: 'find', i }));
  pack.spare.forEach((it, i) => { if (resale(it) > 0) rows.push({ what: 'spare', i }); });
  return rows;
}

/** What a line costs (buy) or fetches (sell), and whether it can be done now (`euros` in the purse). */
export function rowPrice(row: ShopRow, kit: Kit, pack: Pack, euros: number): { price: number; can: boolean; yours: boolean } {
  if (row.what === 'buy') {
    const price = GEAR[row.kind].price, yours = hasGear(kit, row.kind);
    return { price, can: !yours && euros >= price, yours };
  }
  return { price: row.what === 'find' ? pack.items[row.i].value : resale(pack.spare[row.i]), can: true, yours: false };
}

/** Do `row`: buy it into `kit` from the purse, or sell it out of `pack` into it (`visit`: the how-manieth sale). The purse after, what is said, and whether anything changed hands. */
export function trade(m: Merchant, row: ShopRow, kit: Kit, pack: Pack, euros: number, visit: number): { euros: number; line: string; done: boolean } {
  if (row.what === 'buy') {
    const r = buyGear(kit, row.kind, euros);
    return { ...r, done: r.euros !== euros };
  }
  if (m.buys !== true) return { euros, line: m.buys, done: false };
  const paid = rowPrice(row, kit, pack, euros).price;
  if (row.what === 'find') pack.items.splice(row.i, 1);
  else pack.spare.splice(row.i, 1);
  return { euros: euros + paid, line: ilsePays(paid, 1, visit), done: true };
}

/** Sell every find in the pack at once (spare items stay): the purse after, what is said. */
export function sellFinds(m: Merchant, pack: Pack, euros: number, visit: number): { euros: number; line: string; done: boolean } {
  if (m.buys !== true) return { euros, line: m.buys, done: false };
  if (!pack.items.length) return { euros, line: '', done: false };
  const r = sell(pack, visit);
  return { euros: euros + r.paid, line: r.line, done: true };
}
