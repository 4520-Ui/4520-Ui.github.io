import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishVault, PublishError } from './publisher';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const help = `Obsidian 公开内容同步\n\n  npm run obsidian:check -- [--source /absolute/Web-Publish]\n  npm run obsidian:sync -- [--source /absolute/Web-Publish]\n\n默认只显示变更；--write 写入公开快照，随后使用 npm run dev 预览。\n不会修改 Obsidian 原稿、提交 Git 或自动发布。\n本地配置：.obsidian-publish.local.json，内容为 {"source":"公开目录绝对路径"}。`;

async function main() {
  if (args.includes('--help') || args.includes('-h')) { console.log(help); return; }
  let source: string | undefined, write = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--write') write = true;
    else if (args[index] === '--source' && args[index + 1] && !args[index + 1]!.startsWith('--')) source = args[++index];
    else throw new PublishError(`未知参数或缺少参数值：${args[index]}\n${help}`);
  }
  if (!source) {
    try {
      const local = JSON.parse(await fs.readFile(path.join(projectDir, '.obsidian-publish.local.json'), 'utf8'));
      if (typeof local.source !== 'string') throw new Error('missing source');
      source = local.source;
    } catch { throw new PublishError('请先创建 .obsidian-publish.local.json 并填写 source，或使用 --source 指定公开目录。'); }
  }
  if (!source) throw new PublishError('source 不能为空，请填写公开文件夹的绝对路径。');
  const result = await publishVault({ sourceDir: source, projectDir, write });
  console.log(`${write ? '已同步公开快照' : '变更预览（未写入）'}：${result.notes} 篇笔记，${result.assets} 个附件。`);
  const labels = { add: '新增', change: '更新', remove: '下架' };
  for (const change of result.changes) console.log(`${labels[change.action]}  ${change.path}`);
  if (!result.changes.length) console.log('内容没有变化。');
  if (write) console.log('运行 npm run dev 查看页面；检查完成后再提交并推送 GitHub。');
}

main().catch((error) => {
  console.error(error instanceof PublishError ? error.message : `同步失败，原快照已保留：${(error as Error).message}`);
  process.exitCode = 1;
});
