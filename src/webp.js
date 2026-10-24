// WebP (RIFF) temizleyici: EXIF ve XMP parçalarını atar, VP8X bayraklarını buna göre düzeltir.
(function (root) {
  'use strict';
  const NS = (root.ExifTemizleyici = root.ExifTemizleyici || {});

  const BAYRAK = { icc: 0x20, exif: 0x08, xmp: 0x04 };

  function webpTemizle(b, sec) {
    const o = sec || {};
    const yonuKoru = o.yonuKoru !== false;
    const iccKoru = o.renkProfiliKoru !== false;
    if (b.length < 12 || !NS.baslar(b, 'RIFF') || !NS.baslar(b, 'WEBP', 8)) throw new Error('Geçerli bir WebP dosyası değil.');

    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const bitis = Math.min(b.length, 8 + dv.getUint32(4, true));
    const rapor = NS.bosRapor();
    const parcalar = [];
    let vp8x = -1;
    let i = 12;

    while (i + 8 <= bitis) {
      const tip = NS.ascii(b, i, i + 4);
      const uzun = dv.getUint32(i + 4, true);
      const son = i + 8 + uzun + (uzun & 1);
      if (i + 8 + uzun > bitis) throw new Error('Bozuk WebP yapısı.');
      const veri = b.subarray(i + 8, i + 8 + uzun);
      const tam = b.subarray(i, Math.min(son, bitis));

      if (tip === 'EXIF') {
        const t = NS.baslar(veri, 'Exif\0\0') ? veri.subarray(6) : veri;
        const a = NS.exifOku(t);
        if (a && !rapor.alanlar) rapor.alanlar = a;
      } else if (tip === 'XMP ') {
        rapor.xmp = true;
      } else if (tip === 'ICCP') {
        rapor.icc = true;
        if (iccKoru) parcalar.push(tam);
      } else {
        if (tip === 'VP8X') { vp8x = parcalar.length; parcalar.push(tam.slice()); } else parcalar.push(tam);
      }
      i = son;
    }
    if (i < b.length) rapor.ekVeri = b.length - Math.min(i, b.length);

    const yon = rapor.alanlar ? rapor.alanlar.yon : 1;
    const yonYaz = yonuKoru && yon > 1 && yon <= 8 && vp8x >= 0;
    if (vp8x >= 0) {
      const bayrak = parcalar[vp8x];
      bayrak[8] &= ~(BAYRAK.exif | BAYRAK.xmp);
      if (!iccKoru) bayrak[8] &= ~BAYRAK.icc;
      if (yonYaz) bayrak[8] |= BAYRAK.exif;
    }
    if (yonYaz) {
      const tiff = NS.exifKur({ yon });
      const baslik = new Uint8Array(8);
      baslik.set([0x45, 0x58, 0x49, 0x46]); // "EXIF"
      new DataView(baslik.buffer).setUint32(4, tiff.length, true);
      parcalar.push(baslik, tiff, new Uint8Array(tiff.length & 1));
    }

    const govde = NS.birlestir(parcalar);
    const ust = new Uint8Array(12);
    ust.set([0x52, 0x49, 0x46, 0x46]);
    new DataView(ust.buffer).setUint32(4, 4 + govde.length, true);
    ust.set([0x57, 0x45, 0x42, 0x50], 8);
    return { cikti: NS.birlestir([ust, govde]), rapor };
  }

  NS.webpTemizle = webpTemizle;
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(globalThis);
