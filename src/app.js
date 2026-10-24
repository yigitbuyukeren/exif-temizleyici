(function () {
  'use strict';
  const NS = window.ExifTemizleyici;
  const { temizle, ozetle, hassasVar, zipYaz, ornekFoto, kb } = NS;

  const $ = (id) => document.getElementById(id);

  function h(etiket, ozellik, ...cocuklar) {
    const e = document.createElement(etiket);
    for (const [k, v] of Object.entries(ozellik || {})) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const c of cocuklar.flat()) if (c != null) e.append(c);
    return e;
  }

  // her dosya: { ad, bayt, sonuc | null, hata | null, yenidenCizildi }
  const dosyalar = [];
  let adresler = [];

  function secenekler() {
    return { yonuKoru: $('yon').checked, renkProfiliKoru: $('renk').checked };
  }

  function hataGoster(metin) {
    const e = $('hata');
    e.textContent = metin || '';
    e.hidden = !metin;
  }

  function temizAd(ad, uzanti) {
    const govde = ad.replace(/\.[^.]+$/, '') || 'fotograf';
    return govde + '-temiz.' + uzanti;
  }

  // Biçimi doğrudan temizlenemeyenleri (HEIC, GIF, BMP…) tarayıcıya çizdirip PNG olarak kaydeder:
  // yeniden çizilen görüntüde meta veri kalmaz, ama dosya yeni bir PNG olur.
  async function yenidenCiz(dosya) {
    const bmp = await createImageBitmap(dosya);
    const tuval = document.createElement('canvas');
    tuval.width = bmp.width;
    tuval.height = bmp.height;
    tuval.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    const blob = await new Promise((coz) => tuval.toBlob(coz, 'image/png'));
    if (!blob) throw new Error('Görüntü çizilemedi.');
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function dosyaEkle(liste) {
    hataGoster('');
    const resimler = [...liste].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(f.name));
    if (!resimler.length) { hataGoster('Resim dosyası bulunamadı.'); return; }
    for (const f of resimler) {
      if (f.size > 100 * 1024 * 1024) { hataGoster(f.name + ' çok büyük (100 MB üstü), atlandı.'); continue; }
      const bayt = new Uint8Array(await f.arrayBuffer());
      const kayit = { ad: f.name || 'fotograf', bayt, dosya: f, sonuc: null, hata: null, yenidenCizildi: false };
      dosyalar.push(kayit);
      await isle(kayit);
    }
    ciz();
  }

  async function isle(k) {
    k.sonuc = null;
    k.hata = null;
    k.yenidenCizildi = false;
    try {
      k.sonuc = temizle(k.bayt, secenekler());
    } catch (e) {
      if (/doğrudan temizlenemiyor/.test(e.message) && k.dosya) {
        try {
          const cikti = await yenidenCiz(k.dosya);
          const rapor = NS.bosRapor();
          rapor.digerler.push('Biçim doğrudan temizlenemediği için yeniden çizildi (PNG)');
          k.sonuc = { bicim: 'png', uzanti: 'png', tur: 'image/png', cikti, rapor };
          k.yenidenCizildi = true;
        } catch (e2) {
          k.hata = 'Bu biçim bu tarayıcıda açılamıyor.';
        }
      } else k.hata = e.message;
    }
  }

  function indir(ad, veri, tur) {
    const url = URL.createObjectURL(new Blob([veri], { type: tur }));
    const a = h('a', { href: url, download: ad });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function ozetKart(ozet, k) {
    if (k.yenidenCizildi) {
      return h('p', { class: 'temiz', text: '🔁 Bu biçim doğrudan temizlenemiyor; görüntü yeniden çizilip PNG olarak hazırlandı. Meta veri kalmadı, ama dosya yeni bir PNG (hareketli GIF ise yalnızca ilk kare kalır).' });
    }
    if (!ozet.length) return h('p', { class: 'temiz', text: '✅ Bu fotoğrafta silinecek bir şey bulunamadı. Zaten temizmiş.' });
    return h('ul', { class: 'bulunan' }, ozet.map((x) => h('li', { class: x.agir ? 'agir' : '' },
      h('span', { class: 'ikon', 'aria-hidden': 'true', text: x.ikon }),
      h('span', { class: 'etiket', text: x.baslik }),
      x.deger ? h('span', { class: 'deger', text: x.deger }) : null)));
  }

  function sonucKarti(k) {
    if (k.hata) {
      return h('article', { class: 'foto hatali' },
        h('div', { class: 'foto-ust' }, h('strong', { text: k.ad })),
        h('p', { class: 'hata', text: '⚠️ ' + k.hata }));
    }
    const s = k.sonuc;
    const url = URL.createObjectURL(new Blob([s.cikti], { type: s.tur }));
    adresler.push(url);
    const ozet = ozetle(s.rapor);
    const dogru = !hassasVar(temizle(s.cikti, secenekler()).rapor);
    const yonNotu = s.rapor.alanlar && s.rapor.alanlar.yon > 1 && secenekler().yonuKoru;

    const indirDugme = h('button', { type: 'button', class: 'dugme', text: 'Temiz hâlini indir' });
    indirDugme.addEventListener('click', () => indir(temizAd(k.ad, s.uzanti), s.cikti, s.tur));

    return h('article', { class: 'foto' },
      h('div', { class: 'foto-govde' },
        h('img', { class: 'onizleme', src: url, alt: 'Temizlenmiş fotoğrafın önizlemesi' }),
        h('div', { class: 'foto-bilgi' },
          h('div', { class: 'foto-ust' },
            h('strong', { class: 'ad', text: k.ad }),
            h('span', { class: 'boyut', text: kb(k.bayt.length) + ' → ' + kb(s.cikti.length) })),
          ozetKart(ozet, k),
          yonNotu ? h('p', { class: 'not', text: '🔄 Yön bilgisi korundu (fotoğraf doğru dönmüş görünsün diye); başka hiçbir alan yok.' }) : null,
          dogru ? h('p', { class: 'dogrulama', text: '🔒 Doğrulandı: temiz dosya tekrar taranınca hassas bir alan bulunamadı.' })
                : h('p', { class: 'hata', text: '⚠️ Temiz dosyada hâlâ bir alan göründü; lütfen sorun bildir.' }),
          indirDugme)));
  }

  function ciz() {
    for (const u of adresler) URL.revokeObjectURL(u);
    adresler = [];
    const kutu = $('sonuc');
    kutu.replaceChildren();
    kutu.hidden = dosyalar.length === 0;
    if (!dosyalar.length) return;

    const saglam = dosyalar.filter((k) => k.sonuc);
    const konumlu = saglam.filter((k) => k.sonuc.rapor.alanlar && k.sonuc.rapor.alanlar.gps).length;
    const ustBilgi = h('div', { class: 'toplu' },
      h('div', {},
        h('h2', { text: dosyalar.length + ' fotoğraf' }),
        h('p', { class: 'not', text: konumlu ? '📍 ' + konumlu + ' tanesinde konum bilgisi vardı, silindi.' : 'Konum bilgisi bulunan fotoğraf yok.' })),
      h('div', { class: 'toplu-dugmeler' }));
    const dugmeler = ustBilgi.querySelector('.toplu-dugmeler');

    if (saglam.length > 1) {
      const zip = h('button', { type: 'button', class: 'dugme', text: 'Hepsini .zip indir' });
      zip.addEventListener('click', () => {
        const kullanilan = new Set();
        const girdiler = saglam.map((k) => {
          let ad = temizAd(k.ad, k.sonuc.uzanti);
          for (let n = 2; kullanilan.has(ad); n++) ad = temizAd(k.ad, k.sonuc.uzanti).replace(/(\.[^.]+)$/, '-' + n + '$1');
          kullanilan.add(ad);
          return { ad, veri: k.sonuc.cikti };
        });
        indir('temiz-fotograflar.zip', zipYaz(girdiler), 'application/zip');
      });
      dugmeler.append(zip);
    }
    const temizleDugme = h('button', { type: 'button', class: 'dugme ikincil', text: 'Listeyi temizle' });
    temizleDugme.addEventListener('click', () => { dosyalar.length = 0; ciz(); hataGoster(''); });
    dugmeler.append(temizleDugme);

    kutu.append(ustBilgi, ...dosyalar.map(sonucKarti));
  }

  async function yenidenIsle() {
    for (const k of dosyalar) await isle(k);
    ciz();
  }

  // ---- olaylar ----
  const birak = $('birak');
  $('dosya').addEventListener('change', (e) => { dosyaEkle(e.target.files); e.target.value = ''; });
  birak.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('dosya').click(); } });
  ['dragenter', 'dragover'].forEach((a) => birak.addEventListener(a, (e) => { e.preventDefault(); birak.classList.add('ustunde'); }));
  ['dragleave', 'drop'].forEach((a) => birak.addEventListener(a, (e) => { e.preventDefault(); birak.classList.remove('ustunde'); }));
  birak.addEventListener('drop', (e) => dosyaEkle(e.dataTransfer.files));
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
  document.addEventListener('paste', (e) => {
    const f = [...(e.clipboardData ? e.clipboardData.files : [])];
    if (f.length) dosyaEkle(f);
  });
  $('yon').addEventListener('change', yenidenIsle);
  $('renk').addEventListener('change', yenidenIsle);
  $('ornek').addEventListener('click', () => {
    const bayt = ornekFoto();
    const kayit = { ad: 'ornek-manzara.jpg', bayt, dosya: null, sonuc: null, hata: null, yenidenCizildi: false };
    dosyalar.push(kayit);
    isle(kayit).then(ciz);
  });
})();
