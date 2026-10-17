// Arma el juego en un solo archivo HTML, con las tipografías y el código adentro.
//   node build.mjs  ->  alea-iacta-est-1.html (para jugar sin conexión)
//                       build/artifact.html   (la misma página, sin <html>/<head>, para publicar)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = (p) => join(root, 'src', p);

const JS = ['util', 'audio', 'data', 'sprites', 'terrain', 'battle_core', 'battle_ai', 'battle_view', 'campaign', 'campaign_view', 'ui', 'main'];
const FONTS = [
  ['Cinzel', 400, 'normal', 'cinzel-latin-400-normal.woff2'],
  ['Cinzel', 700, 'normal', 'cinzel-latin-700-normal.woff2'],
  ['Alegreya', 400, 'normal', 'alegreya-latin-400-normal.woff2'],
  ['Alegreya', 700, 'normal', 'alegreya-latin-700-normal.woff2'],
  ['Alegreya', 400, 'italic', 'alegreya-latin-400-italic.woff2'],
];

const fontCss = FONTS.map(([fam, w, st, file]) => {
  const b64 = readFileSync(src('fonts/' + file)).toString('base64');
  return `@font-face{font-family:'${fam}';font-style:${st};font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}).join('\n');

const css = readFileSync(src('style.css'), 'utf8').replace('/*FONTS*/', fontCss);
const js = `(function(){'use strict';\n${JS.map((f) => `// ---- ${f}.js ----\n` + readFileSync(src(`js/${f}.js`), 'utf8')).join('\n')}\n})();`;
const page = readFileSync(src('index.html'), 'utf8').replace('/*CSS*/', () => css).replace('/*JS*/', () => js);

if (js.includes('</script')) throw new Error('El código no puede contener </script');

const cut = page.indexOf('</style>') + '</style>'.length;
const head = page.slice(0, cut), body = page.slice(cut);
const full = `<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${head}\n</head>\n<body>${body}</body>\n</html>\n`;

writeFileSync(join(root, 'alea-iacta-est-1.html'), full);
mkdirSync(join(root, 'build'), { recursive: true });
writeFileSync(join(root, 'build', 'artifact.html'), page);
console.log(`alea-iacta-est-1.html: ${(Buffer.byteLength(full) / 1024).toFixed(0)} KB`);
