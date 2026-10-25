/** Public profile, curated from the supplied résumé. Keep private résumé fields out. */
export const profile = {
  name: '吴鸿钰',
  displayName: 'Leo',
  initials: 'L.',
  tagline: '探索芯片，也探索更大的世界。',
  bio: '我是吴鸿钰，吉林大学集成电路与集成系统专业本科生。喜欢把好奇心变成可以动手验证的东西：从 RISC-V 处理器到 FPGA，也从阅读、跑酷和每一次新的尝试中，慢慢找到自己的方向。',
  email: 'whystop0909@gmail.com',
  location: '吉林大学',
  education: [
    {
      period: '本科在读',
      title: '集成电路与集成系统 · 英才特色班',
      organization: '吉林大学 · 电子科学与工程学院',
      description: 'GPA 3.92 / 4.00，班级第一、排名前 1%。获得 2025–2026 学年国家奖学金。',
    },
    {
      period: '暑期学习',
      title: '国际暑期学校 · 优秀学员',
      organization: '东南大学',
      description: '参加国际暑期学校培训，在课堂与交流中拓宽视野。',
    },
  ],
  experiences: [
    {
      period: '技术实践',
      title: '从计算机体系结构到 RISC-V',
      organization: '集创赛 · 竞业达赛道',
      description: '自学计算机体系结构，自主搭建 RISC-V 五级流水线 CPU，把学习推进到具体的硬件实现。',
    },
    {
      period: '竞赛探索',
      title: '数学、建模与嵌入式系统',
      organization: '大学期间',
      description: '数学竞赛省三等奖、美国大学生数学建模竞赛 S 奖；获得嵌入式比赛 FPT 国际赛道线下决赛资格。',
    },
    {
      period: '校园生活',
      title: '在团队里参与，也承担责任',
      organization: '班级 · 学生会 · 跑酷社',
      description: '担任班级学习委员、学院学生会体育部成员、校源动力跑酷社副社长，参与无线电爱好者协会立项小组与 ICDA 部。',
    },
    {
      period: '志愿与运动',
      title: '把热情带到课堂之外',
      organization: '校园与社会实践',
      description: '参与“清茶送温暖”和宣传母校行分享活动；在 2026 年校运动会男子“时代列车”项目中获得团体第一名。',
    },
  ],
  skills: [
    {
      title: '数字设计',
      items: ['Verilog', 'RISC-V', '五级流水线 CPU', 'FPGA'],
    },
    {
      title: '系统与接口',
      items: ['C', 'AXI', 'DMA', 'FIFO', 'UART'],
    },
    {
      title: '正在探索',
      items: ['ysyx（一生一芯）', 'Linux', 'Attention 硬件加速'],
    },
  ],
  interests: ['跑酷与健身', '阅读与自我成长', '心理学与沟通', '动漫与故事'],
  now: [
    { label: '学习', text: '继续学习 ysyx 与 Linux，把计算机系统的知识连起来。' },
    { label: '整理', text: '回顾 RISC-V 项目的实现过程，让经历成为可以分享的知识。' },
    { label: '生活', text: '保持运动和阅读，也给新的尝试留一些空间。' },
  ],
  socials: [] as { label: string; url: string }[],
  resumeUrl: undefined as string | undefined,
};
