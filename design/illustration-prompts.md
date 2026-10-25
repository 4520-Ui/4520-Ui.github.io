# 工作室主视觉 · 生成记录

## 幻想版 · studio-dream

更新依据：用户进一步明确，网站主要为自己和好玩而做，希望创意超出专业方向。此版替换工程符号，呈现想象中的小世界，不表示真实生活或职业场景。

方式：内置 image_gen，一次生成；保留前版 `studio-world.png`。
输入：`src/assets/studio/studio-world.png`（构图参考）、`../ip-design-v1/avatar-master.png`（身份参考）。
输出：`src/assets/studio/studio-dream.png`，1536 × 1024，PNG。
原始生成记录 ID：`exec-13061c65-df8e-4170-b0a1-38d1d9e0861b`。

### 结果检查

角色已改为托腮看向访客，桌面为星球与云朵涂鸦；工程显示器和电路板已移除。画面包含云鲸、行星盆栽、海景小门与悬浮绘本。没有明显文字、品牌、水印或界面元素。保持了黑发、细框眼镜、卫衣；人物的脸部尺寸较小，面部细节应以原始头像为准。

- 左上 x=1–30%、y=2–29% 为最安静留白，适合少量标题。
- 云鲸中心约 x=23%、y=42%，范围约 x=3–41%、y=30–54%。
- 角色面部中心约 x=65%、y=43%。
- 台灯灯罩中心约 x=85%、y=35%。
- 行星盆栽中心约 x=87%、y=57%。
- 海景小门中心约 x=94%、y=52%。
- 手机若以人物为焦点裁切，会丢失云鲸；建议整幅展示或分段保留场景，不要承诺所有物件热点在窄屏仍可点。
- 如需文字覆盖图片，务必验证实际背景对比；首屏长标题可独立于插画排版。

### 实际提示词

```text
Use case: stylized-concept.
Asset type: original landscape 3:2 website hero illustration, fantastical personal dream studio.

Input image 1 is the existing scene/edit reference: keep the appealing open-sided floating studio, right-side seated person, warm coral canopy, arched architecture, wooden desk, greenery and airy landscape. REIMAGINE the objects and simplify the rendering as described below.
Input image 2 is the definitive character identity reference: fluffy charcoal-black side-parted hair, fine dark oval glasses, gentle eyes, one small mole on his LEFT cheek (viewer's RIGHT), charcoal hoodie with ivory lining. Preserve this recognizable anime identity.

Primary change: this is a personal imagination playground, not a profession or engineering portfolio. REMOVE ALL circuit boards, chip parts, electronics, technical drawings, screen diagrams, soldering tools and engineering motifs. The young man relaxes at his desk with one hand supporting his cheek, looking up with a curious slight smile from an open doodle sketchbook. No circuit board in his hands. A playful ceramic teacup sits nearby. A modest open book floats just above the desk, pages with only abstract doodles and no text.

Three memorable surreal ideas, clearly readable and coherent:
1. A large gentle CLOUD WHALE drifts through the left-middle distant sky. Whale-shaped fluffy cream cloud with pale mist-blue underside and soft lavender shadows, calm expressive eye, graceful tail. The creature is magical and friendly, not realistic or monstrous. Position it below the empty headline area, around x20%, y52%, and keep contrast soft.
2. A small potted plant on the right desk/shelf grows a tiny ringed planet as its flower: one green stem holding a miniature pastel Saturn with a lavender ring. Clear silhouette and small scale.
3. REPLACE the old rectangular computer monitor on the far right with a small freestanding ARCHED DOORWAY portal on the desk, a thick warm wood arch looking into a tiny tranquil turquoise ocean and peach horizon. It must read as an impossible doorway, not a monitor/screen.

Composition: landscape 3:2, foreground studio and character occupy right 60–65%, room and island legible. Make LEFT 30–35% calmer and more spacious than the original; top-left x0–32%, y0–38% should be almost plain ivory cloud sky, no objects, for HTML heading. Use a softer faraway archipelago in the lower-left, with fewer tiny islands and fewer micro-details. Show the warm lamp clearly beside the portal on the right. Preserve depth and magical rocky garden underneath.

Art direction: expressive handdrawn comic/indie animated film concept art, bolder simplified silhouettes and clean organic ink contours with dry gouache flat color, soft sparse coloured-pencil texture. Imaginative, personal, humorous but serene. More graphic confident shape design, less dense realistic rendering than input 1. Warm cloud cream, mist blue, sage green, coral canopy, touches of lavender. Natural light and subtle paper grain.

Constraints: only one person, preserve facial identity. Original illustration with no copied web artwork. NO text, words, letters, numbers, logos, labels, typography, UI, caption or watermark. NO electronics or engineering symbols. Do not add other major fantasy objects. No photorealism, glossy 3D, neon, corporate vector clipart, excessive clutter or dense repeated textures. The output is the illustration only.
```


日期：2026-10-24。
方式：内置 image_gen（默认模式），使用人物参考图生成原创场景。
参考角色：`../ip-design-v1/avatar-master.png`，仅用于人物身份与服装识别。
输出：`src/assets/studio/studio-world.png`，1536 × 1024，PNG。
原始生成记录 ID：`exec-6a427be2-8ed3-4eb7-99a5-33252b63857b`。项目内已保存完整素材，不依赖个人目录。

## 检查与构图

已查看生成结果：角色在画面右侧研究电路，眼镜、黑发与卫衣一致；小痣位于面部右侧。拱窗、远山浮岛、植物、书架、台灯、笔记、纸飞机均可辨识。没有明显文字、标志、水印或界面元素。

- 角色面部中心约 x=67%、y=38%。
- 台灯灯罩中心约 x=85%、y=39%；可点击区域建议 x=81–90%、y=32–46%。
- 纸飞机中心约 x=20%、y=25%。
- 最安静的文字空间为 x=2–28%、y=3–36%；左侧下部已有远山与云，不宜直接压大段文字。
- 画面适合桌面全幅铺开。手机建议先显示独立标题，再用右侧为焦点的局部场景，或保留完整图作为单独横幅；不得把网页正文硬叠在复杂场景中。
- 图中已有明亮台灯。网页的灯光互动可增加局部柔光与暖色状态，并用明确状态标签描述；不要宣称静态原图灯泡真的熄灭。

## 实际提示词

```text
Use case: stylized-concept.
Asset type: original landscape 3:2 hero illustration for Leo's personal website, project-ready, high detail.

Input image 1 is the character IDENTITY reference only. Keep his recognizable fluffy charcoal-black side-parted hair, fine dark rounded oval glasses, gentle slightly half-lidded dark eyes, one small mole on the character's LEFT cheek (viewer's RIGHT), charcoal hoodie with ivory lining. Adapt this same young adult anime character to the scene, with coherent proportions.

Primary request: a warm handdrawn artist-engineer's studio on a small floating rocky garden island, opening onto a poetic impossible landscape. A memorable original little world full of curiosity and calm. Confident ink/comic contours with dry gouache, coloured pencil and subtle paper texture; beautifully crafted modern illustrated storybook, depth through layered shapes. No glossy 3D.

Composition: a landscape 3:2 image. The open-sided room and island fill the RIGHT 60–65 percent, seen in a readable three-quarter architectural perspective, not isometric game art. LEFT 30–35 percent is spacious quiet pale cream sky with very faint distant mist-blue mountain shapes, deliberately empty for a website headline. Keep the room's silhouette and right edges fully inside frame. The island and warm room are visually large and delightful rather than tiny distant scenery.

Scene details: Leo sits comfortably at a wooden work desk, investigating a small circuit board with a pencil beside an open notebook. A monitor displays an abstract circuit diagram with NO letters. A clearly visible small articulated desk lamp with a warm yellow shade sits on the desk; include a terracotta mug. Behind him, a rounded arched window frames blue mountain islands and cloud shapes. A bookshelf holds a modest number of books, paper folders and small leafy plants. Warm coral-colored canopy and curved architectural edges, sage foliage hanging over the rocky island, a tiny path leading toward the island edge. A simple paper airplane in the sky connects the open space to the studio.

Palette and mood: warm ivory paper, mist blues, rich muted ink blue, sage/plant green, warm wood, small coral and honey accents. Inviting afternoon light, imaginative but serene. Clear focal hierarchy and crisp legible object silhouettes, organic lines, restrained fine-grain texture, generous air.

Constraints: ORIGINAL artwork. No words, letters, numbers, logos, UI controls, captions, borders, watermarks or typography. Do not copy any existing website or its artwork. Only one person. Preserve the character's identity. Avoid photorealism, childish clipart, stock vector corporate graphics, excessive clutter, gradients, neon and heavy texture.
```
