# EXIF Temizleyici
- Gizlilik esastır: ağ isteği, analitik, CDN, harici font veya gerçek dosya yükleme ekleme. `index.html` CSP'sini (`connect-src 'none'`) koru.
- JPEG/PNG/WebP temizliği kayıpsız kalmalı; bozuk veriler güvenli reddedilmeli.
- Yayındaki sayfa salt demodur: yalnız uydurma örnek fotoğrafı işler, dosya kabulünü açma.
- Gerçek kullanıcı fotoğrafı kullanma; yalnızca sahte test verisi.
- Bağımlılıksız yapıyı ve Node 18+ uyumunu koru. Kontrol: `npm test`.
- `main` dalına push GitHub Pages yayınıdır.
