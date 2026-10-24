const test = require('node:test');
const assert = require('node:assert/strict');
const NS = require('./_yukle.js');

const yakin = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} ≈ ${b}`);

test('exifKur → exifOku: alanlar gidiş dönüş', () => {
  const a = NS.exifOku(NS.exifKur(NS.ORNEK_ALANLAR));
  assert.equal(a.make, 'Samsung');
  assert.equal(a.model, 'Galaxy S24');
  assert.equal(a.tarih, '2026:05:14 18:42:07');
  assert.equal(a.seri, 'DEMO-0001');
  assert.equal(a.lens, 'Ana kamera 6.3 mm f/1.8');
  assert.equal(a.sahip, 'Ornek Kisi');
  yakin(a.gps.enlem, 41.025617);
  yakin(a.gps.boylam, 28.974112);
  assert.equal(a.gps.irtifa, 42);
  assert.ok(a.gpsAlani);
});

test('güney ve batı koordinatları eksi, deniz altı irtifa eksi', () => {
  const a = NS.exifOku(NS.exifKur({ gps: { enlem: -33.8568, boylam: -151.2153, irtifa: -3.5 } }));
  yakin(a.gps.enlem, -33.8568);
  yakin(a.gps.boylam, -151.2153);
  assert.equal(a.gps.irtifa, -3.5);
});

test('yalnızca yön taşıyan EXIF: başka hiçbir alan yok', () => {
  const a = NS.exifOku(NS.exifKur({ yon: 6 }));
  assert.equal(a.yon, 6);
  assert.equal(a.make, '');
  assert.equal(a.gps, null);
  assert.ok(!a.gpsAlani);
  assert.equal(a.etiketSayisi, 1);
});

test('küçük bayt sırası (II) de okunur', () => {
  // II, 42, IFD0 @8: tek giriş Orientation(0x0112) SHORT 1 değer 3
  const t = Uint8Array.of(0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0);
  assert.equal(NS.exifOku(t).yon, 3);
});

test('bozuk ya da kısa veri null döner, hata fırlatmaz', () => {
  assert.equal(NS.exifOku(null), null);
  assert.equal(NS.exifOku(Uint8Array.of(1, 2, 3)), null);
  assert.equal(NS.exifOku(new Uint8Array(40)), null);
  // IFD sayısı dosyadan büyük
  const t = Uint8Array.of(0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0xff, 0xff);
  assert.doesNotThrow(() => NS.exifOku(t));
  // değer ofseti dosyanın dışında
  const k = Uint8Array.of(0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x0f, 0, 2, 0, 0, 0, 20, 0, 0, 0xff, 0xff, 0, 0, 0, 0);
  assert.equal(NS.exifOku(k).make, '');
});
