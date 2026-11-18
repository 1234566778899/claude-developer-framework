'use strict';
/**
 * Conversor DOCX → Markdown sin dependencias.
 * Lee el ZIP con zlib, interpreta word/document.xml y respeta títulos, listas, negritas y tablas.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { color } = require('./util');

function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo no es un .docx válido (ZIP sin directorio central).');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + csize);
    files[name] = () => (method === 8 ? zlib.inflateRawSync(data) : data);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function runsToText(pXml) {
  let out = '';
  const runs = pXml.match(/<w:r[ >][\s\S]*?<\/w:r>|<w:hyperlink[\s\S]*?<\/w:hyperlink>/g) || [];
  for (const r of runs) {
    if (r.startsWith('<w:hyperlink')) { out += runsToText(r); continue; }
    const bold = /<w:b(\s+w:val="(true|1)")?\s*\/>/.test(r);
    let t = '';
    const parts = r.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:tab\/>|<w:br\/>/g) || [];
    for (const p of parts) {
      if (p === '<w:tab/>') t += '\t';
      else if (p === '<w:br/>') t += '  \n';
      else t += decode(p.replace(/<[^>]+>/g, ''));
    }
    if (bold && t.trim()) out += t.replace(/^(\s*)(.*?)(\s*)$/s, '$1**$2**$3');
    else out += t;
  }
  return out.replace(/\*\*\*\*/g, '');
}

function headingLevel(pXml, styles) {
  const m = pXml.match(/<w:pStyle w:val="([^"]+)"/);
  const outline = pXml.match(/<w:outlineLvl w:val="(\d)"/);
  if (outline) return Number(outline[1]) + 1;
  if (!m) return 0;
  const id = m[1];
  const name = (styles[id] || id).toLowerCase();
  if (/^(title|titulo|título)$/.test(name)) return 1;
  const h = name.match(/(heading|t[ií]tulo|ttulo)\s*(\d)/);
  return h ? Number(h[2]) : 0;
}

function tableToMd(tblXml) {
  const rows = (tblXml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map((tr) =>
    (tr.match(/<w:tc>[\s\S]*?<\/w:tc>|<w:tc [\s\S]*?<\/w:tc>/g) || []).map((tc) =>
      (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(runsToText).join(' ').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()));
  if (!rows.length) return '';
  const cols = Math.max(...rows.map((r) => r.length));
  const pad = (r) => [...r, ...Array(cols - r.length).fill('')];
  const lines = [`| ${pad(rows[0]).join(' | ')} |`, `| ${Array(cols).fill('---').join(' | ')} |`];
  for (const r of rows.slice(1)) lines.push(`| ${pad(r).join(' | ')} |`);
  return lines.join('\n');
}

function docxToMarkdown(file) {
  const files = unzip(fs.readFileSync(file));
  if (!files['word/document.xml']) throw new Error('No se encontró word/document.xml en el .docx');
  const xml = files['word/document.xml']().toString('utf8');
  const styles = {};
  if (files['word/styles.xml']) {
    const sx = files['word/styles.xml']().toString('utf8');
    for (const m of sx.matchAll(/<w:style [^>]*w:styleId="([^"]+)"[^>]*>[\s\S]*?<w:name w:val="([^"]+)"/g)) styles[m[1]] = m[2];
  }
  const body = (xml.match(/<w:body>([\s\S]*)<\/w:body>/) || [])[1] || '';
  const blocks = body.match(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) || [];
  const out = [];
  for (const b of blocks) {
    if (b.startsWith('<w:tbl>')) { out.push('', tableToMd(b), ''); continue; }
    const text = runsToText(b).trim();
    if (!text) { out.push(''); continue; }
    const lvl = headingLevel(b, styles);
    if (lvl) { out.push('', `${'#'.repeat(Math.min(lvl, 6))} ${text.replace(/\*\*/g, '')}`, ''); continue; }
    const num = b.match(/<w:numPr>[\s\S]*?<w:ilvl w:val="(\d)"/);
    const styleName = ((b.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || '').toLowerCase();
    if (num || /list|vi(ñ|n)eta|prrafodelista/.test(styleName)) {
      const indent = '  '.repeat(num ? Number(num[1]) : 0);
      out.push(`${indent}- ${text}`);
      continue;
    }
    if (out.length && /^\s*- /.test(out[out.length - 1])) out.push('');
    out.push(text, '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function cmdConvert(root, args) {
  const input = args._[1];
  if (!input) { console.error(color.red('Uso: cdf convert <archivo.docx> [-o salida.md] [--force] [--json]')); process.exit(1); }
  const src = path.resolve(input);
  if (!fs.existsSync(src)) { console.error(color.red(`✖ No existe: ${input}`)); process.exit(1); }
  const out = path.resolve(args.o || args.output || src.replace(/\.docx$/i, '.md'));
  if (fs.existsSync(out) && !args.force) {
    console.error(color.red(`✖ ${path.relative(process.cwd(), out)} ya existe. Usa --force para sobrescribir.`));
    process.exit(1);
  }
  const md = `<!-- Fuente: ${path.basename(src)} · convertido con cdf convert el ${new Date().toISOString().slice(0, 10)}. Corregir solo errores de conversión, sin inventar contenido. -->\n\n` + docxToMarkdown(src);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md);
  const stats = { source: src, output: out, headings: (md.match(/^#+ /gm) || []).length, lines: md.split('\n').length, tables: (md.match(/^\| ---/gm) || []).length };
  if (args.json) return console.log(JSON.stringify(stats, null, 2));
  console.log(color.green(`✔ Convertido → ${path.relative(process.cwd(), out)}`));
  console.log(color.gray(`  ${stats.headings} títulos · ${stats.tables} tablas · ${stats.lines} líneas`));
  console.log(color.gray('  Siguiente: compara con el Word original y ejecuta "cdf completeness" sobre el .md.'));
}

module.exports = { docxToMarkdown, cmdConvert };
