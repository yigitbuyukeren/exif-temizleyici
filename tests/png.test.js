const test = require('node:test');
const assert = require('node:assert/strict');
const NS = require('./_yukle.js');

const IMZA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const p = (tip, veri) => Buffer.from(NS.pngParca(tip, Buffer.from(veri)));
const IHDR = p('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]));
const IDAT = p('IDAT', Buffer.from([0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0, 0, 0, 4, 0, 1]));
const IEND = p('IEND', Buffer.alloc(0));
const png = (...parcalar) => Buffer.concat([IMZA, ...parcalar]);

function parcalarListesi(b) {
  b = Buffer.from(b);
  const liste = [];
  let i = 8;
  while (i + 12 <= b.length) {
    const uzun = b.readUInt32BE(i);
    const tip = b.toString('latin1', i + 4, i + 8);
    const crc = b.readUInt32BE(i + 8 + uzun);
    assert.equal(crc, NS.crc32(b.subarray(i + 4, i + 8 + uzun)), tip + ' CRC doğru olmalı');
    liste.push(tip);
    i += 12 + uzun;
  }
  assert.equal(i, b.length, 'dosya IEND ile bitmeli');
  return liste;
}

test('metin, EXIF ve zaman parçaları silinir; görüntü parçaları aynen kalır', () => {
  const girdi = png(
    IHDR,
    p('sRGB', [0]),
    p('tEXt', Buffer.from('Author\0Ali Veli')),
    p('iTXt', Buffer.concat([Buffer.from('XML:com.adobe.xmp\0'), Buffer.from('<x/>')])),
    p('eXIf', NS.exifKur(NS.ORNEK_ALANLAR)),
    p('tIME', Buffer.alloc(7)),
    IDAT,
    IEND,
    Buffer.from('EK-VERI'),
  );
  const { cikti, rapor } = NS.pngTemizle(girdi);
  assert.deepEqual(parcalarListesi(cikti), ['IHDR', 'sRGB', 'IDAT', 'IEND']);
  assert.deepEqual(rapor.metinAlani, ['Author']);
  assert.ok(rapor.xmp);
  assert.equal(rapor.alanlar.model, 'Galaxy S24');
  assert.equal(rapor.ekVeri, 7);
  assert.ok(rapor.digerler.some((d) => /tIME/.test(d)));
  assert.equal(Buffer.from(cikti).indexOf('Ali Veli'), -1);
  assert.ok(Buffer.from(cikti).includes(IDAT));
});

test('yön korunursa IHDR sonrası tek etiketli eXIf eklenir', () => {
  const girdi = png(IHDR, p('eXIf', NS.exifKur({ ...NS.ORNEK_ALANLAR, yon: 8 })), IDAT, IEND);
  const { cikti } = NS.pngTemizle(girdi, { yonuKoru: true });
  assert.deepEqual(parcalarListesi(cikti), ['IHDR', 'eXIf', 'IDAT', 'IEND']);
  const i = Buffer.from(cikti).indexOf('eXIf') - 4;
  const a = NS.exifOku(cikti.subarray(i + 8, i + 8 + Buffer.from(cikti).readUInt32BE(i)));
  assert.equal(a.yon, 8);
  assert.ok(!NS.hassasVar(NS.pngTemizle(cikti).rapor));
});

test('renk profili (iCCP) seçeneğe göre', () => {
  const girdi = png(IHDR, p('iCCP', Buffer.from('profil\0\0abc')), IDAT, IEND);
  assert.ok(parcalarListesi(NS.pngTemizle(girdi, { renkProfiliKoru: true }).cikti).includes('iCCP'));
  assert.ok(!parcalarListesi(NS.pngTemizle(girdi, { renkProfiliKoru: false }).cikti).includes('iCCP'));
});

test('hareketli PNG parçaları (acTL, fcTL, fdAT) korunur', () => {
  const girdi = png(IHDR, p('acTL', Buffer.alloc(8)), p('fcTL', Buffer.alloc(26)), IDAT, p('fdAT', Buffer.alloc(8)), IEND);
  assert.deepEqual(parcalarListesi(NS.pngTemizle(girdi).cikti), ['IHDR', 'acTL', 'fcTL', 'IDAT', 'fdAT', 'IEND']);
});

test('bozuk PNG hata verir', () => {
  assert.throws(() => NS.pngTemizle(Buffer.from('merhaba dünya')), /PNG/);
  assert.throws(() => NS.pngTemizle(png(IHDR, IDAT)), /eksik/);
  assert.throws(() => NS.pngTemizle(Buffer.concat([IMZA, Buffer.from([0, 0, 0xff, 0xff, 0x49, 0x44, 0x41, 0x54, 0, 0, 0, 0])])), /Bozuk/);
});
