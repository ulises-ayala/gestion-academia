// Arma el PDF del instructivo a partir de docs/instructivo/instructivo.md y sus capturas, con
// Chrome sin ventana. Para actualizarlo: editar el .md, regenerar las capturas
// (node scripts/instructivo-capturas.mjs) y volver a correr este script.
//
//   node scripts/instructivo-pdf.mjs [salida.pdf]
//
// Entiende el Markdown que usa el instructivo: títulos, párrafos, listas, negrita, código,
// imágenes solas en su línea, tablas y notas (> ...). CHROME_PATH permite indicar otro Chrome.
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const source = fileURLToPath(new URL('../docs/instructivo/instructivo.md', import.meta.url));
const output = resolve(process.argv[2] ?? 'instructivo-carmesi.pdf');
const chromePath =
  process.env.CHROME_PATH ??
  (process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/usr/bin/google-chrome');

const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (text) =>
  escape(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

const toHtml = (markdown) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let list = null;
  const flush = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
    if (list) html.push(`</${list}>`);
    list = null;
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const heading = /^(#{1,3}) (.*)$/.exec(line);
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line.trim());
    const item = /^(-|\d+\.) (.*)$/.exec(line);
    if (!line.trim()) flush();
    else if (heading) {
      flush();
      const level = heading[1].length;
      const part = level === 1 && heading[2].startsWith('Parte');
      html.push(`<h${level}${part ? ' class="part"' : ''}>${inline(heading[2])}</h${level}>`);
    } else if (image) {
      flush();
      html.push(`<figure><img src="${escape(image[2])}" alt="${escape(image[1])}"></figure>`);
    } else if (line.startsWith('> ')) {
      flush();
      html.push(`<aside>${inline(line.slice(2))}</aside>`);
    } else if (line.startsWith('|')) {
      flush();
      const rows = [];
      while (index < lines.length && lines[index].startsWith('|')) rows.push(lines[index++]);
      index--;
      const cells = (row) =>
        row
          .split('|')
          .slice(1, -1)
          .map((cell) => inline(cell.trim()));
      const [head, , ...body] = rows;
      html.push(
        `<table><thead><tr>${cells(head)
          .map((cell) => `<th>${cell}</th>`)
          .join('')}</tr></thead><tbody>${body
          .map(
            (row) =>
              `<tr>${cells(row)
                .map((cell) => `<td>${cell}</td>`)
                .join('')}</tr>`,
          )
          .join('')}</tbody></table>`,
      );
    } else if (item) {
      if (paragraph.length) flush();
      const kind = item[1] === '-' ? 'ul' : 'ol';
      if (list !== kind) {
        if (list) html.push(`</${list}>`);
        html.push(`<${kind}>`);
        list = kind;
      }
      html.push(`<li>${inline(item[2])}</li>`);
    } else {
      if (list) flush();
      paragraph.push(line.trim());
    }
  }
  flush();
  return html.join('\n');
};

const style = `
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; font-size: 10.5pt; line-height: 1.5; }
  h1 { color: #8f1d36; font-size: 22pt; margin: 0 0 8pt; }
  h1.part { break-before: page; border-bottom: 2px solid #8f1d36; padding-bottom: 4pt; }
  h2 { color: #222; font-size: 14pt; margin: 16pt 0 6pt; break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 12pt 0 4pt; break-after: avoid; }
  p, li { margin: 0 0 6pt; }
  ul, ol { padding-left: 18pt; margin: 0 0 8pt; }
  code { background: #f3f0ee; padding: 0 3pt; border-radius: 3pt; }
  aside { background: #f8eef0; border-left: 3pt solid #8f1d36; padding: 6pt 10pt; margin: 8pt 0; break-inside: avoid; }
  figure { margin: 8pt 0 12pt; break-inside: avoid; }
  img { width: 100%; border: 1px solid #ddd; border-radius: 4pt; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 12pt; font-size: 9.5pt; }
  th { background: #8f1d36; color: #fff; text-align: left; padding: 4pt 6pt; }
  td { border-bottom: 1px solid #e6dcde; padding: 4pt 6pt; }
  tr:nth-child(even) td { background: #faf6f6; }
`;
const page = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Instructivo de Carmesí</title>
<style>${style}</style></head><body>${toHtml(readFileSync(source, 'utf8'))}</body></html>`;
// El HTML va junto al .md para que las capturas (capturas/*.png) se resuelvan solas.
const htmlPath = source.replace(/\.md$/, '.print.html');
writeFileSync(htmlPath, page);
try {
  const result = spawnSync(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${output}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) throw new Error(`Chrome terminó con código ${result.status}`);
  console.log(`PDF: ${output}`);
} finally {
  rmSync(htmlPath, { force: true });
}
