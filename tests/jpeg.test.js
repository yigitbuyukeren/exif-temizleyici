const test = require('node:test');
const assert = require('node:assert/strict');
const NS = require('./_yukle.js');

const seg = (m, yuk) => Buffer.concat([Buffer.from([0xff, m, (yuk.length + 2) >> 8, (yuk.length + 2) & 255]), Buffer.from(yuk)]);
const app1 = (yuk) => seg(0xe1, yuk);
const exifYuk = (alan) => Buffer.concat([Buffer.from('Exif\0\0'), Buffer.from(NS.exifKur(alan))]);

// SOF/SOS içeriği anlamsız ama yapı geçerli: işaretçi gezintisini sınar
const TARAMA1 = Buffer.from([0x12, 0xff, 0x00, 0xff, 0xd0, 0x34, 0xff, 0x00]); // doldurma ve RST içerir
const TARAMA2 = Buffer.from([0x56, 0x78]);
function sahteJpeg(ekler, sonrasi) {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from('JFIF\0\x01\x01\x00\x00\x01\x00\x01\x00\x00')),
    ...ekler,
    seg(0xdb, Buffer.alloc(65)),
    seg(0xc2, Buffer.from([8, 0, 8, 0, 8, 1, 1, 0x11, 0])),
    seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])), TARAMA1,
    seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])), TARAMA2,
    Buffer.from([0xff, 0xd9]),
    sonrasi || Buffer.alloc(0),
  ]);
}
const ara = (b, ...d) => Buffer.from(b).indexOf(Buffer.from(d));

test('EXIF, XMP, IPTC ve yorum silinir; görüntü verisi bayt bayt aynı kalır', () => {
  const girdi = sahteJpeg([
    app1(exifYuk(NS.ORNEK_ALANLAR)),
    app1(Buffer.from('http://ns.adobe.com/xap/1.0/\0<x/>')),
    seg(0xed, Buffer.from('Photoshop 3.0\0abc')),
    seg(0xfe, Buffer.from('gizli yorum')),
  ]);
  const { cikti, rapor } = NS.jpegTemizle(girdi);
  assert.equal(ara(cikti, 0x45, 0x78, 0x69, 0x66), -1, 'Exif imzası kalmamalı');
  assert.equal(ara(cikti, 0x61, 0x64, 0x6f, 0x62, 0x65), -1, 'XMP kalmamalı');
  assert.equal(ara(cikti, ...Buffer.from('gizli yorum')), -1);
  assert.ok(rapor.xmp && rapor.iptc && rapor.yorum);
  assert.equal(rapor.alanlar.model, 'Galaxy S24');
  assert.ok(NS.hassasVar(rapor));
  // SOS'tan itibaren (görüntü verisi) birebir aynı
  const sos = (b) => Buffer.from(b).subarray(Buffer.from(b).indexOf(Buffer.from([0xff, 0xda])));
  assert.deepEqual(sos(cikti), sos(girdi));
  // ve çıktı tekrar temizlendiğinde hassas bir şey bulunmaz
  assert.ok(!NS.hassasVar(NS.jpegTemizle(cikti).rapor));
});

test('yön korunur: tek etiketli EXIF kalır; kapatılırsa hiç EXIF kalmaz', () => {
  const girdi = sahteJpeg([app1(exifYuk({ ...NS.ORNEK_ALANLAR, yon: 6 }))]);
  const kor = NS.jpegTemizle(girdi, { yonuKoru: true });
  const a = NS.exifOku(Buffer.from(kor.cikti).subarray(ara(kor.cikti, 0x45, 0x78, 0x69, 0x66, 0, 0) + 6));
  assert.equal(a.yon, 6);
  assert.equal(a.etiketSayisi, 1);
  assert.ok(!NS.hassasVar(NS.jpegTemizle(kor.cikti).rapor), 'yalnızca yön hassas sayılmaz');
  const atla = NS.jpegTemizle(girdi, { yonuKoru: false });
  assert.equal(ara(atla.cikti, 0x45, 0x78, 0x69, 0x66), -1);
});

test('yön 1 ise hiç EXIF eklenmez', () => {
  const { cikti } = NS.jpegTemizle(sahteJpeg([app1(exifYuk({ yon: 1, make: 'X' }))]));
  assert.equal(ara(cikti, 0x45, 0x78, 0x69, 0x66), -1);
});

test('renk profili seçeneğe göre korunur ya da atılır', () => {
  const girdi = sahteJpeg([seg(0xe2, Buffer.concat([Buffer.from('ICC_PROFILE\0\x01\x01'), Buffer.alloc(20)]))]);
  assert.notEqual(ara(NS.jpegTemizle(girdi, { renkProfiliKoru: true }).cikti, ...Buffer.from('ICC_PROFILE')), -1);
  assert.equal(ara(NS.jpegTemizle(girdi, { renkProfiliKoru: false }).cikti, ...Buffer.from('ICC_PROFILE')), -1);
  assert.ok(NS.jpegTemizle(girdi).rapor.icc);
  assert.ok(!NS.hassasVar(NS.jpegTemizle(girdi).rapor), 'renk profili kimlik bilgisi sayılmaz');
});

test('Adobe APP14 (renk dönüşümü) korunur', () => {
  const girdi = sahteJpeg([seg(0xee, Buffer.from('Adobe\0\x64\x80\x00\x00\x00\x00\x01'))]);
  assert.notEqual(ara(NS.jpegTemizle(girdi).cikti, ...Buffer.from('Adobe')), -1);
});

test('JFIF küçük resmi atılır, başlık aynen kalır', () => {
  const jfif = seg(0xe0, Buffer.concat([Buffer.from('JFIF\0\x01\x01\x00\x00\x01\x00\x01\x02\x02'), Buffer.alloc(12, 7)]));
  const girdi = Buffer.concat([Buffer.from([0xff, 0xd8]), jfif, seg(0xc0, Buffer.from([8, 0, 8, 0, 8, 1, 1, 0x11, 0])), seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])), TARAMA2, Buffer.from([0xff, 0xd9])]);
  const { cikti, rapor } = NS.jpegTemizle(girdi);
  assert.equal(cikti[4], 0); // uzunluk alanı: 16
  assert.equal(cikti[5], 16);
  assert.equal(cikti[18], 0); // küçük resim genişlik ve yükseklik
  assert.equal(cikti[19], 0);
  assert.ok(rapor.digerler.some((d) => /JFIF/.test(d)));
  assert.equal(ara(cikti, 7, 7, 7), -1);
});

test('EOI sonrası eklenmiş veri (örn. gömülü video) atılır ve raporlanır', () => {
  const girdi = sahteJpeg([], Buffer.from('GIZLI-VIDEO-VERISI'));
  const { cikti, rapor } = NS.jpegTemizle(girdi);
  assert.equal(rapor.ekVeri, 18);
  assert.deepEqual([...cikti.subarray(cikti.length - 2)], [0xff, 0xd9]);
  assert.equal(ara(cikti, ...Buffer.from('GIZLI')), -1);
  assert.ok(NS.hassasVar(rapor));
});

test('MPF ve bilinmeyen APPn bölümleri atılır', () => {
  const girdi = sahteJpeg([seg(0xe2, Buffer.from('MPF\0abcd')), seg(0xeb, Buffer.from('JUMBFc2pa'))]);
  const { cikti, rapor } = NS.jpegTemizle(girdi);
  assert.equal(ara(cikti, ...Buffer.from('MPF')), -1);
  assert.equal(ara(cikti, ...Buffer.from('c2pa')), -1);
  assert.equal(rapor.digerler.length, 2);
});

test('geçersiz girdiler anlaşılır hata verir', () => {
  assert.throws(() => NS.jpegTemizle(Buffer.from('merhaba')), /JPEG/);
  assert.throws(() => NS.jpegTemizle(Buffer.from([0xff, 0xd8, 0x00, 0x00])), /Bozuk/);
  assert.throws(() => NS.jpegTemizle(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0, 0])), /Bozuk/);
  assert.throws(() => NS.jpegTemizle(sahteJpeg([]).subarray(0, 40)), /Bozuk|eksik/);
});

test('örnek fotoğraf: gerçek JPEG, konum içerir, temizlenince boşalır, EXIF dışı bayt değişmez', () => {
  const foto = NS.ornekFoto();
  const { cikti, rapor } = NS.temizle(foto, {});
  assert.ok(rapor.alanlar.gps && rapor.xmp);
  assert.ok(!NS.hassasVar(NS.temizle(cikti, {}).rapor));
  const sos = (b) => Buffer.from(b).subarray(Buffer.from(b).indexOf(Buffer.from([0xff, 0xda])));
  assert.deepEqual(sos(cikti), sos(foto));
});
