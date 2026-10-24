// Küçük ortak yardımcılar: CRC32, bayt birleştirme, bayt dizisi karşılaştırma ve boş rapor.
(function (root) {
  'use strict';
  const NS = (root.ExifTemizleyici = root.ExifTemizleyici || {});

  const TABLO = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bayt) {
    let c = 0xffffffff;
    for (let i = 0; i < bayt.length; i++) c = TABLO[(c ^ bayt[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function birlestir(parcalar) {
    let n = 0;
    for (const p of parcalar) n += p.length;
    const cikti = new Uint8Array(n);
    let k = 0;
    for (const p of parcalar) { cikti.set(p, k); k += p.length; }
    return cikti;
  }

  // bayt dizisi, konumdan başlayarak ASCII önekle başlıyor mu?
  function baslar(bayt, onek, konum) {
    const k = konum || 0;
    if (k + onek.length > bayt.length) return false;
    for (let i = 0; i < onek.length; i++) if (bayt[k + i] !== onek.charCodeAt(i)) return false;
    return true;
  }

  function ascii(bayt, bas, son) {
    let s = '';
    for (let i = bas; i < son; i++) s += String.fromCharCode(bayt[i]);
    return s;
  }

  // Tüm biçimlerin ortak raporu: dosyada neler bulundu?
  function bosRapor() {
    return {
      alanlar: null,      // EXIF'ten okunan alanlar (exif.js)
      xmp: false,
      iptc: false,
      yorum: false,
      icc: false,         // renk profili var (silinmesi seçeneğe bağlı, kimlik bilgisi sayılmaz)
      metinAlani: [],     // PNG metin parçalarının anahtar adları
      digerler: [],       // başka gizli veri açıklamaları
      ekVeri: 0,          // dosya bitişinden sonra eklenmiş bayt sayısı
    };
  }

  Object.assign(NS, { crc32, birlestir, baslar, ascii, bosRapor });
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(globalThis);
