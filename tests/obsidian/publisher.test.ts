import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { publishVault, PublishError } from '../../scripts/obsidian/publisher';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import { rehypeSite } from '../../src/plugins/markdown';

async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'obsidian-publisher-test-'));
  const sourceDir = path.join(root, 'Web-Publish');
  const projectDir = path.join(root, 'site');
  await Promise.all(['knowledge', 'journal', 'assets'].map((part) => fs.mkdir(path.join(sourceDir, part), { recursive: true })));
  await fs.mkdir(projectDir);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const put = async (relative: string, content: string | Buffer) => {
    const file = path.join(sourceDir, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  };
  const read = (relative: string) => fs.readFile(path.join(projectDir, relative), 'utf8');
  const run = (write = true) => publishVault({ sourceDir, projectDir, write });
  return { root, sourceDir, projectDir, put, read, run };
}

function note(slug: string, body = '公开正文。', extra = '', publish = true) {
  return `---\ntitle: ${slug}\nslug: ${slug}\nsummary: 关于 ${slug} 的公开摘要。\ndate: 2026-10-24\ntags: [测试]\npublish: ${publish}\n${extra}---\n\n${body}\n`;
}

test('only selected public metadata, notes and referenced assets reach the snapshot', async (t) => {
  const f = await fixture(t);
  await f.put('knowledge/公开.md', note('public-note', '公开文字。\n\n%% private annotation %%\n\n![[diagram.png]]', 'secret: secret-frontmatter\n'));
  await f.put('knowledge/私密草稿.md', note('private-draft', 'private-body-secret ![[private.png]]', '', false));
  await f.put('assets/diagram.png', Buffer.from('PUBLIC-IMAGE'));
  await f.put('assets/private.png', Buffer.from('PRIVATE-IMAGE'));
  await f.put('outside.md', note('outside', 'outside-secret'));
  const result = await f.run();
  assert.equal(result.notes, 1);
  assert.equal(result.assets, 1);
  assert.deepEqual(await fs.readdir(path.join(f.projectDir, 'src/content/notes')), ['public-note.md']);
  assert.deepEqual(await fs.readdir(path.join(f.projectDir, 'public/published-assets')), ['diagram.png']);
  const markdown = await f.read('src/content/notes/public-note.md');
  assert.doesNotMatch(markdown, /private|secret|outside/);
  assert.match(markdown, /kind: knowledge/);
  assert.match(markdown, /\/published-assets\/diagram.png/);
  assert.equal(await f.read('public/published-assets/diagram.png'), 'PUBLIC-IMAGE');
});

test('wiki links, Markdown links, aliases, Chinese heading anchors and backlinks work together', async (t) => {
  const f = await fixture(t);
  await f.put('knowledge/概念.md', note('concept', '## 中文标题\n\n概念正文。\n\n## 中文标题\n\n第二段。', 'aliases: [知识别名]\n'));
  await f.put('journal/复盘.md', note('reflection', '[[知识别名#中文标题|阅读概念]]\n\n[第二段](../knowledge/概念.md#中文标题-1)\n\n[[Web-Publish/knowledge/概念]]'));
  await f.run();
  const markdown = await f.read('src/content/notes/reflection.md');
  assert.match(markdown, /\[阅读概念\]\(\/notes\/concept\/#%E4%B8%AD/);
  assert.match(markdown, /\[第二段\]\(\/notes\/concept\/#%E4%B8%AD/);
  assert.match(markdown, /kind: journal/);
  const graph = JSON.parse(await f.read('src/generated/note-graph.json'));
  assert.deepEqual(graph.concept, { outgoing: [], incoming: ['reflection'] });
  assert.deepEqual(graph.reflection, { outgoing: ['concept'], incoming: [] });
});

test('published heading anchors match rendering for literal wiki examples, links and images', async (t) => {
  const f = await fixture(t);
  await f.put('knowledge/target.md', note('target'));
  await f.put('assets/diagram.png', 'image');
  const body = [
    '## \\[[私人|别名]]',
    '## 使用 `[[name|label]]`',
    '## [字面 [[name|label]]](https://example.com/)',
    '## **[[target|显示名]]**',
    '## 图片 ![[diagram.png|100]]',
    '## \\[[私人|别名]]',
    '[[#私人别名]]',
    '[[#使用-namelabel]]',
    '[[#字面-namelabel]]',
    '[[#显示名]]',
    '[[#图片-]]',
    '[[#私人别名-1]]',
  ].join('\n\n');
  await f.put('knowledge/a.md', note('alpha', body));
  await f.run();
  const markdown = await f.read('src/content/notes/alpha.md');
  const html = String(await unified().use(remarkParse).use(remarkGfm)
    .use(remarkFrontmatter, ['yaml']).use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw).use(rehypeSite).use(rehypeStringify).process(markdown));
  const headingIds = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((match) => match[1]);
  const anchorTargets = [...html.matchAll(/href="\/notes\/alpha\/#([^"]+)"/g)].map((match) => decodeURIComponent(match[1]!));
  assert.deepEqual(headingIds, ['私人别名', '使用-namelabel', '字面-namelabel', '显示名', '图片-', '私人别名-1']);
  assert.deepEqual(anchorTargets, headingIds);
  assert.match(html, /href="\/notes\/target\/"/);
  await f.put('knowledge/a.md', note('alpha', '## \\[[私人|别名]]\n\n[[#别名]]'));
  await assert.rejects(() => f.run(), /没有标题/);
});

test('preview is read-only and repeat sync is idempotent', async (t) => {
  const f = await fixture(t);
  await f.put('knowledge/a.md', note('alpha'));
  const preview = await f.run(false);
  assert.equal(preview.written, false);
  assert.equal(preview.changes.length, 2);
  assert.deepEqual(await fs.readdir(f.projectDir), []);
  await f.run();
  assert.deepEqual((await f.run()).changes, []);
  await f.put('knowledge/a.md', note('alpha', '修改后的文字。'));
  assert.equal((await f.run(false)).changes[0]?.action, 'change');
  assert.doesNotMatch(await f.read('src/content/notes/alpha.md'), /修改后的文字/);
});

test('file renames preserve public URLs and update/remove leaves shared assets intact', async (t) => {
  const f = await fixture(t);
  await f.put('assets/shared.png', 'shared');
  await f.put('assets/unique.png', 'unique');
  await f.put('knowledge/a.md', note('alpha', '![[shared.png]]\n\n![[unique.png]]'));
  await f.put('knowledge/b.md', note('beta', '![[shared.png]]'));
  await f.run();
  await fs.rename(path.join(f.sourceDir, 'knowledge/b.md'), path.join(f.sourceDir, 'knowledge/renamed.md'));
  assert.deepEqual((await f.run()).changes, []);
  await f.put('knowledge/a.md', note('alpha', '![[shared.png]]\n\n![[unique.png]]', '', false));
  const removed = await f.run();
  assert.ok(removed.changes.some((change) => change.action === 'remove' && change.path.endsWith('alpha.md')));
  assert.ok(removed.changes.some((change) => change.action === 'remove' && change.path.endsWith('unique.png')));
  assert.equal(await f.read('public/published-assets/shared.png'), 'shared');
  await fs.unlink(path.join(f.sourceDir, 'knowledge/renamed.md'));
  await f.run();
  assert.deepEqual(await fs.readdir(path.join(f.projectDir, 'src/content/notes')), []);
  assert.deepEqual(await fs.readdir(path.join(f.projectDir, 'public/published-assets')), []);
  assert.deepEqual(JSON.parse(await f.read('src/generated/note-graph.json')), {});
});

test('validation failure preserves every existing snapshot file', async (t) => {
  const f = await fixture(t);
  await f.put('knowledge/a.md', note('alpha', '旧正文。'));
  await f.put('knowledge/b.md', note('beta', '旧正文。'));
  await f.run();
  const before = await f.read('src/content/notes/alpha.md');
  const graphBefore = await f.read('src/generated/note-graph.json');
  await f.put('knowledge/a.md', note('alpha', '新正文。'));
  await f.put('knowledge/b.md', note('beta', '![[missing.png]]'));
  await assert.rejects(() => f.run(), /找不到公开附件/);
  assert.equal(await f.read('src/content/notes/alpha.md'), before);
  assert.equal(await f.read('src/generated/note-graph.json'), graphBefore);
  assert.deepEqual((await fs.readdir(f.projectDir)).filter((file) => file.startsWith('.obsidian-publish')), []);
});

test('image dimensions, reference links and PDF links are rewritten', async (t) => {
  const f = await fixture(t);
  await f.put('assets/图.png', 'image');
  await f.put('assets/paper.pdf', 'pdf');
  await f.put('knowledge/a.md', note('alpha', '![[图.png|640x320]]\n\n![图][image]\n\n[论文](../assets/paper.pdf#page=2)\n\n[image]: ../assets/图.png'));
  await f.run();
  const markdown = await f.read('src/content/notes/alpha.md');
  assert.match(markdown, /<img src="\/published-assets\/%E5%9B%BE.png" alt="图.png" width="640" height="320" loading="lazy" \/>/);
  assert.match(markdown, /\[图\]\(\/published-assets\/%E5%9B%BE.png\)/);
  assert.match(markdown, /\/published-assets\/paper.pdf#page=2/);
});

test('code and math literals preserve wiki text and comments, while prose comments are removed', async (t) => {
  const f = await fixture(t);
  await f.put('knowledge/a.md', note('alpha', '正文 %% hidden **private**\n\nmore hidden %% 结束。\n\n`[[private]] %% literal %%`\n\n```md\n[[private]]\n%% literal %%\n```\n\n$x = [[y]]$\n\n> [!note] 提示\n> 可见文字。'));
  await f.run();
  const markdown = await f.read('src/content/notes/alpha.md');
  assert.doesNotMatch(markdown, /hidden/);
  assert.match(markdown, /`\[\[private\]\] %% literal %%`/);
  assert.match(markdown, /\$x = \[\[y\]\]\$/);
  assert.match(markdown, /提示/);
});

test('table wikilinks support escaped alias pipes while escaped opening brackets stay literal', async (t) => {
  const f = await fixture(t);
  await f.put('knowledge/a.md', note('alpha', '概念。'));
  await f.put('knowledge/b.md', note('beta', '| 名称 |\n| --- |\n| [[a\\|概念]] |\n\n\\[[不存在]]\n\n[知识列表](/notes/knowledge/)'));
  await f.run();
  const markdown = await f.read('src/content/notes/beta.md');
  assert.match(markdown, /\[概念\]\(\/notes\/alpha\/\)/);
  assert.match(markdown, /不存在/);
  assert.match(markdown, /\/notes\/knowledge\//);
});

test('unpublished, unresolved and ambiguous notes fail with source position', async (t) => {
  for (const [body, expected] of [
    ['[[私密]]', /未公开笔记/],
    ['[私密](私密.md)', /未公开笔记/],
    ['[[缺失]]', /找不到公开目录内的笔记/],
    ['[[重名]]', /链接目标重名/],
  ] as const) {
    const f = await fixture(t);
    await f.put('knowledge/a.md', note('alpha', body));
    await f.put('knowledge/私密.md', note('private', 'private', '', false));
    await f.put('knowledge/重名.md', note('one'));
    await f.put('journal/重名.md', note('two'));
    await assert.rejects(() => f.run(), (error: unknown) => {
      assert.ok(error instanceof PublishError);
      assert.match(error.message, /knowledge\/a\.md:\d+:\d+/);
      assert.match(error.message, expected);
      return true;
    });
    assert.deepEqual(await fs.readdir(f.projectDir), []);
  }
});

test('missing headings, duplicate slugs, reserved slugs and invalid dates are rejected', async (t) => {
  const f = await fixture(t);
  await f.put('knowledge/a.md', note('alpha', '[[a#不存在]]'));
  await assert.rejects(() => f.run(), /没有标题/);
  await f.put('knowledge/a.md', note('alpha'));
  await f.put('knowledge/b.md', note('alpha'));
  await assert.rejects(() => f.run(), /slug 重复/);
  await fs.unlink(path.join(f.sourceDir, 'knowledge/b.md'));
  await f.put('knowledge/a.md', note('knowledge'));
  await assert.rejects(() => f.run(), /未占用/);
  await f.put('knowledge/a.md', note('alpha').replace('2026-10-24', '2026-02-30'));
  await assert.rejects(() => f.run(), /有效的 YYYY-MM-DD/);
});

test('unsupported executable/embedded content is reported instead of silently published', async (t) => {
  for (const [body, expected] of [
    ['![[a]]', /不支持笔记嵌入/],
    ['[[a#^block]]', /不支持块引用/],
    ['```dataview\nLIST\n```', /Dataview/],
    ['`= this.file.name`', /Dataview/],
    ['<img src="../../private.png">', /原始 HTML/],
    ['[危险](javascript:alert)', /不支持的链接协议/],
    ['%% 未结束的注释', /缺少结束/],
  ] as const) {
    const f = await fixture(t);
    await f.put('knowledge/a.md', note('alpha', body));
    await assert.rejects(() => f.run(), expected);
  }
});

test('traversal and symlinks cannot import content outside the chosen directory', async (t) => {
  for (const body of ['![private](../../secret.png)', '![private](..%2F..%2Fsecret.png)', '[[../../secret]]', '[private](/Users/example/private.md)']) {
    const f = await fixture(t);
    await f.put('knowledge/a.md', note('alpha', body));
    await assert.rejects(() => f.run(), /公开|绝对路径/);
  }
  const f = await fixture(t);
  await fs.writeFile(path.join(f.root, 'secret.png'), 'secret');
  await fs.symlink(path.join(f.root, 'secret.png'), path.join(f.sourceDir, 'assets/link.png'));
  await f.put('knowledge/a.md', note('alpha', '![[link.png]]'));
  await assert.rejects(() => f.run(), /符号链接/);
  await fs.unlink(path.join(f.sourceDir, 'assets/link.png'));
  await fs.mkdir(path.join(f.projectDir, 'src/content'), { recursive: true });
  await fs.symlink(f.sourceDir, path.join(f.projectDir, 'src/content/notes'));
  await assert.rejects(() => f.run(), /输出路径不能包含符号链接/);
});

test('canonical output overlap rejects project aliases and symlink parents without changing source bytes', async (t) => {
  async function treeBytes(root: string, relative = ''): Promise<Record<string, Buffer>> {
    const files: Record<string, Buffer> = {};
    for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) Object.assign(files, await treeBytes(root, name));
      else files[name] = await fs.readFile(path.join(root, name));
    }
    return files;
  }
  for (const variant of ['project-alias', 'project-parent-alias', 'source-parent-alias', 'both-parent-aliases', 'graph-output'] as const) {
    const f = await fixture(t);
    const managedSource = variant === 'graph-output' ? 'src/generated/note-graph.json' : 'src/content/notes';
    const realSource = path.join(f.projectDir, managedSource);
    await fs.mkdir(path.join(realSource, 'knowledge'), { recursive: true });
    await fs.mkdir(path.join(realSource, 'assets'), { recursive: true });
    await fs.writeFile(path.join(realSource, 'knowledge/original.md'), note('original', '不得改变的原稿。\n\n![[original.png]]'));
    await fs.writeFile(path.join(realSource, 'assets/original.png'), Buffer.from([0, 1, 2, 255, 64]));
    await fs.writeFile(path.join(realSource, '.source-marker'), 'SOURCE-BYTES');
    const before = await treeBytes(realSource);
    const alias = path.join(f.root, 'site-alias');
    const parentAlias = path.join(f.root, 'parent-alias');
    const secondParentAlias = path.join(f.root, 'second-parent-alias');
    await fs.symlink(f.projectDir, alias);
    await fs.symlink(f.root, parentAlias);
    await fs.symlink(f.root, secondParentAlias);
    const projectDir = variant === 'project-alias' ? alias
      : ['project-parent-alias', 'both-parent-aliases'].includes(variant) ? path.join(parentAlias, 'site') : f.projectDir;
    const sourceDir = ['source-parent-alias', 'both-parent-aliases'].includes(variant)
      ? path.join(secondParentAlias, 'site', managedSource) : realSource;
    await assert.rejects(() => publishVault({ sourceDir, projectDir, write: true }), /公开原稿目录与网站输出目录必须分开/);
    assert.deepEqual(await treeBytes(realSource), before, `${variant} changed source files`);
    assert.deepEqual((await fs.readdir(f.projectDir)).filter((file) => file.startsWith('.obsidian-publish')), []);
  }
});
