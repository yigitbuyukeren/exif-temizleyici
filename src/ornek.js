// "Örnek fotoğrafla dene" düğmesi ve testler için: uydurma bir manzaraya uydurma EXIF, XMP ve konum ekler.
// Gerçek bir kişiye, cihaza ya da evin konumuna ait bir şey değildir (koordinat, herkese açık bir tarihî kule).
(function (root) {
  'use strict';
  const NS = (root.ExifTemizleyici = root.ExifTemizleyici || {});

  const ORNEK_ALANLAR = {
    make: 'Samsung',
    model: 'Galaxy S24',
    yazilim: 'S921BXXU1AXCA',
    yon: 1,
    tarih: '2026:05:14 18:42:07',
    sahip: 'Ornek Kisi',
    seri: 'DEMO-0001',
    lens: 'Ana kamera 6.3 mm f/1.8',
    gps: { enlem: 41.025617, boylam: 28.974112, irtifa: 42 },
  };

  function app1(yuk) {
    const uzun = yuk.length + 2;
    return NS.birlestir([Uint8Array.of(0xff, 0xe1, uzun >> 8, uzun & 255), yuk]);
  }

  function ornekFoto() {
    const ham = atob(NS.ORNEK_JPEG_B64);
    const temel = new Uint8Array(ham.length);
    for (let i = 0; i < ham.length; i++) temel[i] = ham.charCodeAt(i);

    const exif = app1(NS.exifApp1Yuk(NS.exifKur(ORNEK_ALANLAR)));
    const xmpMetin = 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="Ornek Duzenleyici 1.0"/></rdf:RDF></x:xmpmeta>';
    const xmp = app1(Uint8Array.from(xmpMetin, (c) => c.charCodeAt(0)));

    // SOI + JFIF'ten (20 bayt) hemen sonra ekle
    return NS.birlestir([temel.subarray(0, 20), exif, xmp, temel.subarray(20)]);
  }

  NS.ornekFoto = ornekFoto;
  NS.ORNEK_ALANLAR = ORNEK_ALANLAR;
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(globalThis);
