// Biçimi tanır, ilgili temizleyiciyi çalıştırır ve sonucu insan diliyle özetler.
(function (root) {
  'use strict';
  const NS = (root.ExifTemizleyici = root.ExifTemizleyici || {});

  function bicimBul(b) {
    if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
    if (b.length > 8 && b[0] === 0x89 && NS.baslar(b, 'PNG', 1)) return 'png';
    if (b.length > 12 && NS.baslar(b, 'RIFF') && NS.baslar(b, 'WEBP', 8)) return 'webp';
    return null;
  }

  const UZANTI = { jpeg: 'jpg', png: 'png', webp: 'webp' };
  const TUR = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

  function temizle(b, sec) {
    const bicim = bicimBul(b);
    if (!bicim) throw new Error('Bu biçim doğrudan temizlenemiyor.');
    const sonuc = bicim === 'jpeg' ? NS.jpegTemizle(b, sec) : bicim === 'png' ? NS.pngTemizle(b, sec) : NS.webpTemizle(b, sec);
    return { bicim, uzanti: UZANTI[bicim], tur: TUR[bicim], cikti: sonuc.cikti, rapor: sonuc.rapor };
  }

  // Rapor, kimlik ya da konum taşıyabilecek bir şey içeriyor mu? (yön ve renk profili sayılmaz)
  function hassasVar(r) {
    const a = r.alanlar;
    const exifte = !!a && !!(a.gps || a.gpsAlani || a.make || a.model || a.yazilim || a.tarih || a.sahip || a.aciklama || a.telif || a.seri || a.lens || a.kucukResim);
    return exifte || r.xmp || r.iptc || r.yorum || r.metinAlani.length > 0 || r.digerler.length > 0 || r.ekVeri > 0;
  }

  function kb(n) {
    return n < 1024 ? n + ' bayt' : (n / 1024).toFixed(n < 10240 ? 1 : 0).replace('.', ',') + ' KB';
  }

  function konumMetni(g) {
    const s = g.enlem.toFixed(5) + ', ' + g.boylam.toFixed(5);
    return g.irtifa != null ? s + ' (' + Math.round(g.irtifa) + ' m)' : s;
  }

  // Arayüzde "bulunup silinenler" listesi: [{ ikon, baslik, deger, agir }]
  function ozetle(r) {
    const s = [];
    const a = r.alanlar;
    if (a) {
      if (a.gps) s.push({ ikon: '📍', baslik: 'Konum (GPS)', deger: konumMetni(a.gps), agir: true });
      else if (a.gpsAlani) s.push({ ikon: '📍', baslik: 'GPS alanı', deger: 'koordinat okunamadı ama alan vardı', agir: true });
      const cihaz = [a.make, a.model].filter(Boolean).join(' ');
      if (cihaz) s.push({ ikon: '📷', baslik: 'Cihaz', deger: cihaz });
      if (a.lens) s.push({ ikon: '🔭', baslik: 'Lens', deger: a.lens });
      if (a.tarih) s.push({ ikon: '🕒', baslik: 'Çekim zamanı', deger: a.tarih.replace(/^(\d{4}):(\d\d):(\d\d)/, '$1-$2-$3') });
      if (a.yazilim) s.push({ ikon: '🧩', baslik: 'Yazılım', deger: a.yazilim });
      if (a.sahip) s.push({ ikon: '👤', baslik: 'Sahip', deger: a.sahip, agir: true });
      if (a.telif) s.push({ ikon: '©️', baslik: 'Telif', deger: a.telif });
      if (a.aciklama) s.push({ ikon: '📝', baslik: 'Açıklama', deger: a.aciklama });
      if (a.seri) s.push({ ikon: '🔢', baslik: 'Seri numarası', deger: a.seri, agir: true });
    }
    if (r.xmp) s.push({ ikon: '🏷️', baslik: 'XMP', deger: 'düzenleme yazılımı ve etiket bilgisi' });
    if (r.iptc) s.push({ ikon: '🗂️', baslik: 'IPTC / Photoshop', deger: 'başlık, anahtar kelime, yazar alanları' });
    if (r.yorum) s.push({ ikon: '💬', baslik: 'Yorum', deger: 'dosyaya gömülü serbest metin' });
    if (r.metinAlani.length) s.push({ ikon: '🔤', baslik: 'Metin alanları', deger: r.metinAlani.join(', ') });
    for (const d of r.digerler) s.push({ ikon: '🧱', baslik: d, deger: '' });
    if (r.ekVeri) s.push({ ikon: '📎', baslik: 'Dosya sonuna eklenmiş veri', deger: kb(r.ekVeri) + ' (örneğin hareketli fotoğraf videosu)', agir: true });
    return s;
  }

  Object.assign(NS, { bicimBul, temizle, hassasVar, ozetle, kb });
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(globalThis);
