# dsh-desktop-shell 开发方案

> 目标读者：接手开发的 Agent / 开发者。读完即可开工。
> 版本：v1.1 · 2026-10-03
>
> ⚠️ **v1.1 起：§3.3 / §3.4 / §4.2 的 API 写法已被实测证伪并修正。**
> 开工前先读 [§11 与真实 API 的差异](#11-与真实-api-的差异v11-新增)，
> 那里记录了本机 `desktop` profile 实测结果与本文件原假设的冲突。

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
| B | 系统通知（任务完成 / 待审批 / 自定义） | 工具 `desktop_notify` | P0 |
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
**不能调用 Electron API**。实测确认（§11）：宿主 `ctx` **没有**任何窗口 / 托盘 /
通知 / 剪贴板 / 截图服务，`desktopShell` 这个 seam 不存在，Electron 侧的全局快捷键
与 `globalShortcut` 只在 main 进程与渲染进程 preload 里，插件拿不到。

因此四项能力都要自带第三方模块：

- 热键 → Node 原生模块（`uiohook-nans` 或 `node-global-key-listener`）
- 通知 → `node-notifier`（走系统通知中心）✅ 已用于 M1
- 截图 → `screenshot-desktop` + `sharp` 裁剪（`sharp` 已在 profile 中）
- 剪贴板 → `clipboardy` / `clipboard-event`

### 3.2 Cordis 插件结构

单 npm 包，导出多个 Cordis 插件（bundle patch 声明挂载顺序）：

```
dsh-desktop-shell/
├── package.json          # name: dsh-desktop-shell, dsh.bundle.patch 指向 ./cordis.patch.yml
├── cordis.patch.yml      # 挂载 4 个子插件行
├── src/
│   ├── hotkey.ts         # A: 全局热键 + 窗口唤起
│   ├── notify.ts         # B: ctx.tools.register(desktop_notify) + 事件挂钩   ← M1 已实现
│   ├── capture.ts        # C: ctx.tools.register(capture_screen)
│   ├── clipboard.ts      # D: 剪贴板监听服务 + read_clipboard 工具
│   ├── settings.ts       # readConfigField 等 config 读取助手
│   └── index.ts          # re-export
├── locale/{en,zh}.json   # meta.title / meta.description
└── tests/
```

### 3.3 与 DSH 的集成点

宿主 API 以 [§11](#11-与真实-api-的差异v11-新增) 实测为准。摘要：

| 能力 | 依赖的 ctx | 注册什么 |
|---|---|---|
| A 热键 | 无（自带原生模块） | 热键注册 + 本地 HTTP raise 路由 |
| B 通知 | `ctx.tools` | 工具 `desktop_notify`；事件 `agent/turn-stopping`、`approval/request` |
| C 截图 | `ctx.tools`、`ctx.attachments` | 工具 `capture_screen`，产物走 attachments |
| D 剪贴板 | `ctx.tools` | 工具 `read_clipboard` |

**声明依赖**：各子插件按需 `inject`，不要在一个文件里全要。
`notify` 硬依赖 `['tools']`；`hotkey` / `clipboard` 不依赖宿主服务；
可选依赖用 `ctx.get(name)` 探测，不要写进 `inject`（写进去会一直等）。

### 3.4 配置 schema（供设置页渲染）

⚠️ **实测修正**：`Config` 必须是 **Schemastery schema**（Standard Schema），
不是普通对象。且**只有** `Config` 这一个导出名被读取，`ConfigSchema` / `schema`
都不读。普通对象不是 validator，会静默不生效。

要出现在设置页可编辑的字段必须标 `.volatile()`；非 volatile 字段既不显示也不可写。
`.volatile()` 字段到达 `apply` 时是一个只有 `get()` 的包装器，**必须调用 `.get()`
在使用时读取**（不是启动时读一次）。默认值写在 schema 上。

```ts
// notify.ts
export const Config = Schema.object({
  onTaskComplete: Schema.boolean().default(true).volatile(),
  onApprovalNeeded: Schema.boolean().default(true).volatile(),
  sound: Schema.boolean().default(true).volatile(),
  titlePrefix: Schema.string().default('DSH · ').volatile(),
})
export function apply(ctx: Context, config: Config) {
  const read = () => ({
    sound: readConfigField(config.sound, true),   // 每次使用时读，volatile 改动即时生效
  })
}
```

---

## 4. 实现要点

### 4.1 热键（A）

1. 用 `uiohook-nans` 注册全局热键（纯 Node，跨 Win/macOS/Linux）。
2. 触发后**不能直接操作窗口**（没有 Electron API，也没有 `ctx.desktopShell`），
   走本地 HTTP `GET /shell-bridge/raise`；宿主未对接则退化为发一条可点击通知。
3. 注意 `ctx.webServer.register` 的 path 必须是**文档相对路径、无前导斜杠**
   （宿主以 `<base href="./">` 提供服务），且 Desktop 默认监听**系统分配端口**，
   端口需读取而非硬编码。
4. 热键冲突检测：注册失败 → 设置页标红 + 提示换键。

### 4.2 通知（B）—— ✅ M1 已实现

实测要点（与本节原假设的差异见 §11）：

- 工具定义的字段是 **`parameters`**（JSON Schema），**没有** `schema` 字段。
- **`output: { schema, render }` 是必填**。`execute` 只返回 `output.schema` 声明的
  规范 JSON 值，`render` 负责转成 `ContentBlock[]`。拒绝时返回 `{ ok:false, error }`，
  不要抛异常。
- 注册要包在 `ctx.inject(['tools'], ...)` + `ctx.effect(...)` 里。
- **`agent/turn-stopping` 是 serial 事件**（`{ agent, turn, signal }`，无 `next()`）
  且宿主会 await 它 —— 里面绝不能阻塞等待通知。
- **待审批的正确 seam 是 `approval/request`**（waterfall，必须调 `next()`），
  而不是猜工具名 + `tools/pre-execute`。

```ts
// 注册
host.inject(['tools'], (toolCtx) => {
  toolCtx.effect(() => toolCtx.tools.register({
    name: 'desktop_notify',
    description: '...',
    parameters: { type: 'object', properties: { title: {...}, message: {...}, urgent: {...} }, required: ['message'] },
    output: { schema: { type: 'json' }, render: renderNotifyResult },  // 必填
    execute: (args) => notify(args),
  }), 'desktop-shell-notify: notify tool')
})

// 回合结束（serial，不阻塞）
host.on('agent/turn-stopping', (payload) => { void notify({ ... }) })

// 待审批（waterfall，必须 next()）
host.on('approval/request', async (req, next) => {
  void notify({ title: 'Approval needed', urgent: true })
  return next()
})
```

后端 `node-notifier` 首次使用时才动态 import：宿主不提供通知服务也不打包
node-notifier，动态加载保证缺依赖时只是"通知不可用"而不会让插件行加载失败。

### 4.3 截图（C）

⚠️ 实测：宿主**没有**通用截图 API。`ctx.computerUse` 只暴露一个 provider 插槽
（`register(name)`），且两个 provider 都是实验性、需显式启用、默认不安装。
真要截图必须自带第三方模块（`screenshot-desktop` 等）。

`ctx.attachments`（`AttachmentStore`）**存在**，但它是内容寻址的持久化附件库
（`saveImage` / `admitPromptContent` / `ImageAttachmentRef`），**不是**"给我一个临时
PNG 发出去"的接口 —— 临时截图用完即删的要求与它冲突，需自己管临时文件再决定
是走 attachments 还是 `agent.inject` data-uri。

### 4.4 剪贴板（D）

`navigator.clipboard` 只在浏览器半边用，宿主无 `ctx.clipboard`，必须自带模块。

---

## 5. 里程碑

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 脚手架：包结构、cordis.patch.yml、locale、空插件能被 DSH 加载 | ✅ 完成（`18009f6`） |
| M0.5 | 修 M0 遗留缺陷：lib 为真构建产物 + Config 导出名 | ✅ 完成（`d87f228`） |
| M1 | **B 通知** | ✅ 代码+测试完成，待真机验证 |
| M2 | **C 截图** | ✅ 代码+测试完成（全屏 + 显式坐标 region） |
| M3 | **D 剪贴板** | ✅ 代码+测试完成（读取 + 轮询监听） |
| M4 | **A 热键** | ⚠️ 注册可用，**无法聚焦窗口**；按键触发那一跳待人工验证 |
| M5 | 设置页、文档、README、LICENSE、上架清单 | ✅ 完成 |

### 5.1 MVP 完成度小结

四项能力都落地了，但**验收标准 5（热键聚焦窗口）达不到**，原因不在实现而在宿主：
没有窗口 seam。M1–M3 可真机验收；M4 只能验收「热键能注册 + 按下有反馈」。

`window` 截图模式与拖拽框选**已从范围中移除**（原因见 §6 与 §11.2）。

---

## 6. 风险与限制

| 风险 | 缓解 |
|---|---|
| `uiohook-nans` 是原生模块，需编译或预编译二进制 | Desktop 自带 pnpm 可装；若编译失败用 `node-global-key-listener` 退化 |
| macOS 屏幕录制 / 辅助功能权限 | README 写清；设置页检测权限状态并引导到系统设置 |
| 宿主无窗口聚焦 seam，热键无法真正聚焦窗口 | MVP 通知回退 + 向上游提 `ctx.desktopShell` seam |
| Windows 通知在专注助手开启时被吞 | 通知带 `urgent`，文档说明 |
| 热键/剪贴板涉及隐私 | 默认 `watch: false`；README 明示本地处理不上传 |
| **以 `file:` / symlink 方式安装时插件自身解析不到 `@deepseek-ai/schemastery`** | 已把 schemastery 声明为 `dependencies`；若仍失败，用 `createRequire(宿主入口)` 兜底（参考 `dsh-chat-import/lib/import-prefs.mjs`） |
| 宿主运行时版本比方案假设的新 | 已按实测把 `engines.dsh` 提到 `>=0.2.0-rc.2` |

---

## 7. 验收标准（MVP 完成定义）

⚠️ **安装命令更正**：原写法 `dsh plugin add file:F:/...` **会失败** —— pnpm 把
`file:F:/...` 当相对路径，解析成 `<profile>/F:/mimo/...`。必须用普通绝对路径：

```bash
dsh plugin --profile <profile> add F:/mimo/dsh/dsh-desktop-shell
```

另有两点实测约束：
- `desktop` profile **由 Electron 应用独占管理**，CLI 报
  `profile "desktop" is managed exclusively by the Electron application`，
  只能在应用内插件页安装。
- pnpm 9 需要 profile 目录下 `.npmrc` 含 `ignore-workspace-root-check=true`。

### 验收现状

| # | 标准 | 状态 |
|---|---|---|
| 1 | 4 个子插件出现且 active | 🟡 包与 4 行 bundle patch 已装进真实 profile 并全部加载成功；「插件页显示 active」需 UI 确认 |
| 2 | 对话触发原生通知 | ⬜ 需真机对话（逻辑已单测，真机依赖已实测） |
| 3 | 截图进会话 | ⬜ 需真机对话。截图本身已实测出真实 PNG，存储走已核实的 `attachments.saveImage` |
| 4 | 剪贴板读取/注入 | ⬜ 需真机对话。`clipboardy.read()` 已实测可用 |
| 5 | 热键唤起 DSH | ❌ **无法达成** —— 宿主无窗口 seam（§11.4 已定案），降级为通知回退 |
| 6 | 设置页可改、即时生效 | 🟡 4 个 Config 均为 Standard Schema 且字段全部 `.volatile()`（已验证）；页面渲染需 UI 确认 |
| 7 | 测试全绿 + 启动无 warning | ✅ `npm run verify` 绿（114 测试）；真实 profile 启动**无本插件任何 warning/error** |

**已自动验证的硬证据**（见 DEVLOG 2026-10-04）：装进真实 profile 后，4 行全部从
profile 的 `node_modules` 解析并加载成功（`name`/`inject`/`apply` 齐备、`Config`
为 Standard Schema、字段全 volatile），profile 正常启动。
**未验证**：设置页渲染、工具进入模型目录、通知真弹 —— 这三项都需要 UI 或模型对话。

---

## 8. 工程约定

- **语言**：代码/commit 英文；文档中文（README 中英双语最佳）。
- **仓库位置**：`F:\mimo\dsh\dsh-desktop-shell\`
- **构建**：`src/*.ts` → `lib/*.js` **提交进 git**（DSH 直接加载 `lib/`，安装不跑构建）。
  `npm run check:lib` 会在 `lib/` 与 `src/` 漂移时失败。
- **测试**：vitest。热键/截图/通知测试全部用注入的假后端，**不真弹通知**。
- **安全**：不收集、不上传任何剪贴板/截图内容；临时文件用后即删。
- **兼容**：声明 `engines.dsh >= 0.2.0-rc.2`；Windows 优先，macOS/Linux 尽力。
- **上架**：完成后到 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 提 PR。

---

## 9. 参考资料

- DSH 架构：https://deepseek-harness.github.io/deepseek-harness/
- 插件入门：`docs/user/develop/basic/index.zh.md`
- 工具注册：`docs/user/develop/basic/tool.zh.md`、`docs/subsystems/tools.md`
- 配置与 volatile：`docs/user/develop/basic/config.md`、`docs/subsystems/settings.md`
- 审批：`docs/subsystems/approval.md`
- 服务/事件：`docs/cordis-api/fiber.md`、`docs/user/develop/framework/events.md`
- 社区目录：https://awesome-dsh-plugin.com
- 本机参考插件（**写代码前先读这些，比文档更贴近真实用法**）：
  - `~/.dsh/profiles/desktop/node_modules/dsh-context/lib/index.js`（Config + apply）
  - `~/.dsh/profiles/desktop/node_modules/dsh-rewind-plugin/lib/index.js`（事件钩子）
  - `~/.dsh/profiles/desktop/node_modules/dsh-vault/lib/index.js`（工具 + 审批 waterfall）
  - `~/.dsh/profiles/desktop/node_modules/@linxin666/dsh-client-ui-task-board/src/`（defineTool + volatile）
  - `~/.dsh/profiles/desktop/node_modules/@vectorize-io/hindsight-coding-agents/dist/dsh.js`（ctx.inject + effect）

---

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
│   ├── exports.spec.ts
│   ├── notify.spec.ts
│   ├── capture.spec.ts
│   └── clipboard.spec.ts
└── README.md
```

---

## 11. 与真实 API 的差异（v1.1 新增）

> 本节记录 `PLAN.md` 原假设与本机 `desktop` profile **实测**结果的冲突。
> 照原假设写会静默失效，故单列。

### 11.1 `Config` 导出（影响全部四个子插件）

| | 原假设 | 实测 |
|---|---|---|
| 导出名 | `Config` 或 `ConfigSchema` 皆可 | **只有 `Config`**，其余名字不读 |
| 形态 | 普通对象 `{ type:'object', properties:{...} }` | **必须是 Schemastery schema**（Standard Schema） |
| 默认值 | `withDefaults(config, DEFAULTS)` 合并 | **写在 schema 上**，Cordis 校验时填充 |
| 设置页 | 导出即渲染 | **仅 `.volatile()` 字段**可编辑；非 volatile 既不显示也不可写 |
| 读取 | 启动时读一次 | volatile 字段是 `{ get() }` 包装器，**使用时**读 |

### 11.2 工具注册

| | 原假设 | 实测 |
|---|---|---|
| schema 字段名 | `schema` | **`parameters`** |
| 输出 | 省略或返回任意值 | **`output: { schema, render }` 必填**；`execute` 只能返回规范 JSON 值 |
| 拒绝方式 | 抛异常 | 返回 `{ ok:false, code, message }` |
| 工具名 | `notify` | 用 `desktop_notify`：dsh 注册表分层，同名会被宿主工具遮蔽 |

### 11.3 事件

| 原假设 | 实测 |
|---|---|
| `agent/turn-stopping` 存在 | ✅ 存在，但是 **serial**（`{ agent, turn, signal }`，无 `next()`）且**被 await** |
| `tools/pre-execute` + `event.tool === 'ask_user_question'` | 事件存在，字段是 **`exec.name`**；但用它判断审批**不对**，正确 seam 是 **`approval/request`** waterfall |
| — | `ctx.effect(fn, label)` **不会**因 config 变化重跑：普通字段变化会卸载重载 fiber，volatile 字段变化只发 `loader/volatile-update`，需自己在使用时重读 |

### 11.4 宿主能力

宿主 `ctx` 中**不存在**：`desktopShell`（窗口/托盘）、通知、剪贴板、截图、
全局快捷键服务。`ctx.webServer` / `ctx.attachments` / `ctx.fs` / `ctx.commands`
/ `ctx.settings` / `ctx.tools` / `ctx.approval` 存在。

✅ **已由源码定案**（此前只是推断）：`app.asar` 内可直接读出
`@deepseek-ai/dsh-desktop-host/lib/index.js`，其 `name` 是 **`desktop-office`** ——
只挂载 LibreOffice 相关的 skills 与工作区依赖，**不提供任何窗口/托盘/通知/剪贴板
能力**。`dsh-host-open-in-app` 也与本主题无关（它负责在工作区目录上打开**外部**
编辑器/GUI/终端）。在 `app.asar` 中检索 `raiseWindow` / `focusWindow` /
`showWindow` / `desktopCapturer` / `RegisterHotKey` / `node-notifier` /
`screenshot-desktop` 均为 0 命中。

结论：M4「热键聚焦窗口」在当前宿主上**不可能实现**，只能通知回退。

### 11.5 第三方模块实测（v1.1 新增：原方案点名的有几个不能用）

| 原方案点名 | 实测 |
|---|---|
| `uiohook-nans`（热键首选） | **npm 上不存在** —— 原方案的首选依赖是个不存在的包 |
| `iohook`（热键备选） | 存在，但**当前 Node/Windows 无预编译二进制**（404），需本地编译；本机 `cl.exe` 缺失 → 装不上 |
| `node-global-key-listener`（退化方案） | 存在但只是键盘监听，0.3.0 极老，不具备全局注册能力 |
| `node-notifier`（通知） | ✅ 可用，已实测加载 |
| `screenshot-desktop` + `sharp`（截图） | ✅ 可用，已实测截出真实 PNG 并裁剪成功 |
| `clipboardy`（剪贴板） | ✅ 可用，但导出的是 **`read()` 而非 `readText()`**，且**无变更事件 API**（故只能轮询） |

**热键最终方案：** 不装任何原生模块，用 PowerShell 宿主进程调 Win32
`RegisterHotKey` + `GetMessage` 消息循环 —— Node 侧零依赖，跨平台退化为
「不支持」而非崩溃。

实测通过：注册成功（`READY`）、占用检测（`CONFLICT 1409` = 已被注册）、消息循环阻塞、
进程退出后释放。**未实测**：真实按键 → `WM_HOTKEY`，因为本会话环境禁止注入键盘
（`SendInput` 返回 0 / `ERROR_ACCESS_DENIED`；结构体大小 40 正确，故属环境限制）。
