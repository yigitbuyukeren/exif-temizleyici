const test = require('node:test');
const assert = require('node:assert/strict');
const NS = require('./_yukle.js');

test('zipYaz: merkez dizin, CRC ve içerik doğru; Türkçe dosya adı UTF-8', () => {
  const dosyalar = [
    { ad: 'tatil-temiz.jpg', veri: Uint8Array.of(1, 2, 3, 4, 5) },
    { ad: 'şükür-temiz.png', veri: new Uint8Array(0) },
  ];
  const z = Buffer.from(NS.zipYaz(dosyalar));
  const eocd = z.length - 22;
  assert.equal(z.readUInt32LE(eocd), 0x06054b50);
  assert.equal(z.readUInt16LE(eocd + 10), 2);
  let k = z.readUInt32LE(eocd + 16);
  const bulunan = [];
  for (let n = 0; n < 2; n++) {
    assert.equal(z.readUInt32LE(k), 0x02014b50);
    const crc = z.readUInt32LE(k + 16);
    const boyut = z.readUInt32LE(k + 20);
    const adUzun = z.readUInt16LE(k + 28);
    const yerel = z.readUInt32LE(k + 42);
    const ad = z.toString('utf8', k + 46, k + 46 + adUzun);
    assert.equal(z.readUInt32LE(yerel), 0x04034b50);
    const veriBas = yerel + 30 + z.readUInt16LE(yerel + 26);
    const veri = z.subarray(veriBas, veriBas + boyut);
    assert.equal(NS.crc32(veri), crc);
    bulunan.push([ad, [...veri]]);
    k += 46 + adUzun;
  }
  assert.deepEqual(bulunan, [['tatil-temiz.jpg', [1, 2, 3, 4, 5]], ['şükür-temiz.png', []]]);
});

test('zip zamanı sabit (1980-01-01): oluşturma anı sızmaz', () => {
  const z = Buffer.from(NS.zipYaz([{ ad: 'a', veri: Uint8Array.of(1) }]));
  assert.equal(z.readUInt16LE(10), 0);
  assert.equal(z.readUInt16LE(12), 33);
});
