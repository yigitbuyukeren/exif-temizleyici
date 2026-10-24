const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const NS = require('./_yukle.js');
const { calistir } = require('../cli.js');

test('cli: klasördeki JPEG temizlenir, özgün dosya değişmez', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'exif-'));
  const orijinal = NS.ornekFoto();
  fs.writeFileSync(path.join(d, 'a.jpg'), orijinal);
  const satirlar = [];
  assert.equal(calistir([d, '--yon-sil'], (m) => satirlar.push(m)), 0);
  assert.deepEqual(fs.readFileSync(path.join(d, 'a.jpg')), Buffer.from(orijinal));
  const cikti = new Uint8Array(fs.readFileSync(path.join(d, 'a-temiz.jpg')));
  assert.equal(NS.hassasVar(NS.temizle(cikti, {}).rapor), false);
  assert.match(satirlar.join('\n'), /Konum/);
  // ikinci çalıştırma "-temiz" dosyalarını tekrar işlemez
  assert.equal(calistir([d], () => {}), 0);
  assert.equal(fs.readdirSync(d).length, 2);
});

test('cli: resim olmayan dosya hata kodu döner; argümansız yardım', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'exif-'));
  fs.writeFileSync(path.join(d, 'x.txt'), 'merhaba');
  assert.equal(calistir([path.join(d, 'x.txt')], () => {}), 1);
  assert.equal(calistir([], () => {}), 1);
  assert.equal(calistir(['-h'], () => {}), 0);
});
