import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';
import remarkStringify from 'remark-stringify';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import GithubSlugger, { slug as headingSlug } from 'github-slugger';

type Position = { start: { line: number; column: number; offset?: number }; end: { offset?: number } };
type Node = {
  type: string; value?: string; children?: Node[]; position?: Position;
  url?: string; title?: string | null; alt?: string; identifier?: string;
  lang?: string | null; depth?: number; [key: string]: unknown;
};
type Metadata = {
  title: string; slug: string; summary: string; date: string; updated?: string;
  tags: string[]; kind: 'knowledge' | 'journal'; publish: true;
};
type Note = {
  relative: string; absolute: string; source: string; tree: Node;
  published: boolean; aliases: string[]; metadata?: Metadata; headings: Set<string>;
};
export type NoteGraph = Record<string, { outgoing: string[]; incoming: string[] }>;
export type PublicationChange = { action: 'add' | 'change' | 'remove'; path: string };
export type PublicationResult = { written: boolean; notes: number; assets: number; changes: PublicationChange[] };
export type PublicationOptions = { sourceDir: string; projectDir: string; write?: boolean };

const notesDirectory = 'src/content/notes';
const assetsDirectory = 'public/published-assets';
const graphFile = 'src/generated/note-graph.json';
const reservedSlugs = new Set(['knowledge', 'journal', 'index', '404', 'topics', 'tags']);
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg']);
const attachmentExtensions = new Set([...imageExtensions, '.pdf']);
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkFrontmatter, ['yaml']);
const serializer = unified().use(remarkStringify, { bullet: '-', fences: true }).use(remarkGfm).use(remarkMath);

export class PublishError extends Error {
  constructor(message: string) { super(message); this.name = 'PublishError'; }
}

function fail(file: string, node: Node | undefined, message: string): never {
  const at = node?.position?.start;
  throw new PublishError(`${file}${at ? `:${at.line}:${at.column}` : ''} — ${message}`);
}
function walk(node: Node, callback: (node: Node) => void) {
  callback(node); node.children?.forEach((child) => walk(child, callback));
}
function wikiMatches(node: Node, source: string) {
  const raw = source.slice(node.position?.start.offset, node.position?.end.offset);
  const rawCandidates = [...raw.matchAll(/(!?)\[\[((?:\\.|[^\]\n])+)\]\]/g)].map((match) => ({
    text: match[0].replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1'),
    index: match.index!, length: match[0].length,
  }));
  const matches: Array<{ offset: number; length: number; embedded: boolean; target: string; label: string; sourceOffset: number; sourceLength: number }> = [];
  let rawCursor = 0;
  for (const match of (node.value ?? '').matchAll(/(!?)\[\[([^\]\n]+)\]\]/g)) {
    const candidate = rawCandidates.find((item) => item.index >= rawCursor && item.text === match[0]);
    if (!candidate) continue;
    rawCursor = candidate.index + candidate.length;
    const precedingEscapes = raw.slice(0, candidate.index).match(/\\+$/)?.[0].length ?? 0;
    if (precedingEscapes % 2 === 1) continue;
    const [target, ...labels] = match[2]!.split('|');
    matches.push({ offset: match.index!, length: match[0].length, embedded: !!match[1], target: target!, label: labels.join('|'),
      sourceOffset: (node.position?.start.offset ?? 0) + candidate.index, sourceLength: candidate.length });
  }
  return matches;
}
function headingText(node: Node, source: string, withinLink = false): string {
  // Match what the renderer sees: code and escaped wiki examples stay literal,
  // while actual wiki links contribute their display label to the heading ID.
  if (node.type === 'text' && !withinLink) {
    let value = node.value ?? '';
    for (const match of wikiMatches(node, source).reverse()) {
      const label = match.embedded ? '' : match.label || match.target.replace(/\.md(?=#|$)/i, '');
      value = value.slice(0, match.offset) + label + value.slice(match.offset + match.length);
    }
    return value;
  }
  if (node.type === 'image' || node.type === 'imageReference') return '';
  return node.value ?? node.children?.map((child) => headingText(child, source, withinLink || node.type === 'link' || node.type === 'linkReference')).join('') ?? '';
}
function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
function slash(value: string): string { return value.split(path.sep).join('/'); }
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}
function encodePath(value: string): string { return value.split('/').map(encodeURIComponent).join('/'); }
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function stripComments(source: string, file: string): string {
  const tree = parser.parse(source) as Node;
  const literals: Array<[number, number]> = [];
  walk(tree, (node) => {
    if (['code', 'inlineCode', 'math', 'inlineMath', 'yaml'].includes(node.type)) {
      const start = node.position?.start.offset, end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) literals.push([start, end]);
    }
  });
  const isLiteral = (offset: number) => literals.some(([start, end]) => offset >= start && offset < end);
  const chars = source.split('');
  let start = -1;
  for (let i = 0; i < source.length - 1; i++) {
    if (source.slice(i, i + 2) !== '%%' || isLiteral(i) || source[i - 1] === '\\') continue;
    if (start < 0) start = i;
    else {
      for (let j = start; j < i + 2; j++) if (chars[j] !== '\n' && chars[j] !== '\r') chars[j] = ' ';
      start = -1;
    }
    i++;
  }
  if (start >= 0) throw new PublishError(`${file}:${source.slice(0, start).split('\n').length} — Obsidian 注释缺少结束的 %%。`);
  return chars.join('');
}

async function listFiles(root: string, relative = ''): Promise<string[]> {
  const full = path.join(root, relative);
  let entries;
  try { entries = await fs.readdir(full, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name.startsWith('.')) continue;
    const child = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new PublishError(`${slash(child)} — 公开内容目录不支持符号链接，请使用实际文件。`);
    if (entry.isDirectory()) files.push(...await listFiles(root, child));
    else if (entry.isFile()) files.push(slash(child));
  }
  return files;
}

function readMetadata(tree: Node, file: string, kind: Metadata['kind']): { metadata?: Metadata; aliases: string[] } {
  const frontmatter = tree.children?.find((node) => node.type === 'yaml');
  if (!frontmatter) return { aliases: [] };
  let data: Record<string, unknown>;
  try { data = parseYaml(frontmatter.value ?? '') ?? {}; }
  catch { fail(file, frontmatter, '属性格式错误，请检查 YAML 缩进和引号。'); }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) fail(file, frontmatter, '笔记属性必须是键值对象。');
  const aliases = Array.isArray(data.aliases) ? data.aliases.filter((item): item is string => typeof item === 'string') : [];
  if (data.publish !== true) return { aliases };
  const required = ['title', 'slug', 'summary'] as const;
  for (const field of required) if (typeof data[field] !== 'string' || !(data[field] as string).trim()) fail(file, frontmatter, `公开笔记缺少 ${field} 文本属性。`);
  const slug = data.slug as string;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || reservedSlugs.has(slug)) fail(file, frontmatter, `slug 必须是未占用的小写英文短标识：${slug}`);
  if (!validDate(data.date)) fail(file, frontmatter, 'date 必须是有效的 YYYY-MM-DD 日期。');
  if (data.updated !== undefined && !validDate(data.updated)) fail(file, frontmatter, 'updated 必须是有效的 YYYY-MM-DD 日期。');
  if (typeof data.updated === 'string' && data.updated < data.date) fail(file, frontmatter, 'updated 不能早于 date。');
  if (data.tags !== undefined && (!Array.isArray(data.tags) || data.tags.some((tag) => typeof tag !== 'string' || !tag.trim()))) fail(file, frontmatter, 'tags 必须是非空文本组成的列表。');
  return {
    aliases,
    metadata: {
      title: (data.title as string).trim(), slug, summary: (data.summary as string).trim(),
      date: data.date, ...(data.updated ? { updated: data.updated as string } : {}),
      tags: [...new Set((data.tags ?? []) as string[])], kind, publish: true,
    },
  };
}

async function readNotes(sourceDir: string): Promise<Note[]> {
  const notes: Note[] = [];
  const usedSlugs = new Set<string>();
  for (const kind of ['knowledge', 'journal'] as const) {
    for (const entry of await listFiles(sourceDir, kind)) {
      if (path.extname(entry).toLowerCase() !== '.md') continue;
      const absolute = path.join(sourceDir, entry);
      const original = await fs.readFile(absolute, 'utf8');
      const originalTree = parser.parse(original) as Node;
      const { metadata, aliases } = readMetadata(originalTree, entry, kind);
      if (metadata && usedSlugs.has(metadata.slug)) fail(entry, undefined, `slug 重复：${metadata.slug}`);
      if (metadata) usedSlugs.add(metadata.slug);
      const source = metadata ? stripComments(original, entry) : '';
      const tree = metadata ? parser.parse(source) as Node : { type: 'root', children: [] };
      const slugger = new GithubSlugger();
      const headings = new Set<string>();
      walk(tree, (node) => { if (node.type === 'heading') headings.add(slugger.slug(headingText(node, source))); });
      notes.push({ relative: entry, absolute, source, tree, metadata, aliases, published: !!metadata, headings });
    }
  }
  return notes;
}

function parseDestination(raw: string, note: Note, node: Node): { target: string; fragment: string } {
  let decoded: string;
  try { decoded = decodeURIComponent(raw); }
  catch { fail(note.relative, node, `链接包含无效编码：${raw}`); }
  if (decoded.includes('\\') || decoded.includes('\0')) fail(note.relative, node, '链接路径含有不支持的字符。');
  const hash = decoded.indexOf('#');
  const target = hash < 0 ? decoded : decoded.slice(0, hash);
  const fragment = hash < 0 ? '' : decoded.slice(hash + 1);
  if (fragment.startsWith('^') || fragment.includes('#^')) fail(note.relative, node, '第一版暂不支持块引用，请改为标题链接或普通正文。');
  if (target.includes('?')) fail(note.relative, node, '本地笔记及附件链接不支持查询参数。');
  return { target, fragment };
}

function normalizedCandidate(target: string, note: Note, sourceName: string, wiki: boolean): string {
  let candidate = target;
  if (candidate.startsWith(`${sourceName}/`)) candidate = candidate.slice(sourceName.length + 1);
  const rootRelative = /^(knowledge|journal|assets)\//.test(candidate);
  return path.posix.normalize(rootRelative || (wiki && !candidate.startsWith('.')) ? candidate : path.posix.join(path.posix.dirname(note.relative), candidate));
}

function resolveNote(target: string, note: Note, allNotes: Note[], sourceName: string, wiki: boolean, node: Node): Note {
  if (!target) return note;
  if (path.posix.isAbsolute(target) || /^[A-Za-z]:/.test(target)) fail(note.relative, node, '不能发布本地绝对路径链接。');
  const normalized = normalizedCandidate(target, note, sourceName, wiki).replace(/\.md$/i, '');
  if (normalized === '..' || normalized.startsWith('../')) fail(note.relative, node, '链接超出公开目录。');
  let candidates: Note[];
  if (wiki && !target.includes('/')) {
    const basename = target.replace(/\.md$/i, '');
    candidates = allNotes.filter((item) => path.posix.basename(item.relative, '.md') === basename || item.aliases.includes(basename));
  } else candidates = allNotes.filter((item) => item.relative.replace(/\.md$/i, '') === normalized);
  if (candidates.length > 1) fail(note.relative, node, `链接目标重名，请使用公开目录内的完整路径：${target}`);
  if (!candidates.length) fail(note.relative, node, `找不到公开目录内的笔记：${target}`);
  const resolved = candidates[0]!;
  if (!resolved.published) fail(note.relative, node, `链接指向未公开笔记：${target}`);
  return resolved;
}

function resolveAnchor(fragment: string, target: Note, from: Note, node: Node): string {
  if (!fragment) return '';
  const candidate = target.headings.has(fragment) ? fragment : headingSlug(fragment);
  if (!target.headings.has(candidate)) fail(from.relative, node, `笔记 ${target.metadata?.title} 中没有标题：${fragment}`);
  return `#${encodeURIComponent(candidate)}`;
}

function isExternal(destination: string, note: Note, node: Node, image = false): boolean {
  if (/^https?:\/\//i.test(destination)) return true;
  if (!image && /^(mailto:|tel:)/i.test(destination)) return true;
  if (/^[a-z][a-z\d+.-]*:/i.test(destination) || destination.startsWith('//')) fail(note.relative, node, `不支持的链接协议：${destination.split(':')[0]}`);
  return false;
}

function transformNote(note: Note, allNotes: Note[], assetNames: string[], sourceName: string, usedAssets: Set<string>, graph: NoteGraph): string {
  const slug = note.metadata!.slug;
  const definitions = new Map<string, Node>();
  walk(note.tree, (node) => { if (node.type === 'definition' && node.identifier && !definitions.has(node.identifier)) definitions.set(node.identifier, node); });
  const addOutgoing = (target: Note) => {
    if (target.metadata!.slug !== slug && !graph[slug]!.outgoing.includes(target.metadata!.slug)) graph[slug]!.outgoing.push(target.metadata!.slug);
  };
  const assetUrl = (destination: string, node: Node, wiki: boolean, image: boolean): string => {
    const { target, fragment } = parseDestination(destination, note, node);
    if (path.posix.isAbsolute(target) || /^[A-Za-z]:/.test(target)) fail(note.relative, node, '附件必须位于公开 assets 文件夹内。');
    let candidates: string[];
    if (wiki && !target.includes('/')) candidates = assetNames.filter((item) => path.posix.basename(item) === target);
    else {
      const candidate = normalizedCandidate(target, note, sourceName, wiki);
      if (!candidate.startsWith('assets/')) fail(note.relative, node, '附件必须位于公开 assets 文件夹内。');
      candidates = assetNames.filter((item) => item === candidate);
    }
    if (candidates.length > 1) fail(note.relative, node, `附件重名，请使用完整路径：${target}`);
    if (!candidates.length) fail(note.relative, node, `找不到公开附件：${target}`);
    const selected = candidates[0]!;
    const extension = path.posix.extname(selected).toLowerCase();
    if (!attachmentExtensions.has(extension) || (image && !imageExtensions.has(extension))) fail(note.relative, node, '第一版附件支持常见图片与 PDF；Canvas、Excalidraw 等请先导出为图片。');
    if (fragment && !(extension === '.pdf' && /^page=\d+$/.test(fragment))) fail(note.relative, node, '附件只支持 PDF 的 #page=页码 锚点。');
    usedAssets.add(selected);
    return `/published-assets/${encodePath(selected.slice('assets/'.length))}${fragment ? `#${fragment}` : ''}`;
  };
  const linkUrl = (destination: string, node: Node, wiki: boolean): string => {
    if (isExternal(destination, note, node)) return destination;
    if (!wiki && ['/', '/about/', '/contact/', '/projects/', '/notes/', '/notes/knowledge/', '/notes/journal/'].includes(destination)) return destination;
    if (!wiki && /^\/notes\/[^/]+\/?(?:#.*)?$/.test(destination)) {
      const match = destination.match(/^\/notes\/([^/]+)\/?(?:#(.*))?$/)!;
      const target = allNotes.find((item) => item.metadata?.slug === match[1]);
      if (!target) fail(note.relative, node, `找不到已公开的网址：${destination}`);
      addOutgoing(target);
      let fragment = '';
      try { fragment = decodeURIComponent(match[2] ?? ''); } catch { fail(note.relative, node, '标题链接编码无效。'); }
      return `/notes/${target.metadata!.slug}/${resolveAnchor(fragment, target, note, node)}`;
    }
    const { target, fragment } = parseDestination(destination, note, node);
    const extension = path.posix.extname(target).toLowerCase();
    if (attachmentExtensions.has(extension) || ['.canvas', '.excalidraw'].includes(extension) || /(?:^|\/)assets\//.test(target)) return assetUrl(destination, node, wiki, false);
    const resolved = resolveNote(target, note, allNotes, sourceName, wiki, node);
    addOutgoing(resolved);
    return `/notes/${resolved.metadata!.slug}/${resolveAnchor(fragment, resolved, note, node)}`;
  };
  const wikiNodes = (node: Node): Node[] => {
    const value = node.value ?? '';
    const output: Node[] = [];
    let cursor = 0;
    for (const match of wikiMatches(node, note.source)) {
      const offset = match.offset;
      const absoluteOffset = match.sourceOffset;
      const before = note.source.slice(0, absoluteOffset);
      const diagnosticNode: Node = { ...node, position: { start: {
        line: before.split('\n').length, column: absoluteOffset - before.lastIndexOf('\n'), offset: absoluteOffset,
      }, end: { offset: absoluteOffset + match.sourceLength } } };
      if (offset > cursor) output.push({ type: 'text', value: value.slice(cursor, offset) });
      const { target, label } = match;
      if (match.embedded) {
        const { target: targetName } = parseDestination(target!, note, diagnosticNode);
        if (!path.posix.extname(targetName) || path.posix.extname(targetName).toLowerCase() === '.md') fail(note.relative, diagnosticNode, '第一版暂不支持笔记嵌入，请改为正文或公开笔记链接。');
        const url = assetUrl(target!, diagnosticNode, true, true);
        if (label) {
          if (!/^\d{1,4}(?:x\d{1,4})?$/.test(label)) fail(note.relative, diagnosticNode, '图片尺寸应为宽度或宽度x高度，例如 640 或 640x360。');
          const [width, height] = label.split('x').map(Number);
          if (!width || width > 8192 || (height !== undefined && (!height || height > 8192))) fail(note.relative, diagnosticNode, '图片尺寸必须在 1–8192 之间。');
          output.push({ type: 'html', value: `<img src="${escapeHtml(url)}" alt="${escapeHtml(path.posix.basename(targetName))}" width="${width}"${height ? ` height="${height}"` : ''} loading="lazy" />` });
        } else output.push({ type: 'image', url, alt: path.posix.basename(targetName) });
      } else output.push({ type: 'link', url: linkUrl(target!, diagnosticNode, true), children: [{ type: 'text', value: label || target!.replace(/\.md(?=#|$)/i, '') }] });
      cursor = offset + match.length;
    }
    if (cursor < value.length) output.push({ type: 'text', value: value.slice(cursor) });
    return output.length ? output : [node];
  };
  const transform = (parent: Node, withinLink = false) => {
    if (!parent.children) return;
    const next: Node[] = [];
    for (let child of parent.children) {
      if (child.type === 'yaml' || child.type === 'definition') continue;
      if (child.type === 'html') fail(note.relative, child, '公开稿请使用 Markdown；原始 HTML 暂不支持。');
      if (child.type === 'code' && /^(dataview|dataviewjs)$/i.test(child.lang ?? '')) fail(note.relative, child, 'Dataview 查询不会在网站执行，请先整理成静态 Markdown。');
      if (child.type === 'inlineCode' && /^(=|\$=)\s/.test(child.value ?? '')) fail(note.relative, child, 'Dataview 内联查询请先转换为静态文字。');
      if (child.type === 'text' && /(?:^|\s)\^[A-Za-z0-9-]+\s*$/.test(child.value ?? '')) fail(note.relative, child, '第一版暂不支持块标识，请移除块标识或改用标题。');
      if (child.type === 'linkReference' || child.type === 'imageReference') {
        const definition = definitions.get(child.identifier ?? '');
        if (!definition?.url) fail(note.relative, child, '引用式链接缺少有效定义。');
        child = { ...child, type: child.type === 'linkReference' ? 'link' : 'image', url: definition.url, title: definition.title };
      }
      if (child.type === 'link' && child.url !== undefined) child.url = linkUrl(child.url, child, false);
      if (child.type === 'image' && child.url !== undefined && !isExternal(child.url, note, child, true)) child.url = assetUrl(child.url, child, false, true);
      if (child.type === 'text' && !withinLink) { next.push(...wikiNodes(child)); continue; }
      transform(child, withinLink || child.type === 'link');
      next.push(child);
    }
    parent.children = next;
  };
  transform(note.tree);
  const body = serializer.stringify(note.tree as never).trim();
  return `---\n${stringifyYaml(note.metadata, { lineWidth: 0 })}---\n\n${body}\n`;
}

async function existingSnapshot(projectDir: string): Promise<Map<string, Buffer>> {
  const output = new Map<string, Buffer>();
  for (const directory of [notesDirectory, assetsDirectory]) {
    for (const relative of await listFiles(projectDir, directory)) output.set(relative, await fs.readFile(path.join(projectDir, relative)));
  }
  try { output.set(graphFile, await fs.readFile(path.join(projectDir, graphFile))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return output;
}

async function assertSafeOutput(projectDir: string) {
  for (const managed of [notesDirectory, assetsDirectory, graphFile]) {
    let cursor = projectDir;
    for (const part of managed.split('/')) {
      cursor = path.join(cursor, part);
      try { if ((await fs.lstat(cursor)).isSymbolicLink()) throw new PublishError(`${managed} — 输出路径不能包含符号链接。`); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') break; throw error; }
    }
  }
}

async function commitSnapshot(projectDir: string, files: Map<string, Buffer>) {
  const transactionDir = path.join(projectDir, `.obsidian-publish-${crypto.randomUUID()}`);
  const staged = path.join(transactionDir, 'next'), backup = path.join(transactionDir, 'previous');
  const completed: Array<{ managed: string; hadPrevious: boolean }> = [];
  await fs.mkdir(staged, { recursive: true });
  try {
    for (const directory of [notesDirectory, assetsDirectory]) await fs.mkdir(path.join(staged, directory), { recursive: true });
    for (const [relative, content] of files) {
      const destination = path.join(staged, relative);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, content);
    }
    for (const managed of [notesDirectory, assetsDirectory, graphFile]) {
      const destination = path.join(projectDir, managed), previous = path.join(backup, managed);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.mkdir(path.dirname(previous), { recursive: true });
      let hadPrevious = false;
      try { await fs.rename(destination, previous); hadPrevious = true; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      try { await fs.rename(path.join(staged, managed), destination); }
      catch (error) { if (hadPrevious) await fs.rename(previous, destination); throw error; }
      completed.push({ managed, hadPrevious });
    }
  } catch (error) {
    for (const { managed, hadPrevious } of completed.reverse()) {
      await fs.rm(path.join(projectDir, managed), { recursive: true, force: true });
      if (hadPrevious) await fs.rename(path.join(backup, managed), path.join(projectDir, managed));
    }
    throw error;
  } finally { await fs.rm(transactionDir, { recursive: true, force: true }); }
}

export async function publishVault(options: PublicationOptions): Promise<PublicationResult> {
  if (!path.isAbsolute(options.sourceDir) || !path.isAbsolute(options.projectDir)) throw new PublishError('sourceDir 和 projectDir 必须使用绝对路径。');
  const suppliedSourceDir = path.resolve(options.sourceDir), suppliedProjectDir = path.resolve(options.projectDir);
  let sourceStat;
  try { sourceStat = await fs.lstat(suppliedSourceDir); } catch { throw new PublishError('找不到公开内容目录，请检查本地 source 配置。'); }
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw new PublishError('source 必须是实际的 Web-Publish 文件夹。');
  // Resolve every existing ancestor before comparing paths. A project alias (or
  // macOS /tmp → /private/tmp) must not disguise a managed output as safe input.
  const sourceDir = await fs.realpath(suppliedSourceDir);
  let projectDir: string;
  try {
    projectDir = await fs.realpath(suppliedProjectDir);
    if (!(await fs.stat(projectDir)).isDirectory()) throw new Error('not a directory');
  } catch { throw new PublishError('找不到网站项目目录，projectDir 必须指向现有文件夹。'); }
  await assertSafeOutput(projectDir);
  for (const kind of ['knowledge', 'journal', 'assets']) {
    try { if ((await fs.lstat(path.join(sourceDir, kind))).isSymbolicLink()) throw new PublishError(`${kind} — 公开目录不能是符号链接。`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  for (const managed of [notesDirectory, assetsDirectory, graphFile]) {
    const output = path.join(projectDir, managed);
    if (inside(sourceDir, output) || inside(output, sourceDir)) throw new PublishError('公开原稿目录与网站输出目录必须分开。');
  }
  const allNotes = await readNotes(sourceDir);
  const published = allNotes.filter((note) => note.published);
  const assetNames = await listFiles(sourceDir, 'assets');
  const usedAssets = new Set<string>();
  const graph: NoteGraph = Object.fromEntries(published.map((note) => [note.metadata!.slug, { outgoing: [], incoming: [] }]));
  const snapshot = new Map<string, Buffer>();
  for (const note of published) {
    const markdown = transformNote(note, allNotes, assetNames, path.basename(sourceDir), usedAssets, graph);
    snapshot.set(`${notesDirectory}/${note.metadata!.slug}.md`, Buffer.from(markdown));
  }
  for (const [slug, links] of Object.entries(graph)) {
    links.outgoing.sort();
    for (const target of links.outgoing) graph[target]!.incoming.push(slug);
  }
  for (const links of Object.values(graph)) links.incoming.sort();
  snapshot.set(graphFile, Buffer.from(`${JSON.stringify(graph, null, 2)}\n`));
  for (const asset of [...usedAssets].sort()) {
    const absolute = path.join(sourceDir, asset);
    if (!inside(await fs.realpath(sourceDir), await fs.realpath(absolute))) throw new PublishError(`${asset} — 附件超出公开目录。`);
    snapshot.set(`${assetsDirectory}/${asset.slice('assets/'.length)}`, await fs.readFile(absolute));
  }
  const previous = await existingSnapshot(projectDir);
  const changes: PublicationChange[] = [];
  for (const [file, bytes] of snapshot) {
    const before = previous.get(file);
    if (!before) changes.push({ action: 'add', path: file });
    else if (!bytes.equals(before)) changes.push({ action: 'change', path: file });
  }
  for (const file of previous.keys()) if (!snapshot.has(file)) changes.push({ action: 'remove', path: file });
  changes.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  if (options.write && changes.length) await commitSnapshot(projectDir, snapshot);
  return { written: !!options.write, notes: published.length, assets: usedAssets.size, changes };
}
