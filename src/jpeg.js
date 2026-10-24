// JPEG'i yeniden sıkıştırmadan temizler: bölümleri (segment) tek tek gezer, kimlik taşıyanları atar,
// görüntü verisine (SOS ve sonrası) hiç dokunmaz. Piksel birebir aynı kalır.
(function (root) {
  'use strict';
  const NS = (root.ExifTemizleyici = root.ExifTemizleyici || {});

  function app1(yuk) {
    const uzun = yuk.length + 2;
    if (uzun > 0xffff) throw new Error('Bölüm çok büyük.');
    return NS.birlestir([Uint8Array.of(0xff, 0xe1, uzun >> 8, uzun & 255), yuk]);
  }

  // sec: { yonuKoru (varsayılan true), renkProfiliKoru (varsayılan true) }
  function jpegTemizle(b, sec) {
    const o = sec || {};
    const yonuKoru = o.yonuKoru !== false;
    const iccKoru = o.renkProfiliKoru !== false;
    if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw new Error('Geçerli bir JPEG dosyası değil.');

    const rapor = NS.bosRapor();
    const parcalar = [b.subarray(0, 2)];
    let yerlesim = 1; // yön bölümü SOI'den (ve varsa JFIF'ten) hemen sonra girer
    let i = 2;
    let bitti = false;

    while (i < b.length) {
      if (b[i] !== 0xff) throw new Error('Bozuk JPEG yapısı.');
      while (i + 1 < b.length && b[i + 1] === 0xff) i++;
      if (i + 1 >= b.length) break;
      const m = b[i + 1];
      if (m === 0xd9) { parcalar.push(b.subarray(i, i + 2)); i += 2; bitti = true; break; }
      if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { parcalar.push(b.subarray(i, i + 2)); i += 2; continue; }
      if (i + 4 > b.length) throw new Error('Bozuk JPEG yapısı.');
      const uzun = (b[i + 2] << 8) | b[i + 3];
      const son = i + 2 + uzun;
      if (uzun < 2 || son > b.length) throw new Error('Bozuk JPEG yapısı.');
      const seg = b.subarray(i, son);
      const yuk = b.subarray(i + 4, son);

      if (m === 0xda) {
        // tarama başlığı + sıkıştırılmış veri: bir sonraki gerçek işaretçiye kadar aynen kopyala
        let j = son;
        while (j < b.length) {
          if (b[j] === 0xff) {
            const n = b[j + 1];
            if (n !== 0x00 && !(n >= 0xd0 && n <= 0xd7)) break;
          }
          j++;
        }
        parcalar.push(b.subarray(i, j));
        i = j;
        continue;
      }

      if (m === 0xfe) {
        rapor.yorum = true;
        i = son;
        continue;
      }

      if (m >= 0xe0 && m <= 0xef) {
        if (m === 0xe0 && NS.baslar(yuk, 'JFIF\0')) {
          // küçük resmi (varsa) at, gerisini koru
          if (seg.length > 18) {
            const jfif = seg.slice(0, 18);
            jfif[2] = 0; jfif[3] = 16; jfif[16] = 0; jfif[17] = 0;
            parcalar.push(jfif);
            rapor.digerler.push('JFIF küçük resmi');
          } else parcalar.push(seg);
          yerlesim = parcalar.length;
        } else if (m === 0xe0) {
          rapor.digerler.push('JFXX uzantısı (küçük resim)');
        } else if (m === 0xe1 && NS.baslar(yuk, 'Exif\0\0')) {
          const a = NS.exifOku(yuk.subarray(6));
          if (a && !rapor.alanlar) rapor.alanlar = a;
        } else if (m === 0xe1 && NS.baslar(yuk, 'http://ns.adobe.com/xap/1.0/\0')) {
          rapor.xmp = true;
        } else if (m === 0xe1 && NS.baslar(yuk, 'http://ns.adobe.com/xmp/extension/\0')) {
          rapor.xmp = true;
        } else if (m === 0xe2 && NS.baslar(yuk, 'ICC_PROFILE\0')) {
          rapor.icc = true;
          if (iccKoru) parcalar.push(seg);
        } else if (m === 0xe2 && NS.baslar(yuk, 'MPF\0')) {
          rapor.digerler.push('Çoklu resim (MPF) verisi');
        } else if (m === 0xed) {
          rapor.iptc = true;
        } else if (m === 0xee && NS.baslar(yuk, 'Adobe')) {
          parcalar.push(seg); // renk dönüşümü bilgisi: görüntünün doğru açılması için gerekli
        } else {
          rapor.digerler.push('Ek meta veri (APP' + (m - 0xe0) + ')');
        }
        i = son;
        continue;
      }

      parcalar.push(seg);
      i = son;
    }

    if (!bitti) throw new Error('JPEG dosyası eksik görünüyor.');
    if (i < b.length) rapor.ekVeri = b.length - i;
    if (rapor.alanlar && rapor.alanlar.kucukResim) rapor.digerler.push('Gömülü küçük resim');

    const yon = rapor.alanlar ? rapor.alanlar.yon : 1;
    if (yonuKoru && yon > 1 && yon <= 8) {
      parcalar.splice(yerlesim, 0, app1(NS.exifApp1Yuk(NS.exifKur({ yon }))));
    }
    return { cikti: NS.birlestir(parcalar), rapor };
  }

  NS.jpegTemizle = jpegTemizle;
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(globalThis);
