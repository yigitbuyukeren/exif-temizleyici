const test = require('node:test');
const assert = require('node:assert/strict');
const NS = require('./_yukle.js');

test('crc32: bilinen test vektörü', () => {
  assert.equal(NS.crc32(Buffer.from('123456789')), 0xcbf43926);
  assert.equal(NS.crc32(new Uint8Array(0)), 0);
});

test('birlestir ve baslar', () => {
  const b = NS.birlestir([Uint8Array.of(1, 2), Uint8Array.of(), Uint8Array.of(3)]);
  assert.deepEqual([...b], [1, 2, 3]);
  assert.ok(NS.baslar(Buffer.from('xxJFIF\0'), 'JFIF\0', 2));
  assert.ok(!NS.baslar(Buffer.from('JF'), 'JFIF'));
});
