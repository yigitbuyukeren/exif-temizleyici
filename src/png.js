// PNG'yi yeniden kodlamadan temizler: görüntü ve renk parçalarını aynen bırakır,
// metin (tEXt, zTXt, iTXt), EXIF (eXIf) ve zaman (tIME) parçalarını atar.
(function (root) {
  'use strict';
  const NS = (root.ExifTemizleyici = root.ExifTemizleyici || {});

  const IMZA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  // aynen korunan parçalar (iCCP ayrıca seçeneğe bağlı)
  const KORU = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'sBIT', 'bKGD', 'hIST', 'pHYs', 'acTL', 'fcTL', 'fdAT']);

  function parca(tip, veri) {
    const ust = new Uint8Array(8 + veri.length);
    const dv = new DataView(ust.buffer);
    dv.setUint32(0, veri.length);
    for (let i = 0; i < 4; i++) ust[4 + i] = tip.charCodeAt(i);
    ust.set(veri, 8);
    const crc = new Uint8Array(4);
    new DataView(crc.buffer).setUint32(0, NS.crc32(ust.subarray(4)));
    return NS.birlestir([ust, crc]);
  }

  function anahtar(veri) {
    let s = '';
    for (let i = 0; i < veri.length && i < 80 && veri[i] !== 0; i++) s += String.fromCharCode(veri[i]);
    return s;
  }

  function pngTemizle(b, sec) {
    const o = sec || {};
    const yonuKoru = o.yonuKoru !== false;
    const iccKoru = o.renkProfiliKoru !== false;
    if (b.length < 8 || IMZA.some((v, k) => b[k] !== v)) throw new Error('Geçerli bir PNG dosyası değil.');

    const rapor = NS.bosRapor();
    const parcalar = [b.subarray(0, 8)];
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let yerlesim = 1;
    let i = 8;
    let bitti = false;

    while (i + 12 <= b.length) {
      const uzun = dv.getUint32(i);
      const son = i + 12 + uzun;
      if (son > b.length) throw new Error('Bozuk PNG yapısı.');
      const tip = NS.ascii(b, i + 4, i + 8);
      const veri = b.subarray(i + 8, i + 8 + uzun);

      if (KORU.has(tip) || (tip === 'iCCP' && iccKoru)) {
        parcalar.push(b.subarray(i, son));
        if (tip === 'IHDR') yerlesim = parcalar.length;
      } else if (tip === 'iCCP') {
        rapor.icc = true;
      } else if (tip === 'tEXt' || tip === 'zTXt' || tip === 'iTXt') {
        const k = anahtar(veri);
        if (k === 'XML:com.adobe.xmp') rapor.xmp = true;
        else rapor.metinAlani.push(k || tip);
      } else if (tip === 'eXIf') {
        const a = NS.exifOku(veri);
        if (a && !rapor.alanlar) rapor.alanlar = a;
      } else if (tip === 'tIME') {
        rapor.digerler.push('Son değiştirilme zamanı (tIME)');
      } else {
        rapor.digerler.push('Ek parça (' + tip + ')');
      }
      if (tip === 'iCCP') rapor.icc = true;
      i = son;
      if (tip === 'IEND') { bitti = true; break; }
    }

    if (!bitti) throw new Error('PNG dosyası eksik görünüyor.');
    if (i < b.length) rapor.ekVeri = b.length - i;

    const yon = rapor.alanlar ? rapor.alanlar.yon : 1;
    if (yonuKoru && yon > 1 && yon <= 8) parcalar.splice(yerlesim, 0, parca('eXIf', NS.exifKur({ yon })));
    return { cikti: NS.birlestir(parcalar), rapor };
  }

  NS.pngTemizle = pngTemizle;
  NS.pngParca = parca;
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(globalThis);
