# Leo 的奇想小屋

一个可以随便逛逛的中文个人小世界，包含手记、生活、作品与联系方式。首页采用原创幻想插画、纸张和书页式章节，附带漫游签、暖光和纸飞机小互动。使用 Astro 7、TypeScript 和 CSS 构建静态页面，Markdown 通过 unified 处理，部署到 GitHub Pages。Obsidian 是笔记的编辑来源，网站保存经过筛选的公开快照。

## 本地运行

需要 **Node.js 24** 和 npm。在网站仓库根目录执行：

```sh
npm ci
npm run dev
```

浏览器打开终端显示的本地地址。提交前运行：

```sh
npm test
npm run build
npm run preview
```

`build` 包含 Astro 类型检查，生成结果位于 `dist/`。`test` 验证 Markdown 渲染、公开笔记筛选、附件与双链转换、下架及失败时保留旧快照等行为。

## 修改网站内容

| 内容 | 编辑位置 |
| --- | --- |
| 个人介绍、经历、技能、邮箱与社交链接 | `src/data/profile.ts` |
| 项目介绍 | `src/content/projects/`，参考已有项目的 Markdown 属性 |
| 动漫头像与人物素材 | `src/assets/profile/avatar.png`、`character.png` |
| 项目封面、社交分享封面 | `public/images/`、`public/social-cover.png` |
| 幻想小屋主视觉 | `src/assets/studio/studio-dream.png` |
| 颜色、排版与响应式样式 | `src/styles/global.css`、`studio.css`、`interiors.css` |
| 漫游签问题与样式 | `src/components/WanderingNote.astro` |
| 公开笔记 | 在 Obsidian 中编辑，再使用下文的发布流程 |

项目和笔记的 `slug` 决定网址。改标题或文件名时保留 `slug`，可以继续使用原有链接。项目中的日期、个人职责与成果应以真实材料为准。

初始内容包含一项由简历确认的 RISC-V 五级流水线 CPU 项目，以及围绕本站用途整理的两篇开篇笔记；尚未提供的性能数据与项目细节没有补写。人物素材沿用用户提供的个人 IP 设计成果，这套素材此前由内置 image_gen 生成。原始简历和生活照片未包含在网站中。

主视觉以既有动漫角色为参考，由内置 image_gen 生成。完整提示词和素材记录位于 `design/illustration-prompts.md`；云鲸、行星盆栽等为幻想设计，并非个人经历。首页的漫游签不保存访客信息，动画尊重系统“减少动态效果”设置，没有背景音或强制游戏流程。

联系页使用配置的公开邮箱和复制邮箱按钮。这是静态网站，没有服务端表单收件功能。需要添加公开简历时，将适合公开的 PDF 放入 `public/`，再填写 `profile.resumeUrl`。

## 从 Obsidian 发布笔记

在自己的知识库中建立以下公开成稿区：

```text
Web-Publish/
├── knowledge/   # 知识分享，可按主题继续分目录
├── journal/     # 成长记录
└── assets/      # 准备公开的图片与 PDF
```

可参考 `examples/web-publish/` 中默认关闭发布的模板。首次接入时，先将仍需保留的站内笔记原稿放进相应目录，保持原来的 `slug`；同步会用来源目录中的公开内容替换受管理的快照。

在网站根目录创建 `.obsidian-publish.local.json`，填写本机的实际路径。此配置已被 Git 忽略：

```json
{
  "source": "/absolute/path/to/Web-Publish"
}
```

每篇文章需要 `title`、`slug`、`summary`、`date`；`tags` 和 `updated` 可选。整理完成后，在 Obsidian 属性中开启 `publish`。只有指定目录内 `publish: true` 的笔记会参与发布。

```sh
# 只检查并查看新增、修改、下架清单
npm run obsidian:check

# 检查通过后更新网站快照
npm run obsidian:sync

# 同步并启动本地网页预览
npm run obsidian:preview
```

工具不会自动提交、推送或修改 Obsidian 原稿。`src/content/notes/`、`public/published-assets/` 与 `src/generated/note-graph.json` 由它管理，不要在这些位置维护另一份笔记。

支持 Markdown、公开笔记双链、显示别名、标题锚点、图片尺寸、PDF 链接、Callout、代码、数学公式和 Mermaid。整篇笔记嵌入、块引用、Dataview、原始 HTML、Canvas 和 Excalidraw 需要先整理成静态正文、公开链接或图片。具体属性、路径解析与错误处理见 [Obsidian 发布工具说明](scripts/obsidian/README.md)。

只把筛选后的公开快照提交到网站仓库；不要上传整个知识库。关闭发布开关、删除或移出公开目录后，下一次同步与部署会下架相应页面；Git 历史及外部缓存不会因此自动清除。

## 预览后提交与部署

默认部署目标为 [4520-ui.github.io](https://4520-ui.github.io/)，对应个人主页仓库 `4520-ui.github.io`。首次设置仓库后，在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

确认本地网页、测试、构建及文件变更正确后，再手动提交。例如仅更新公开内容时：

```sh
git status --short
git diff --stat
git diff
git add src public
git diff --cached
git commit -m "更新公开内容"
git push origin main
```

`.github/workflows/deploy.yml` 在推送 `main` 后运行校验并部署；Pull Request 仅做校验，也支持从 Actions 页面手动触发。部署使用 GitHub Pages 返回的正式域名和路径。查看 Actions 的完成状态，再检查线上页面；构建失败时不会替换上一版成功发布的网站。

### 正式域名与子路径

`SITE_URL` 设置站点的**域名来源**，不包含项目路径；`BASE_PATH` 设置站点路径。下列命令适用于 macOS / Linux：

```sh
# 个人主页仓库：域名根路径
SITE_URL=https://4520-ui.github.io BASE_PATH=/ npm run build

# 普通项目仓库，例如仓库名为 personal-site
SITE_URL=https://4520-ui.github.io BASE_PATH=/personal-site/ npm run build
```

正式部署由 Actions 自动设置这两个值。无配置时使用 `http://localhost:4321` 与 `/`，本地页面带 `noindex`，避免将预览地址当成正式站点。修改子路径后应检查导航、文章链接、图片和分享封面都包含正确前缀。

日常维护流程：**在 Obsidian 或对应资料文件中编辑 → 检查与预览 → 测试和构建 → 查看 Git 变更 → 手动推送 → 确认线上结果**。
