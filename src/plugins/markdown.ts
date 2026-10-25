import type { Root as MarkdownRoot, Paragraph, PhrasingContent } from 'mdast';
import type { Element, Root as HtmlRoot, RootContent } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import GithubSlugger from 'github-slugger';

const calloutLabels: Record<string, string> = {
  note: '笔记', abstract: '摘要', summary: '摘要', tldr: '摘要',
  info: '说明', todo: '待办', tip: '提示', hint: '提示', important: '重要',
  success: '完成', check: '完成', done: '完成', question: '问题', help: '帮助',
  faq: '常见问题', warning: '注意', caution: '注意', attention: '注意',
  failure: '未通过', fail: '未通过', missing: '缺失', danger: '警告',
  error: '错误', bug: '问题', example: '示例', quote: '引用', cite: '引用',
};

/** Render an Obsidian callout without interpolating HTML or touching code. */
export const remarkCallouts: Plugin<[], MarkdownRoot> = () => (tree) => {
  visit(tree, 'blockquote', (node) => {
    const paragraph = node.children[0];
    if (paragraph?.type !== 'paragraph') return;
    const first = paragraph.children[0];
    if (first?.type !== 'text') return;
    const marker = /^\[!([a-z][\w-]*)\]([+-])?(?=[ \t\n]|$)[ \t]*/i.exec(first.value);
    if (!marker) return;

    const kind = marker[1].toLowerCase();
    const fold = marker[2];
    const title: PhrasingContent[] = [];
    const body: PhrasingContent[] = [];
    let afterTitle = false;

    for (const [index, original] of paragraph.children.entries()) {
      const child = index === 0
        ? { ...first, value: first.value.slice(marker[0].length) }
        : original;
      if (afterTitle) {
        body.push(child);
      } else if (child.type === 'text' && child.value.includes('\n')) {
        const split = child.value.indexOf('\n');
        if (split > 0) title.push({ ...child, value: child.value.slice(0, split) });
        if (split + 1 < child.value.length) body.push({ ...child, value: child.value.slice(split + 1) });
        afterTitle = true;
      } else if (child.type === 'break') {
        afterTitle = true;
      } else if (child.type !== 'text' || child.value.length > 0) {
        title.push(child);
      }
    }

    const heading: Paragraph = {
      type: 'paragraph',
      data: { hName: fold ? 'summary' : 'p', hProperties: { className: ['callout-title'] } },
      children: title.length ? title : [{ type: 'text', value: calloutLabels[kind] ?? '笔记' }],
    };
    const remainder = node.children.slice(1);
    if (body.length) remainder.unshift({ ...paragraph, children: body });
    node.children = [heading, ...remainder];
    node.data = {
      ...node.data,
      hName: fold ? 'details' : 'aside',
      hProperties: {
        className: ['callout', `callout-${kind}`],
        dataCallout: kind,
        ...(fold === '+' ? { open: true } : {}),
      },
    };
  });
};

/** Mermaid stays inert text until the page's strict Mermaid renderer runs. */
export const remarkMermaid: Plugin<[], MarkdownRoot> = () => (tree) => {
  visit(tree, 'code', (node, index, parent) => {
    if (node.lang?.toLowerCase() !== 'mermaid' || index === undefined || !parent) return;
    parent.children[index] = {
      type: 'paragraph',
      data: { hName: 'pre', hProperties: { className: ['mermaid'], dataMermaid: 'true' } },
      children: [{ type: 'text', value: node.value }],
    };
  });
};

export interface SiteMarkdownOptions { base?: string }

function textContent(node: RootContent): string {
  if (node.type === 'text') return node.value;
  if ('children' in node) return node.children.map(textContent).join('');
  return '';
}

/** Keep generated links portable between username.github.io and /repository/. */
export const rehypeSite: Plugin<[SiteMarkdownOptions?], HtmlRoot> = (options = {}) => {
  const base = (options.base ?? '/').replace(/\/+$/, '');
  if (base && !base.startsWith('/')) throw new Error('Markdown base must start with /.');

  function prefix(value: unknown): unknown {
    if (typeof value !== 'string' || !base || !value.startsWith('/') || value.startsWith('//')) return value;
    if (value === base || value.startsWith(`${base}/`) || value.startsWith(`${base}?`) || value.startsWith(`${base}#`)) return value;
    return `${base}${value}`;
  }

  return (tree) => {
    const slugger = new GithubSlugger();
    visit(tree, 'element', (node: Element) => {
      for (const attribute of ['href', 'src']) {
        if (attribute in node.properties) node.properties[attribute] = prefix(node.properties[attribute]) as string;
      }
      if (/^h[1-6]$/.test(node.tagName)) {
        const generated = slugger.slug(textContent(node));
        if (!node.properties.id) node.properties.id = generated;
      }
    });
  };
};
