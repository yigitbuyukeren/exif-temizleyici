// EXIF (TIFF) okuyucu ve yazıcı. Okuyucu rapor için, yazıcı iki iş için var:
// yönü korurken yalnızca "Orientation" etiketi taşıyan en küçük EXIF'i kurmak ve örnek fotoğrafa uydurma EXIF eklemek.
(function (root) {
  'use strict';
  const NS = (root.ExifTemizleyici = root.ExifTemizleyici || {});

  // etiket tipi → bayt boyutu (1 BYTE, 2 ASCII, 3 SHORT, 4 LONG, 5 RATIONAL, 7 UNDEFINED, 9 SLONG, 10 SRATIONAL)
  const BOYUT = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

  function exifOku(t) {
    if (!t || t.length < 8) return null;
    const le = t[0] === 0x49 && t[1] === 0x49;
    if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return null;
    const dv = new DataView(t.buffer, t.byteOffset, t.byteLength);
    const u16 = (o) => dv.getUint16(o, le);
    const u32 = (o) => dv.getUint32(o, le);
    if (u16(2) !== 42) return null;

    function ifdOku(konum) {
      const etiketler = new Map();
      if (konum < 8 || konum + 2 > t.length) return { etiketler, sonraki: 0 };
      const n = Math.min(u16(konum), 512);
      for (let i = 0; i < n; i++) {
        const e = konum + 2 + i * 12;
        if (e + 12 > t.length) break;
        const tip = u16(e + 2);
        const say = u32(e + 4);
        const birim = BOYUT[tip];
        if (!birim) continue;
        const uzun = birim * say;
        if (uzun > t.length) continue;
        const o = uzun <= 4 ? e + 8 : u32(e + 8);
        if (o + uzun > t.length) continue;
        etiketler.set(u16(e), { tip, say, o });
      }
      const sn = konum + 2 + n * 12;
      return { etiketler, sonraki: sn + 4 <= t.length ? u32(sn) : 0 };
    }

    const metin = (d) => {
      if (!d || d.tip !== 2) return '';
      let s = '';
      for (let i = 0; i < d.say; i++) {
        const c = t[d.o + i];
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s.trim();
    };
    const kisa = (d) => (d && d.tip === 3 && d.say >= 1 ? u16(d.o) : 0);
    const oran = (d, i) => {
      if (!d || (d.tip !== 5 && d.tip !== 10) || i >= d.say) return 0;
      const pay = d.tip === 5 ? u32(d.o + i * 8) : dv.getInt32(d.o + i * 8, le);
      const payda = d.tip === 5 ? u32(d.o + i * 8 + 4) : dv.getInt32(d.o + i * 8 + 4, le);
      return payda ? pay / payda : 0;
    };

    const ifd0 = ifdOku(u32(4));
    const ex = ifd0.etiketler.get(0x8769);
    const gp = ifd0.etiketler.get(0x8825);
    const exifIfd = ex && ex.tip === 4 ? ifdOku(u32(ex.o)) : { etiketler: new Map(), sonraki: 0 };
    const gpsIfd = gp && gp.tip === 4 ? ifdOku(u32(gp.o)) : { etiketler: new Map(), sonraki: 0 };
    const i0 = ifd0.etiketler;
    const ie = exifIfd.etiketler;
    const ig = gpsIfd.etiketler;

    let gps = null;
    const enlemD = ig.get(2);
    const boylamD = ig.get(4);
    if (enlemD && boylamD && enlemD.say >= 3 && boylamD.say >= 3) {
      const derece = (d) => oran(d, 0) + oran(d, 1) / 60 + oran(d, 2) / 3600;
      let enlem = derece(enlemD);
      let boylam = derece(boylamD);
      if (metin(ig.get(1)).toUpperCase() === 'S') enlem = -enlem;
      if (metin(ig.get(3)).toUpperCase() === 'W') boylam = -boylam;
      gps = { enlem, boylam, irtifa: null };
      const irt = ig.get(6);
      if (irt) {
        const ref = ig.get(5);
        const eksi = ref && ref.tip === 1 && t[ref.o] === 1;
        gps.irtifa = eksi ? -oran(irt, 0) : oran(irt, 0);
      }
    }

    return {
      make: metin(i0.get(0x010f)),
      model: metin(i0.get(0x0110)),
      yazilim: metin(i0.get(0x0131)),
      yon: kisa(i0.get(0x0112)) || 1,
      tarih: metin(ie.get(0x9003)) || metin(i0.get(0x0132)),
      sahip: metin(i0.get(0x013b)) || metin(ie.get(0xa430)),
      aciklama: metin(i0.get(0x010e)),
      telif: metin(i0.get(0x8298)),
      seri: metin(ie.get(0xa431)),
      lens: metin(ie.get(0xa434)),
      gps,
      gpsAlani: !!gp,
      kucukResim: ifd0.sonraki !== 0,
      etiketSayisi: i0.size + ie.size + ig.size,
    };
  }

  // ---- yazıcı (büyük bayt sırası) ----

  const asciiBayt = (s) => {
    const b = new Uint8Array(s.length + 1);
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); b[i] = c < 256 ? c : 63; }
    return b;
  };
  const kisaBayt = (n) => Uint8Array.of(n >> 8, n & 255);
  const uzunBayt = (n) => Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  const oranBayt = (liste) => {
    const b = new Uint8Array(liste.length * 8);
    liste.forEach(([pay, payda], i) => { b.set(uzunBayt(pay), i * 8); b.set(uzunBayt(payda), i * 8 + 4); });
    return b;
  };

  const girdi = (tag, tip, say, veri) => ({ tag, tip, say, veri });
  const metinGirdi = (tag, s) => girdi(tag, 2, s.length + 1, asciiBayt(s));

  function ifdBoyut(g) {
    let ek = 0;
    for (const x of g) if (x.veri.length > 4) ek += x.veri.length + (x.veri.length & 1);
    return 2 + g.length * 12 + 4 + ek;
  }

  function ifdYaz(girdiler, konum) {
    const g = girdiler.slice().sort((a, b) => a.tag - b.tag);
    const cikti = new Uint8Array(ifdBoyut(g));
    const dv = new DataView(cikti.buffer);
    dv.setUint16(0, g.length);
    let ek = 2 + g.length * 12 + 4;
    g.forEach((x, i) => {
      const e = 2 + i * 12;
      dv.setUint16(e, x.tag);
      dv.setUint16(e + 2, x.tip);
      dv.setUint32(e + 4, x.say);
      if (x.veri.length <= 4) cikti.set(x.veri, e + 8);
      else {
        dv.setUint32(e + 8, konum + ek);
        cikti.set(x.veri, ek);
        ek += x.veri.length + (x.veri.length & 1);
      }
    });
    return cikti;
  }

  function dereceOran(deger) {
    const m = Math.abs(deger);
    const d = Math.floor(m);
    const dk = Math.floor((m - d) * 60);
    const sn = ((m - d) * 60 - dk) * 60;
    return [[d, 1], [dk, 1], [Math.round(sn * 1000), 1000]];
  }

  // a: { make, model, yazilim, yon, tarih, sahip, aciklama, telif, seri, lens, gps: { enlem, boylam, irtifa } }
  function exifKur(a) {
    const i0 = [];
    if (a.aciklama) i0.push(metinGirdi(0x010e, a.aciklama));
    if (a.make) i0.push(metinGirdi(0x010f, a.make));
    if (a.model) i0.push(metinGirdi(0x0110, a.model));
    if (a.yon) i0.push(girdi(0x0112, 3, 1, Uint8Array.of(0, a.yon, 0, 0)));
    if (a.yazilim) i0.push(metinGirdi(0x0131, a.yazilim));
    if (a.sahip) i0.push(metinGirdi(0x013b, a.sahip));
    if (a.telif) i0.push(metinGirdi(0x8298, a.telif));

    const ie = [];
    if (a.tarih) ie.push(metinGirdi(0x9003, a.tarih));
    if (a.seri) ie.push(metinGirdi(0xa431, a.seri));
    if (a.lens) ie.push(metinGirdi(0xa434, a.lens));

    const ig = [];
    if (a.gps) {
      const { enlem, boylam, irtifa } = a.gps;
      ig.push(girdi(0, 1, 4, Uint8Array.of(2, 3, 0, 0)));
      ig.push(metinGirdi(1, enlem < 0 ? 'S' : 'N'));
      ig.push(girdi(2, 5, 3, oranBayt(dereceOran(enlem))));
      ig.push(metinGirdi(3, boylam < 0 ? 'W' : 'E'));
      ig.push(girdi(4, 5, 3, oranBayt(dereceOran(boylam))));
      if (irtifa != null) {
        ig.push(girdi(5, 1, 1, Uint8Array.of(irtifa < 0 ? 1 : 0)));
        ig.push(girdi(6, 5, 1, oranBayt([[Math.round(Math.abs(irtifa) * 100), 100]])));
      }
    }

    const isaret = (tag) => girdi(tag, 4, 1, uzunBayt(0));
    const i0Tum = i0.slice();
    if (ie.length) i0Tum.push(isaret(0x8769));
    if (ig.length) i0Tum.push(isaret(0x8825));
    const konum0 = 8;
    const konumE = konum0 + ifdBoyut(i0Tum);
    const konumG = konumE + (ie.length ? ifdBoyut(ie) : 0);
    for (const x of i0Tum) {
      if (x.tag === 0x8769) x.veri = uzunBayt(konumE);
      if (x.tag === 0x8825) x.veri = uzunBayt(konumG);
    }

    const baslik = Uint8Array.of(0x4d, 0x4d, 0, 42, 0, 0, 0, 8);
    const parcalar = [baslik, ifdYaz(i0Tum, konum0)];
    if (ie.length) parcalar.push(ifdYaz(ie, konumE));
    if (ig.length) parcalar.push(ifdYaz(ig, konumG));
    return NS.birlestir(parcalar);
  }

  // JPEG APP1 gövdesi: "Exif\0\0" + TIFF
  function exifApp1Yuk(tiff) {
    return NS.birlestir([Uint8Array.of(0x45, 0x78, 0x69, 0x66, 0, 0), tiff]);
  }

  Object.assign(NS, { exifOku, exifKur, exifApp1Yuk });
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(globalThis);
