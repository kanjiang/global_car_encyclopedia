# 🚘 汽车大百科 · Global Car Encyclopedia

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![No Build](https://img.shields.io/badge/build-zero%20dependency-brightgreen)
![Offline Ready](https://img.shields.io/badge/offline-ready-success)

一个面向大众的**全球汽车科普图鉴**网页。收录来自德国、意大利、美国、日本、英国、法国、瑞典、中国等地的经典与前沿车型，涵盖超级跑车、豪华轿车、SUV、电动车、越野车、经典老爷车等类型。每款车都提供动力参数、驱动形式与有趣的冷知识。

> 🔗 **在线预览**：<https://kanjiang.github.io/global_car_encyclopedia/>
> （若暂时打不开，说明仓库 Settings → Pages 尚未启用，见下方「部署到 GitHub Pages」）

## ✨ 功能特性

- **本周精选轮播**：全宽大图轮播，**视差固定背景**（滚动时图片不动）、淡入淡出、自动播放进度条、左右滑动手势、键盘方向键、悬停暂停
- **汽车图鉴**：卡片式浏览，每张卡片展示极速 / 加速 / 马力等关键参数
- **车型对比**：卡片一键「＋对比」，底部对比栏最多选 4 款，弹出并排参数表并**高亮各项最优值（★）**
- **智能搜索**：按车型、品牌、国家、类型关键词模糊搜索
- **多维筛选**：按类型（标签）、国家（下拉）快速过滤
- **多种排序**：最高车速、加速最快、马力、年代
- **详情弹窗**：完整参数表 + 科普正文 + 冷知识卡片
- **朗读讲解**：基于浏览器语音合成，卡片速览朗读 / 详情完整讲解 / **整页连读**（自动高亮并滚动到当前车型），支持**中英文切换**
- **🎮 小小汽车问答**：面向孩子的问答小游戏，详见下方章节
- **酷炫 UI**：动态极光背景、玻璃拟态、霓虹辉光、卡片 3D 倾斜、滚动渐入、数字滚动、滚动进度条
- **暗色 / 亮色主题**：一键切换，自动记忆偏好
- **响应式设计**：手机、平板、桌面自适应
- **无障碍**：弹窗焦点陷阱与焦点回游、`aria-live` 答题播报、键盘可见焦点、尊重系统「减少动态效果」偏好

## 🎮 小小汽车问答

点导航「游戏」或首页彩色卡片进入，每轮 10 道题。

**7 种挑战**：🎲 混合挑战、🔍 看图猜车、🌍 认识国家、🏷️ 认识车型、🏆 巅峰对决（比极速 / 马力 / 加速）、🏎️ 超跑专场、⏱️ 计时挑战（每题 10 秒倒计时）。

**玩法特性**：

- 实时进度条与得分，答对变绿、答错标红并给出正确答案
- **连对连击**：连续答对显示 🔥 连击数，3 连及以上触发彩带庆祝与专属语音夸奖
- **音效**：用 Web Audio 实时合成答对 / 答错提示音，无需外部音频文件，离线可用
- **语音读题**：点「🔊 读题」听题目，答题后还有语音鼓励；跟随中英文设置
- **最佳成绩**：按模式用 localStorage 记录历史最高分，选关页显示 🏅 纪录，破纪录时弹出「🎉 新纪录！」
- 结果页按得分给 1–3 颗星与鼓励语，可「再玩一次」或「换个挑战」

> 题目由 `js/data.js` 的车型数据自动生成：比拼类题目会确保最优值唯一（数据中存在并列值），同一轮内不会重复出题。新增车型后题库自动扩充，无需额外维护。

## 📁 项目结构

```
汽车大百科/
├── index.html           # 页面结构（首页 / 图鉴 / 游戏 / 各类弹窗）
├── favicon.svg          # 站点图标
├── css/
│   └── style.css        # 样式（主题变量、卡片网格、响应式、动效）
├── js/
│   ├── data.js          # 汽车科普数据集（可自由扩充）
│   ├── core.js          # 共享基础：状态、DOM 引用、工具、弹窗管理、主题
│   ├── tts.js           # 语音朗读：讲解、整页连读、中英切换
│   ├── quiz.js          # 「小小汽车问答」小游戏
│   └── app.js           # 页面主逻辑：轮播、筛选、卡片、详情、对比、滚动效果
├── images/              # 各车型真实照片（WebP，本地存放，离线可用）
├── download_images.ps1  # 重新下载 / 更新车图的脚本
├── optimize_images.py   # 把车图批量转换 / 压缩为 WebP
└── README.md
```

各 JS 模块以传统 `<script>` 顺序加载，通过共享的 `window.CarApp` 命名空间通信（不使用 ES 模块，以便直接双击打开 `index.html` 也能运行）。加载顺序为 `data → core → tts → quiz → app`。

## 🖼️ 关于图片

每款车都配有真实照片，图片来源为 **Wikimedia Commons（自由授权）**，且已**下载到本地 `images/` 目录**，因此运行时**完全离线可用、无需访问外网**。

> 说明：Wikimedia 在中国大陆无法直接访问，所以图片不是在线热链，而是通过境外图片代理（images.weserv.nl）预先下载到本地。`download_images.ps1` 保留了下载逻辑，需要重新拉取或替换图片时可再次运行（该脚本运行时需要能联网）。

图片以 **WebP** 格式存放（900px 宽），相比原始 JPG 体积从 3.08 MB 降到 2.05 MB。重新下载图片后，可以用下面的脚本再压一遍：

```bash
pip install pillow
python optimize_images.py --replace   # 转为 WebP 并删除原始 jpg
```

若某张本地图片缺失或加载失败，页面会自动回退为「品牌配色渐变 + 图标」，不会出现破图。

## 🚀 运行方式

本项目为**纯静态网页，无需任何构建工具或依赖**。

方式一：直接双击 `index.html` 用浏览器打开即可。

方式二（推荐，避免个别浏览器的本地文件限制）：启动一个本地静态服务器。

```bash
# 使用 Python（大多数系统自带）
python -m http.server 8000
# 然后浏览器访问 http://localhost:8000
```

## 🌐 部署到 GitHub Pages（在线访问）

本项目是纯静态站点，可直接用 GitHub Pages 免费托管：

1. 打开仓库 **Settings → Pages**
2. **Source** 选择 `Deploy from a branch`
3. **Branch** 选择 `main`，目录选择 `/ (root)`，点击 **Save**
4. 等待 1–2 分钟，访问：<https://kanjiang.github.io/global_car_encyclopedia/>

> 站点为纯前端，无需任何服务器或数据库；图片已本地化，Pages 上线后全球均可正常显示。

## ➕ 如何添加新车型

编辑 `js/data.js`，在 `CARS` 数组中新增一个对象即可，字段含义见文件顶部注释：

```js
{
  id: "your-car-id",
  name: "车型名称",
  brand: "品牌",
  country: "国家",
  category: "类型",          // 会自动出现在筛选标签中
  year: 2024,
  priceRMB: "约 XX 万元",
  engine: "动力形式",
  power: "XXX 马力",
  topSpeed: 300,
  accel: 4.0,
  drivetrain: "四驱",
  seats: 5,
  accent: "linear-gradient(135deg,#000,#333)",  // 卡片配色
  emoji: "🚗",
  summary: "一句话简介",
  description: "科普正文…",
  facts: ["冷知识1", "冷知识2"],
}
```

保存后刷新页面，新车型会自动出现在图鉴中，统计数据、筛选项也会随之更新。

## 📝 说明

数据为科普性近似值，仅供学习交流，非商业用途。
