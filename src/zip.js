// Birden çok temiz fotoğrafı tek .zip olarak indirmek için "saklı" (sıkıştırmasız) zip yazıcı.
// Fotoğraflar zaten sıkıştırılmış olduğundan sıkıştırma gereksiz; bağımlılık yok.
(function (root) {
  'use strict';
  const NS = (root.ExifTemizleyici = root.ExifTemizleyici || {});

  const DOS_TARIH = (1 << 5) | 1; // 1980-01-01: zip'in kendisi de zaman bilgisi sızdırmasın
  const DOS_SAAT = 0;

  // dosyalar: [{ ad, veri: Uint8Array }]
  function zipYaz(dosyalar) {
    const enc = new TextEncoder();
    const yerel = [];
    const merkez = [];
    let konum = 0;

    for (const d of dosyalar) {
      const ad = enc.encode(d.ad);
      const crc = NS.crc32(d.veri);
      const y = new Uint8Array(30 + ad.length);
      const dv = new DataView(y.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true); // UTF-8 dosya adı
      dv.setUint16(8, 0, true);      // yöntem: saklı
      dv.setUint16(10, DOS_SAAT, true);
      dv.setUint16(12, DOS_TARIH, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, d.veri.length, true);
      dv.setUint32(22, d.veri.length, true);
      dv.setUint16(26, ad.length, true);
      y.set(ad, 30);

      const m = new Uint8Array(46 + ad.length);
      const mv = new DataView(m.buffer);
      mv.setUint32(0, 0x02014b50, true);
      mv.setUint16(4, 20, true);
      mv.setUint16(6, 20, true);
      mv.setUint16(8, 0x0800, true);
      mv.setUint16(10, 0, true);
      mv.setUint16(12, DOS_SAAT, true);
      mv.setUint16(14, DOS_TARIH, true);
      mv.setUint32(16, crc, true);
      mv.setUint32(20, d.veri.length, true);
      mv.setUint32(24, d.veri.length, true);
      mv.setUint16(28, ad.length, true);
      mv.setUint32(42, konum, true);
      m.set(ad, 46);

      yerel.push(y, d.veri);
      merkez.push(m);
      konum += y.length + d.veri.length;
    }

    const merkezBoyut = merkez.reduce((n, m) => n + m.length, 0);
    const son = new Uint8Array(22);
    const sv = new DataView(son.buffer);
    sv.setUint32(0, 0x06054b50, true);
    sv.setUint16(8, dosyalar.length, true);
    sv.setUint16(10, dosyalar.length, true);
    sv.setUint32(12, merkezBoyut, true);
    sv.setUint32(16, konum, true);
    return NS.birlestir([...yerel, ...merkez, son]);
  }

  NS.zipYaz = zipYaz;
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(globalThis);
