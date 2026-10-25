# Obsidian 公开内容发布

网站只接收 `Web-Publish/knowledge/` 和 `Web-Publish/journal/` 中 `publish: true` 的笔记。图片和 PDF 放在 `Web-Publish/assets/`，只复制公开笔记实际引用的附件。

## 使用

1. 将 `examples/web-publish/` 中的模板复制到主知识库的 `Web-Publish/`，保持两个模板的 `publish: false`。
2. 在网站根目录建立不提交到 Git 的 `.obsidian-publish.local.json`，填写 `{"source":"公开文件夹的绝对路径"}`。
3. `npm run obsidian:check`：校验属性、链接和附件，列出新增、修改与下架项，不写入任何文件。
4. `npm run obsidian:preview`：校验并同步公开快照，然后启动本地预览。也可分别执行 `npm run obsidian:sync` 和 `npm run dev`。
5. 检查网页与 Git 变更后，再提交和推送网站仓库。工具不会操作 Git，不会自动上传，也不会修改 Obsidian 原稿。

可用 `--source /absolute/path/Web-Publish` 临时覆盖本地配置。若没有安装 npm 脚本，也可直接运行 `npx tsx scripts/obsidian/cli.ts --source /absolute/path/Web-Publish`，增加 `--write` 才会写入快照。

## 属性与链接

必须填写 `title`、`slug`、`summary`、`date`；`tags` 默认空列表，`updated` 可选。`slug` 使用小写英文、数字与连字符，必须唯一；`knowledge`、`journal` 等列表地址不能作为 slug。日期采用 YYYY-MM-DD；发布开关只接受布尔值 `true`。

支持 `[[笔记]]`、`[[笔记|显示文字]]`、`[[笔记#标题]]`、Markdown 链接、图片、PDF 和公开笔记别名。重名时使用 `[[knowledge/子目录/笔记]]`。Markdown 相对路径以当前笔记所在文件夹为起点；例如 `![说明](../assets/example.png)`。图片也可写成 `![[example.png|640]]` 或 `![[example.png|640x360]]`。

重命名笔记时保持 `slug` 不变，网站网址及 `/notes/slug/` 形式的链接就保持稳定。按文件名书写的双链仍需由 Obsidian 同步更新；若未更新，可把旧文件名加入被引用笔记的 `aliases`。工具不会自行猜测旧文件名对应的新文件。

代码、公式和 Mermaid 源码保留，由网站渲染层处理。Callout 保留为 Markdown 引用块。整篇笔记嵌入、块引用、Dataview、原始 HTML、Canvas 和 Excalidraw 需要先转换成正文、公开链接或图片，校验时会标出位置。

## 数据边界

- 目录外笔记、未公开笔记和未被引用附件不会进入快照；引用它们时校验失败，不沿双链扩大发布范围。
- 公开稿仅导出约定的属性，移除 Obsidian `%% 注释 %%`。代码和公式中的同样字符保持原样。
- 所有校验通过后才替换网站的 `src/content/notes/`、`public/published-assets/` 和 `src/generated/note-graph.json`。这些路径由发布工具管理，请不要手工维护第二份笔记。
- 正常的校验失败不会改变旧快照；写入阶段异常会尝试回滚。终止进程或断电后的系统级恢复不属于事务保证，重新同步前请先检查 Git 变更。
- 移出目录、删除或关闭发布开关后，下一次同步清除对应快照；共享附件仍被引用时保留。后续部署会下架当前页面，但 Git 历史和外部缓存不随之清除。
- 不读取其他知识库目录，不支持符号链接，不自动提交、推送或后台监听。
