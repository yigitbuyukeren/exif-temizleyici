// Tüm modülleri tarayıcıdaki sırayla yükler ve ortak ad alanını döndürür.
for (const m of ['ortak', 'exif', 'jpeg', 'png', 'webp', 'temizle', 'zip', 'ornek-veri', 'ornek']) require('../src/' + m + '.js');
module.exports = globalThis.ExifTemizleyici;
