import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contactAddress } from '../src/app/contact';

test('the contact address unscrambles to a mail address that is nowhere in the source', () => {
  const a = contactAddress();
  assert.match(a, /^dunfinity@[a-z]+\.de$/);
  assert.ok(!readFileSync('src/app/contact.ts', 'utf8').includes(a.split('@')[1]), 'the domain is not in plain text');
});
