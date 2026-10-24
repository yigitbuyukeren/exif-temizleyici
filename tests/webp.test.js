const test = require('node:test');
const assert = require('node:assert/strict');
const NS = require('./_yukle.js');

function parca(tip, veri) {
  const b = Buffer.alloc(8);
  b.write(tip, 0, 'latin1');
  b.writeUInt32LE(veri.length, 4);
  return Buffer.concat([b, Buffer.from(veri), Buffer.alloc(veri.length & 1)]);
}
function webp(...parcalar) {
  const govde = Buffer.concat([Buffer.from('WEBP'), ...parcalar]);
  const ust = Buffer.alloc(8);
  ust.write('RIFF', 0, 'latin1');
  ust.writeUInt32LE(govde.length, 4);
  return Buffer.concat([ust, govde]);
}
const vp8x = (bayrak) => parca('VP8X', Buffer.from([bayrak, 0, 0, 0, 7, 0, 0, 7, 0, 0]));
const VP8 = parca('VP8 ', Buffer.from([1, 2, 3, 4, 5]));

function listele(b) {
  b = Buffer.from(b);
  const l = [];
  assert.equal(b.readUInt32LE(4), b.length - 8, 'RIFF boyutu doğru olmalı');
  let i = 12;
  while (i < b.length) {
    l.push(b.toString('latin1', i, i + 4));
    const n = b.readUInt32LE(i + 4);
    i += 8 + n + (n & 1);
  }
  assert.equal(i, b.length);
  return l;
}

test('EXIF ve XMP parçaları atılır, VP8X bayrakları temizlenir', () => {
  const girdi = webp(vp8x(0x08 | 0x04 | 0x10), VP8, parca('EXIF', NS.exifKur(NS.ORNEK_ALANLAR)), parca('XMP ', Buffer.from('<x/>')));
  const { cikti, rapor } = NS.webpTemizle(girdi, { yonuKoru: false });
  assert.deepEqual(listele(cikti), ['VP8X', 'VP8 ']);
  assert.equal(cikti[20], 0x10, 'yalnızca alfa bayrağı kalmalı');
  assert.equal(rapor.alanlar.gps.irtifa, 42);
  assert.ok(rapor.xmp);
  assert.ok(!NS.hassasVar(NS.webpTemizle(cikti).rapor));
});

test('yön korunur: EXIF parçası tek etiketle yeniden eklenir ve bayrak açılır', () => {
  const girdi = webp(vp8x(0x08), VP8, parca('EXIF', NS.exifKur({ ...NS.ORNEK_ALANLAR, yon: 3 })));
  const { cikti } = NS.webpTemizle(girdi, { yonuKoru: true });
  assert.deepEqual(listele(cikti), ['VP8X', 'VP8 ', 'EXIF']);
  assert.equal(cikti[20] & 0x08, 0x08);
  const son = Buffer.from(cikti);
  const i = son.indexOf('EXIF');
  const a = NS.exifOku(cikti.subarray(i + 8, i + 8 + son.readUInt32LE(i + 4)));
  assert.equal(a.yon, 3);
  assert.equal(a.make, '');
});

test('"Exif\\0\\0" önekli EXIF parçası da okunur', () => {
  const girdi = webp(vp8x(0x08), VP8, parca('EXIF', Buffer.concat([Buffer.from('Exif\0\0'), Buffer.from(NS.exifKur({ make: 'Z', yon: 1 }))])));
  assert.equal(NS.webpTemizle(girdi).rapor.alanlar.make, 'Z');
});

test('basit WebP (VP8X yok) olduğu gibi kalır; hareketli WebP parçaları korunur', () => {
  assert.deepEqual(listele(NS.webpTemizle(webp(VP8)).cikti), ['VP8 ']);
  const anim = webp(vp8x(0x02), parca('ANIM', Buffer.alloc(6)), parca('ANMF', Buffer.alloc(16)), parca('EXIF', NS.exifKur({ make: 'Z' })));
  const { cikti } = NS.webpTemizle(anim, { yonuKoru: false });
  assert.deepEqual(listele(cikti), ['VP8X', 'ANIM', 'ANMF']);
  assert.equal(cikti[20], 0x02);
});

test('bozuk WebP hata verir', () => {
  assert.throws(() => NS.webpTemizle(Buffer.from('RIFFxxxxWAVE')), /WebP/);
  const kisa = webp(VP8);
  assert.throws(() => NS.webpTemizle(kisa.subarray(0, kisa.length - 3)), /Bozuk/);
});

test('bilinmeyen parçalar atılır ve raporlanır', () => {
  const b = webp(vp8x(0), parca('ABCD', [1, 2, 3]), VP8);
  const s = NS.webpTemizle(new Uint8Array(b), {});
  assert.deepEqual(listele(s.cikti), ['VP8X', 'VP8 ']);
  assert.ok(s.rapor.digerler.some((d) => /ABCD/.test(d)));
});
