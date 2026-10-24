#!/usr/bin/env node
// Komut satırı: aynı temizleme kodunu tarayıcı dışında çalıştırır. Hiçbir ağ isteği yapmaz.
'use strict';
const fs = require('fs');
const path = require('path');
for (const m of ['ortak', 'exif', 'jpeg', 'png', 'webp', 'temizle']) require('./src/' + m + '.js');
const NS = globalThis.ExifTemizleyici;

const YARDIM = `Kullanım: exif-temizleyici <dosya|klasör>... [seçenekler]

  -o, --cikti <klasör>  Temiz dosyaları buraya yaz (varsayılan: dosyanın yanına, ada "-temiz" eklenir)
  --yon-sil             Yön (Orientation) bilgisini de sil
  --renk-sil            Renk profilini de sil
  -h, --yardim          Bu yardım

JPEG, PNG ve WebP yeniden sıkıştırılmadan temizlenir. Klasör verilirse içindeki resimler temizlenir.`;

const UZANTI = /\.(jpe?g|png|webp)$/i;

function oku(argv) {
  const a = { girdiler: [], cikti: null, yonuKoru: true, renkProfiliKoru: true, yardim: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '-h' || x === '--yardim') a.yardim = true;
    else if (x === '-o' || x === '--cikti') a.cikti = argv[++i];
    else if (x === '--yon-sil') a.yonuKoru = false;
    else if (x === '--renk-sil') a.renkProfiliKoru = false;
    else if (x.startsWith('-')) throw new Error('Bilinmeyen seçenek: ' + x);
    else a.girdiler.push(x);
  }
  return a;
}

function dosyalariTopla(girdiler) {
  const liste = [];
  for (const g of girdiler) {
    const st = fs.statSync(g);
    if (st.isDirectory()) {
      for (const ad of fs.readdirSync(g).sort()) {
        if (UZANTI.test(ad) && !/-temiz\.[^.]+$/i.test(ad)) liste.push(path.join(g, ad));
      }
    } else liste.push(g);
  }
  return liste;
}

function calistir(argv, yaz) {
  const a = oku(argv);
  if (a.yardim || !a.girdiler.length) { yaz(YARDIM); return a.yardim ? 0 : 1; }
  if (a.cikti) fs.mkdirSync(a.cikti, { recursive: true });
  let hata = 0;
  for (const yol of dosyalariTopla(a.girdiler)) {
    try {
      const s = temizleDosya(yol, a);
      yaz(path.basename(yol) + ' → ' + s.hedef + ' (' + s.ozet + ')');
    } catch (e) {
      hata++;
      yaz(path.basename(yol) + ': ' + e.message);
    }
  }
  return hata ? 1 : 0;
}

function temizleDosya(yol, a) {
  const bayt = new Uint8Array(fs.readFileSync(yol));
  const s = NS.temizle(bayt, { yonuKoru: a.yonuKoru, renkProfiliKoru: a.renkProfiliKoru });
  const ad = path.basename(yol).replace(/\.[^.]+$/, '') + '-temiz.' + s.uzanti;
  const hedef = path.join(a.cikti || path.dirname(yol), ad);
  fs.writeFileSync(hedef, s.cikti);
  const bulunan = NS.ozetle(s.rapor).map((x) => x.baslik);
  return { hedef, ozet: bulunan.length ? 'silindi: ' + bulunan.join(', ') : 'silinecek bir şey yoktu' };
}

if (require.main === module) {
  try { process.exitCode = calistir(process.argv.slice(2), (m) => console.log(m)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { calistir };
