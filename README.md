# BoundryLab — 电磁场边界效应可视化

交互式网页系统，用于可视化**点电荷在介质分界面处的电磁场行为**。核心展示：势函数 φ 连续、法向电场 Eₙ 跳变、法向电位移 Dₙ 连续、电场线折射。

**在线访问：[https://zzzjh-debug.github.io/BoundryLab/](https://zzzjh-debug.github.io/BoundryLab/)**

## 运行方式

```bash
cd 边界实验室
npx serve .
```

浏览器打开 `http://localhost:3000`（或命令行提示的端口）。

无需安装任何依赖，纯静态 HTML + CSS + JS，CDN 加载 Three.js 和 Chart.js。

## 部署与更新

项目托管在 GitHub Pages，域名 `zzzjh-debug.github.io/BoundryLab`。当前机器已配置 SSH 免密推送（`~/.ssh/id_ed25519_boundrylab`）。

**修改后更新网站：**
```bash
cd "/c/Users/zjh20/Desktop/桌面待办/边界实验室"
git add -A
git commit -m "描述你的改动"
git push
```

推送后约 1 分钟自动部署到线上，刷新链接即可看到更新。

**首次在新电脑上部署：**
1. `git clone git@github.com:zzzjh-debug/BoundryLab.git`
2. 如无法 SSH 连接 GitHub，在 `~/.ssh/config` 中添加：
   ```
   Host github.com
       HostName ssh.github.com
       Port 443
       User git
   ```

## 项目结构

```
边界实验室/
├── index.html           # 主页面
├── css/
│   └── style.css        # 样式（深色主题）
├── js/
│   ├── physics.js       # 物理引擎（镜像法）
│   ├── threeView.js     # 3D 可视化（Three.js，场线追踪）
│   ├── profiles.js      # 剖面图（Chart.js）
│   ├── probe.js         # 探针系统
│   └── main.js          # 入口 + 状态管理 + 热力图渲染
├── output/              # 截图 + 物理解释文档
│   ├── README.md        # 物理规律演示文档（图文）
│   └── *.png            # 各场景截图
└── 设计.md              # 原始设计文档
```

## 模块说明

### physics.js — 物理引擎

镜像法求解点电荷 + 平面介质分界面的电磁场：

- 上半空间 (z>0, ε₁)：φ = (1/4πε₁) [q/R + q'/R']，q' = q·(ε₁-ε₂)/(ε₁+ε₂)
- 下半空间 (z<0, ε₂)：φ = (1/4πε₂) [q''/R]，q'' = q·2ε₂/(ε₁+ε₂)
- E = -∇φ（解析梯度），D = εE

导出 `computeField(x,y,z,params)` 和 `sampleProfile(x0,y0,zMin,zMax,n,params)`。

### threeView.js — 3D 可视化

基于 Three.js：
- **场线追踪**：从电荷周围的种子点出发，沿 E 方向积分生成连续曲线，以间隔排列的带箭头小柱体渲染
- **半空间着色**：上半 (ε₁) 淡蓝、下半 (ε₂) 淡棕，透明度 10%
- **坐标轴**：红 X、绿 Y、蓝 Z，带箭头和标签
- **分界面**：z=0 处半透明参考面
- **截面标记**：y=0 平面虚线框 + 标签
- **探针标记**：黄色小球跟随鼠标

两种显示模式：全部电场线 / 仅 y=0 平面电场线。

### profiles.js — 剖面图

三张 Chart.js 折线图并排：
- φ(z)：势函数（连续）
- Eₙ(z)：法向电场（在 z=0 处跳变，比值 = ε₂/ε₁）
- Dₙ(z)：法向电位移（连续）

虚线标记 z=0 分界面，底部标注物理规律。

### probe.js — 探针系统

鼠标悬停 3D 视图 → 射线与 y=0 平面求交 → 显示该点的完整场值：
- 坐标 (x, y=0 固定, z)
- φ, Eₙ, Eₜ, Dₙ, Dₜ

### main.js — 入口

- 状态管理：参数同步 UI → Physics → 3D → Profiles → Heatmaps
- 右侧两张 2D 热力图：φ(x,0,z) 和 φ(x,y,0)，百分位色阶
- 参数滑块绑定和显示模式切换

## 参数控制

| 参数 | 含义 | 范围 |
|------|------|------|
| ε₁ | 上半空间介电常数 | 0.5–10 |
| ε₂ | 下半空间介电常数 | 0.5–10 |
| q | 点电荷电量 | 0.1–5 |
| z₀ | 电荷高度（距界面距离）| 0.1–3 |
| x₀, y₀ | 电荷水平位置 | -2–2 |

## 物理规律验证

系统可从"3D 场线 + 热力图 + 剖面曲线 + 探针数值"四个层面交叉验证介质分界面的电磁场边界条件：

| 物理量 | z=0 处行为 | 验证方式 |
|--------|-----------|---------|
| φ | 连续 | 探针上下 φ 值相等；φ(z) 曲线平滑 |
| Eₙ | 跳变，比值=ε₂/ε₁ | 探针上下 Eₙ 值比值；Eₙ(z) 曲线跳变 |
| Dₙ | 连续 | 探针上下 Dₙ 值相等；Dₙ(z) 曲线平滑 |
| E 场线 | 折射，tanθ₁/tanθ₂=ε₁/ε₂ | 3D 视图中场线在 z=0 处弯折 |

详见 `output/README.md`。
