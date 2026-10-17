import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/gen/level';
import { daylightAt } from '../src/gen/cellar';
import { HOUSES, SHOP, TOWN, shopAir, shopDoor, shopKeeper, shopRoom, type Shop } from '../src/gen/town';
import { PropBuilder, local } from '../src/gen/propMesh';
import { furnishTown } from '../src/gen/townProps';
import { KEEPER, Shopkeeper } from '../src/world/shopkeeper';
import { quarryProps } from '../src/gen/quarryProps';
import { Blockers } from '../src/world/blockers';
import { Body } from '../src/world/traverse/body';

const SHOPS: readonly Shop[] = ['hardware', 'pawn'];
const level = new Level(1, 0);
const house = (shop: Shop) => HOUSES.find((h) => h.role === shop)!;
/** A point (x, z) in the shop's house frame. */
const at = (shop: Shop, u: number, v: number): [number, number] => { const H = house(shop); return local(H.cx, H.cz, H.yaw)(u, v); };

test('each shop is a room one walks into from the street, through its open door, up to the counter', () => {
  for (const shop of SHOPS) {
    const H = house(shop), R = shopRoom(H), front = R.v0 + SHOP.counter.at + SHOP.counter.deep + 0.4;
    for (let v = H.hv + 1; v >= front; v -= 0.25) {
      const [x, z] = at(shop, H.door, v);
      assert.ok(level.sdf(x, TOWN.ground + 1, z) > 0.25, `${shop}: air from the street to the counter (v ${v.toFixed(2)})`);
    }
    const [bx, bz] = at(shop, H.door, R.v0 - 0.5);
    assert.ok(level.sdf(bx, TOWN.ground + 1, bz) < 0, `${shop}: the house behind the room is solid`);
    const [sx, sz] = at(shop, H.door + 1.4, H.hv - SHOP.lining / 2);
    assert.ok(level.sdf(sx, TOWN.ground + 1, sz) < 0, `${shop}: the front wall stands either side of the door`);
    const [cx, cz] = at(shop, 0, (R.v0 + R.v1) / 2);
    assert.ok(shopAir(cx, TOWN.ground + 1, cz) > 0 && daylightAt(cx, TOWN.ground + 1, cz) > 0, `${shop}: the day reaches in`);
  }
});

test('the keeper stands behind the counter, facing the door, and one deals with them across it', () => {
  const blocks: number[][] = [];
  const b = () => new PropBuilder();
  furnishTown({ solid: b(), glow: b(), house: b(), inTile: () => true, light: () => {}, block: (...a) => { blocks.push(a); } });
  for (const shop of SHOPS) {
    const H = house(shop), R = shopRoom(H), k = new Shopkeeper(shop), spot = shopKeeper(shop), d = shopDoor(shop);
    assert.ok(level.sdf(k.x, k.y + 1, k.z) > 0.25, `${shop}: the keeper stands in the air`);
    assert.ok(Math.abs(spot.yaw - Math.atan2(-d.nx, -d.nz)) < 0.01 || Math.abs(Math.abs(spot.yaw - Math.atan2(-d.nx, -d.nz)) - 2 * Math.PI) < 0.01, `${shop}: facing out`);
    const [fx, fz] = at(shop, H.door, R.v0 + SHOP.counter.at + SHOP.counter.deep + 0.35);
    assert.ok(k.canHear(fx, TOWN.ground, fz), `${shop}: heard from the front of the counter`);
    assert.ok(!k.canHear(d.x, TOWN.ground, d.z), `${shop}: not from the street`);
    // Something in the way between customer and keeper: the counter.
    const [mx, mz] = at(shop, H.door + 0.3, R.v0 + SHOP.counter.at);
    assert.ok(blocks.some(([x, z, yaw, hx, hz, y0, y1]) => {
      const c = Math.cos(yaw), s = Math.sin(yaw), lx = mx - x, lz = mz - z, a = lx * c - lz * s, f = lx * s + lz * c;
      return Math.abs(a) <= hx && Math.abs(f) <= hz && y0 <= TOWN.ground + 0.1 && y1 >= TOWN.ground + 0.9;
    }), `${shop}: the counter blocks the way`);
  }
});

test('keepers talk in turn when called on, and with their hands over a deal', () => {
  for (const shop of SHOPS) {
    const k = new Shopkeeper(shop), said = new Set<string>();
    for (let i = 0; i < 5; i++) said.add(k.talk(i * 10));
    assert.equal(said.size, 5);
    assert.ok(k.talking(40 + KEEPER.talk - 0.1) && !k.talking(40 + KEEPER.talk + 0.1));
    k.deal(100);
    assert.ok(k.talking(100.5));
  }
});

test('a body walks in off the street, through the door, up to the counter (no invisible wall at the threshold)', () => {
  const blockers = new Blockers();
  for (let tz = -2; tz <= 1; tz++) for (let tx = -2; tx <= 0; tx++) blockers.set(`${tx},${tz}`, quarryProps(level, tx, tz).blockers);
  for (const shop of SHOPS) {
    const H = house(shop), R = shopRoom(H), [sx, sz] = at(shop, H.door, H.hv + 2), want = R.v0 + SHOP.counter.at + SHOP.counter.deep + 0.45;
    const [tx, tz] = at(shop, H.door, want);
    const b = new Body(sx, TOWN.ground, sz), dt = 1 / 120;
    for (let t = 0; t < 10 && Math.hypot(tx - b.x, tz - b.z) > 0.15; t += dt) {
      b.step(level, { forward: 1, right: 0, yaw: Math.atan2(-(tx - b.x), -(tz - b.z)), sprint: false, jump: false }, dt, blockers);
    }
    assert.ok(Math.hypot(tx - b.x, tz - b.z) < 0.3, `${shop}: stopped ${Math.hypot(tx - b.x, tz - b.z).toFixed(2)} m short of the counter`);
  }
});
