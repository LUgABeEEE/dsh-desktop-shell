# dsh-desktop-shell 开发方案

> 目标读者：接手开发的 Agent / 开发者。读完即可开工。
> 版本：v1.0 · 2026-10-03

---

## 1. 背景与问题

DeepSeek Harness（DSH）桌面端是 Electron 壳 + Web 应用。社区 4275 个插件里
**UI/皮肤类占 21%**，而「桌面 OS 集成」类目只有约 32 个，几乎空白。

用户在桌面端最常被问到、但当前做不到的事：

| 场景 | 现状 | 目标 |
|---|---|---|
| 任意界面快速唤起 DSH | 只能点任务栏/托盘 | 全局热键一按弹出 |
| 任务完成 / 需审批时通知 | 只能在窗口里看 | 系统原生通知，点击跳回 |
| 截图丢进会话 | 先存文件再拖入 | 热键截图自动插入对话 |
| 看到一段文字想问 DSH | 复制 → 切窗口 → 粘贴 | 剪贴板监听 / 选中即问 |

本插件包 **dsh-desktop-shell** 一次解决这四件事。

---

## 2. 产品范围

### MVP（本阶段只做这四个能力）

| 编号 | 能力 | 命令 / 工具 | 优先级 |
|---|---|---|---|
| A | 全局热键唤起/隐藏 DSH 窗口 | 配置项 `hotkey` | P0 |
| B | 系统通知（任务完成 / 待审批 / 自定义） | 工具 `notify` + 事件挂钩 | P0 |
| C | 截图采集（全屏 / 区域 / 窗口）→ 附件 | 工具 `capture_screen` | P1 |
| D | 剪贴板监听 → 可选注入会话 | 服务 `clipboardWatch` + 工具 `read_clipboard` | P1 |

### 明确不做（防止范围膨胀）

- 文件类型关联（需要改安装器，MVP 后另立）
- 多窗口管理
- 手机伴侣 / 远程控制
- 跨设备同步
- 任何需要 Electron main 进程 API 的能力（见 §4.3 约束）

---

## 3. 技术架构

### 3.1 运行位置

```
Electron 主进程 (窗口/托盘)
    │  Node IPC（启动注入/就绪/关闭）
    ▼
Desktop Host 进程  ←  ELECTRON_RUN_AS_NODE=1，纯 Node
    │
    ├── dsh core (Cordis)
    ├── 本插件 dsh-desktop-shell  ← 跑在这里
    └── 其它插件
```

**关键约束**：Host 是 `ELECTRON_RUN_AS_NODE=1` 的纯 Node，
**不能调用 Electron API**（globalShortcut / BrowserWindow / Notification 里的
Electron 专有部分都不可用）。因此：

- 热键 → Node 原生模块（`uiohook-nans` 或 `node-global-key-listener`）
- 通知 → `node-notifier`（走系统通知中心）
- 截图 → `screenshot-desktop` + `sharp` 裁剪
- 剪贴板 → `clipboardy` / `clipboard-event`

这些都是 Node 原生模块，装进 profile 的 `node_modules` 即可，
与 Desktop 自带 pnpm 兼容。

### 3.2 Cordis 插件结构

单 npm 包，导出多个 Cordis 插件（bundle patch 声明挂载顺序）：

```
dsh-desktop-shell/
├── package.json          # name: dsh-desktop-shell, dsh.bundle.patch 指向 ./cordis.patch.yml
├── cordis.patch.yml      # 挂载 4 个子插件行
├── src/
│   ├── hotkey.ts         # A: ctx.hotkey 服务 + 窗口唤起
│   ├── notify.ts         # B: ctx.tools.register(notify) + agent 事件挂钩
│   ├── capture.ts        # C: ctx.tools.register(capture_screen)
│   ├── clipboard.ts      # D: ctx.clipboardWatch 服务 + read_clipboard 工具
│   ├── settings.ts       # 设置页（热键/通知/剪贴板开关）
│   └── index.ts          # re-export
├── locale/{en,zh}.json   # meta.title / meta.description
└── tests/
```

### 3.3 与 DSH 的集成点

| 能力 | 依赖的 ctx | 注册什么 |
|---|---|---|
| A 热键 | `ctx.agents`、`ctx.webhookRuntime`(可选) | `ctx.hotkey` 服务；shell overlay 提供 `hotkey://toggle` |
| B 通知 | `ctx.tools`、`ctx.agent`（事件） | 工具 `notify`；监听 `agent/turn-stopping`、`tools/post-execute` |
| C 截图 | `ctx.tools`、`ctx.attachments`、`ctx.fs` | 工具 `capture_screen`，产物走 attachments |
| D 剪贴板 | `ctx.tools`、`ctx.agent.inject` | `ctx.clipboardWatch` 服务；工具 `read_clipboard` |

**声明依赖**：
```ts
export const inject = ['tools', 'agents', 'attachments', 'fs']
```
（各子插件按需 `inject`，不要在一个文件里全要。）

### 3.4 配置 schema（供设置页渲染）

DSH 0.1.7+ 从插件自己的 Config schema 派生设置页，因此每个子插件导出
`Config` 接口（Zod / typert 生成 schema）：

```ts
// hotkey.ts
export interface Config {
  hotkey?: string            // 默认 'Alt+Space'，格式 electron accelerator 风格
  enabled?: boolean          // 默认 true
  behavior?: 'toggle' | 'summon' | 'hide'  // 默认 'toggle'
}
// notify.ts
export interface Config {
  onTaskComplete?: boolean   // 默认 true
  onApprovalNeeded?: boolean // 默认 true
  sound?: boolean            // 默认 true
  titlePrefix?: string       // 默认 'DSH · '
}
// capture.ts
export interface Config {
  defaultMode?: 'fullscreen' | 'region' | 'window'  // 默认 'region'
  imageFormat?: 'png' | 'jpeg'                      // 默认 'png'
}
// clipboard.ts
export interface Config {
  watch?: boolean            // 默认 false（避免误注入）
  autoInject?: boolean       // 默认 false；true 时变化内容进会话草稿
  minLength?: number         // 默认 8
}
```

---

## 4. 实现要点

### 4.1 热键（A）

1. 用 `uiohook-nans` 注册全局热键（纯 Node，跨 Win/macOS/Linux）。
2. 触发后**不能直接操作窗口**（没有 Electron API），改走：
   - **方案 a（推荐，零依赖 Desktop 改动）**：把 `dsh-app://` 窗口唤起做成
     **shell overlay 席位**——Desktop 已支持「侧栏开关旁的本地化『应用』入口
     打开原生弹出菜单」，但那是只读菜单。MVP 改用更稳的路子：
     本地 HTTP：`GET /shell-bridge/raise`（Host 内的 express/hono 路由），
     Desktop 壳如果监听该事件则聚焦；否则至少**发系统通知**点击可回。
   - **方案 b（后续）**：给 Desktop 提 PR，新增 `ctx.desktopShell`
     seam 暴露 `raiseWindow()` / `isVisible()`。
3. MVP 先做方案 a：`raise` 路由返回 200，若 Desktop 壳未对接则退化为
   发一条可点击通知（通知 deep-link 到 `http://127.0.0.1:<port>/`）。
4. 热键冲突检测：注册失败 → 设置页标红 + 提示换键。

### 4.2 通知（B）

```ts
import notifier from 'node-notifier'

ctx.tools.register({
  name: 'notify',
  description: '向操作系统发送原生通知。用于任务完成、需要用户审批、或需要打断用户时。',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      message: { type: 'string' },
      urgent: { type: 'boolean', description: '是否需要立即处理' },
    },
    required: ['message'],
  },
  async execute({ title, message, urgent }) {
    notifier.notify({ title: prefix + (title ?? ''), message, wait: false, ... })
    return { ok: true }
  },
})
```

事件挂钩（在 `apply` 里）：
```ts
ctx.on('agent/turn-stopping', async (agent) => {
  if (config.onTaskComplete) { /* notify 任务完成，附 sessionId */ }
})
ctx.on('tools/pre-execute', async (event, next) => {
  if (event.tool === 'ask_user_question' && config.onApprovalNeeded) {
    /* notify 需要审批 */
  }
  return next()
})
```

### 4.3 截图（C）

```ts
ctx.tools.register({
  name: 'capture_screen',
  description: '截取屏幕（全屏/区域/窗口）并作为图片附件返回给当前会话。',
  schema: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['fullscreen', 'region', 'window'] },
      // region 时提供四元组；window 时提供 pid 或前台窗口
    },
  },
  async execute(args, ctxAgent) {
    const buf = await screenshot({ format })
    const path = await ctx.fs.writeTemp('screenshot-*.png', buf)
    return ctx.attachments.register(path)  // 使图片进入模型上下文
  },
})
```

依赖：`screenshot-desktop`（跨平台截图）+ `sharp`（裁剪，Desktop 已带 sharp）。
macOS 需「屏幕录制」权限；Windows 直接可用。

### 4.4 剪贴板（D）

```ts
ctx.effect(() => {
  const watcher = new ClipboardWatcher()
  watcher.on('change', (text) => {
    if (!config.watch) return
    if (text.length < config.minLength) return
    if (config.autoInject) {
      ctx.agents.active?.inject({ type: 'user', text: `[clipboard] ${text}` })
    }
    // 否则只是留在 read_clipboard 工具的缓存里
  })
  return () => watcher.stop()
})
```

`read_clipboard` 工具：读当前剪贴板文本/图片（图片走 `ctx.attachments`）。

---

## 5. 里程碑

| 里程碑 | 内容 | 产出 | 预估 |
|---|---|---|---|
| M0 | 脚手架：包结构、cordis.patch.yml、locale、空插件能被 DSH 加载 | `dsh plugin add ./dsh-desktop-shell` 成功，inventory 里出现 4 行 | 0.5 天 |
| M1 | **B 通知**（独立可用、风险最低） | `notify` 工具 + turn-stopping 通知 | 1 天 |
| M2 | **C 截图** | `capture_screen` 工具 + 图片进会话 | 1 天 |
| M3 | **D 剪贴板** | 服务 + 工具 + 设置项 | 1 天 |
| M4 | **A 热键**（最难，依赖窗口唤起策略） | 热键注册 + raise 路由 + 通知回退 | 1.5 天 |
| M5 | 设置页、文档、README、提交 awesome-dsh-plugin | 可上架 | 1 天 |

M1→M2→M3 可并行；M4 单独做。总计约 **5–6 人日**。

---

## 6. 风险与限制

| 风险 | 缓解 |
|---|---|
| `uiohook-nans` 是原生模块，需编译或预编译二进制 | Desktop 自带 pnpm 可装；若编译失败用 `node-global-key-listener` 退化（无热键注册，只有键盘监听） |
| macOS 屏幕录制 / 辅助功能权限 | README 写清；设置页检测权限状态并引导到系统设置 |
| 桌面端可能不提供 `ctx.attachments` 注入路径的完整文档 | 先读 `packages/attachment` 源码；必要时改用 `agent.inject()` 传图片 data-uri |
| 热键无法真正聚焦窗口（Electron API 不可达） | MVP 通知回退 + 提 `ctx.desktopShell` seam issue 给官方 |
| Windows 通知在专注助手开启时被吞 | 通知带 `urgent`，文档说明 |
| 热键/剪贴板涉及隐私 | 默认 `watch: false`；README 明示本地处理不上传 |

---

## 7. 验收标准（MVP 完成定义）

1. `dsh plugin add file:F:/mimo/dsh/dsh-desktop-shell` 后，插件页出现 4 个子插件且 `active`。
2. 对话说「发个通知说会议开始了」→ 系统通知中心出现原生通知。
3. 对话说「截图给我看」→ 会话内出现屏幕截图附件，模型能描述其内容。
4. 勾选剪贴板监听后复制一段文本 → `read_clipboard` 能读到；开启 autoInject 时会话草稿出现该文本。
5. 按 `Alt+Space` →（成功则 DSH 前台；失败则）系统通知出现，点击可回到 DSH。
6. 设置页可改热键、开关通知、开关剪贴板，改动即时/重启后生效。
7. `pnpm test` 全绿；`dsh --profile desktop` 启动无 warning。

---

## 8. 工程约定

- **语言**：代码/commit 英文；文档中文（README 中英双语最佳）。
- **仓库位置**：`F:\mimo\dsh\dsh-desktop-shell\`
- **测试**：vitest。热键/截图测试用 mock，不要真弹通知。
- **安全**：不收集、不上传任何剪贴板/截图内容；截图临时文件用后即删（`ctx.effect` 清理）。
- **兼容**：声明 `engines.dsh >= 0.1.7-rc.2`；Windows 优先，macOS/Linux 尽力。
- **上架**：完成后到 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 提 PR。

---

## 9. 参考资料

- DSH 架构：https://deepseek-harness.github.io/deepseek-harness/
- 插件入门：`docs/user/develop/basic/index.zh.md`（export apply(ctx) 即插件）
- 工具注册：`docs/user/develop/basic/tool.zh.md`
- 服务/事件：`docs/user/develop/framework/`
- 社区目录：https://awesome-dsh-plugin.com
- 插件市场客户端：`dshmarket`（本机 `~/.dsh/profiles/desktop/node_modules/dshmarket`）
- 本机桌面 profile：`C:\Users\Administrator\.dsh\profiles\desktop\`
- 本机 DSH 安装：`C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\`

## 10. 项目结构（目标态）

```
F:\mimo\dsh\dsh-desktop-shell\
├── PLAN.md               # 本文件
├── package.json
├── cordis.patch.yml
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts
│   ├── hotkey.ts
│   ├── notify.ts
│   ├── capture.ts
│   ├── clipboard.ts
│   └── settings.ts
├── locale/
│   ├── en.json
│   └── zh.json
├── tests/
│   ├── notify.spec.ts
│   ├── capture.spec.ts
│   └── clipboard.spec.ts
└── README.md
```
