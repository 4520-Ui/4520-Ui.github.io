import assert from 'node:assert/strict';
import test from 'node:test';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import { remarkCallouts, remarkMermaid, rehypeSite } from '../../src/plugins/markdown.js';

async function render(markdown: string, base = '/') {
  return String(await unified()
    .use(remarkParse).use(remarkGfm).use(remarkCallouts).use(remarkMermaid)
    .use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw)
    .use(rehypeSite, { base }).use(rehypeStringify).process(markdown));
}

test('callouts preserve rich titles, body paragraphs and nested content', async () => {
  const html = await render('> [!tip] **先验证** 再优化\n> 从证据出发。\n>\n> - 数值\n> - 时序\n>\n> > [!note]\n> > 一次只改一个变量。');
  assert.match(html, /<aside class="callout callout-tip" data-callout="tip">/);
  assert.match(html, /class="callout-title"><strong>先验证<\/strong> 再优化<\/p>/);
  assert.match(html, /<p>从证据出发。<\/p>/);
  assert.match(html, /<li>\s*(?:<p>)?数值(?:<\/p>)?\s*<\/li>/);
  assert.match(html, /class="callout-title">笔记<\/p>/);
  assert.match(html, /一次只改一个变量。/);
});

test('folding callouts have keyboard-accessible summaries and correct initial state', async () => {
  const html = await render('> [!warning]- 收起\n> 内容\n\n> [!example]+ 展开\n> 示例');
  assert.match(html, /<details class="callout callout-warning" data-callout="warning">/);
  assert.match(html, /<summary class="callout-title">收起<\/summary>/);
  assert.match(html, /<details class="callout callout-example" data-callout="example" open>/);
});

test('callout marker is ignored in code and ordinary blockquotes', async () => {
  const html = await render('```md\n> [!warning] code\n```\n\n> Plain quote\n\n`[!note]`');
  assert.doesNotMatch(html, /<aside|<details/);
  assert.match(html, /<blockquote>/);
});

test('Mermaid code is escaped text, not executable markup', async () => {
  const html = await render('```mermaid\ngraph TD\nA["</pre><script>alert(1)</script><img src=x onerror=alert(1)>"] --> B\n```');
  assert.match(html, /<pre class="mermaid" data-mermaid="true">/);
  assert.match(html, /&#x3C;img/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /<script\b/i);
  assert.equal([...html.matchAll(/<\/pre>/g)].length, 1);
  assert.match(html, /graph TD/);
});

test('GitHub-style heading ids support Chinese, duplicate text and inline code', async () => {
  const html = await render('# 验证与优化\n\n## 验证与优化\n\n## 使用 `RTL`');
  assert.match(html, /id="验证与优化"/);
  assert.match(html, /id="验证与优化-1"/);
  assert.match(html, /id="使用-rtl"/);
});

test('root-relative links and images receive base exactly once', async () => {
  const html = await render('[笔记](/notes/a/#验证)\n\n![图](/published-assets/test.png)\n\n<img src="/published-assets/wide.png" width="640" alt="示意">\n\n[已处理](/portfolio/notes/b/)\n\n[协议](//example.com/a)\n\n[外部](https://example.com/)\n\n[标题](#验证)', '/portfolio/');
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => decodeURIComponent(match[1]));
  assert.ok(hrefs.includes('/portfolio/notes/a/#验证'));
  assert.match(html, /src="\/portfolio\/published-assets\/test.png"/);
  assert.match(html, /src="\/portfolio\/published-assets\/wide.png" width="640"/);
  assert.doesNotMatch(html, /portfolio\/portfolio/);
  assert.match(html, /href="\/\/example.com\/a"/);
  assert.match(html, /href="https:\/\/example.com\/"/);
  assert.ok(hrefs.includes('#验证'));
});

test('domain-root deployments leave links unchanged and footnotes keep anchors', async () => {
  const html = await render('[笔记](/notes/a/)\n\n事实[^1]\n\n[^1]: 参考资料');
  assert.match(html, /href="\/notes\/a\/"/);
  assert.match(html, /href="#user-content-fn-1"/);
});
