import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestiaryOf, speciesKind, speciesName, SPECIES_SALT } from '../src/creatures/bestiary';
import { Tin } from '../src/loot/tin';

test('every cave animal species has a field-notes name, the same each time, mostly different from its neighbours', () => {
  const names: string[] = [];
  for (let depth = 1; depth <= 12; depth++) {
    for (const sp of bestiaryOf(7, depth)) {
      const n = speciesName(sp);
      assert.equal(n, speciesName(bestiaryOf(7, depth).find((s) => s.id === sp.id)!));
      assert.match(n, /^[a-z][a-z -]+$/, n);
      names.push(n);
    }
  }
  assert.ok(new Set(names).size >= names.length * 0.4, `${new Set(names).size} names for ${names.length} species`);
});

test('each species pays its own first-kill salt, so a new animal is worth hunting', () => {
  const [a, b] = bestiaryOf(7, 4);
  const tin = new Tin();
  const first = tin.killed(speciesKind(a), speciesName(a), SPECIES_SALT[a.role])!;
  assert.equal(first.amount, SPECIES_SALT[a.role]);
  assert.match(first.why, new RegExp(speciesName(a)));
  const other = tin.killed(speciesKind(b), speciesName(b), SPECIES_SALT[b.role])!;
  assert.equal(other.amount, SPECIES_SALT[b.role], 'another species is a first again');
});
