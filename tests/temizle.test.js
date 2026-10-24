const test = require('node:test');
const assert = require('node:assert/strict');
const NS = require('./_yukle.js');

test('bicimBul: imzaya bakar, uzantıya değil', () => {
  assert.equal(NS.bicimBul(NS.ornekFoto()), 'jpeg');
  assert.equal(NS.bicimBul(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'png');
  assert.equal(NS.bicimBul(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
  assert.equal(NS.bicimBul(Buffer.from('GIF89a......')), null);
  assert.equal(NS.bicimBul(new Uint8Array(0)), null);
});

test('temizle: desteklenmeyen biçim anlaşılır hata verir', () => {
  assert.throws(() => NS.temizle(Buffer.from('GIF89a......'), {}), /doğrudan temizlenemiyor/);
});

test('temizle: sonuç türü ve uzantısı', () => {
  const s = NS.temizle(NS.ornekFoto(), {});
  assert.equal(s.bicim, 'jpeg');
  assert.equal(s.uzanti, 'jpg');
  assert.equal(s.tur, 'image/jpeg');
  assert.ok(s.cikti.length < NS.ornekFoto().length);
});

test('ozetle: konum, cihaz ve ağır işaretleri', () => {
  const ozet = NS.ozetle(NS.temizle(NS.ornekFoto(), {}).rapor);
  const konum = ozet.find((x) => x.baslik.startsWith('Konum'));
  assert.ok(konum.agir);
  assert.match(konum.deger, /^41\.02562, 28\.97411 \(42 m\)$/);
  assert.equal(ozet.find((x) => x.baslik === 'Cihaz').deger, 'Samsung Galaxy S24');
  assert.equal(ozet.find((x) => x.baslik === 'Çekim zamanı').deger, '2026-05-14 18:42:07');
  assert.ok(ozet.some((x) => x.baslik === 'XMP'));
});

test('ozetle: temiz dosyada liste boş', () => {
  const temiz = NS.temizle(NS.temizle(NS.ornekFoto(), {}).cikti, {});
  assert.deepEqual(NS.ozetle(temiz.rapor), []);
});

test('kb: okunur boyut', () => {
  assert.equal(NS.kb(500), '500 bayt');
  assert.equal(NS.kb(2048), '2,0 KB');
  assert.equal(NS.kb(20480), '20 KB');
});
