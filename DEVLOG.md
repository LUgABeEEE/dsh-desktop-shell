# dsh-desktop-shell 开发日志

> 里程碑结束后集中记录（不写流水账）。关联方案：`PLAN.md`。

## M0 脚手架（完成）

- 包结构落地：`package.json`（含 `dsh.bundle.patch`、`engines.dsh >= 0.1.7-rc.2`、4 个 subpath exports）、`cordis.patch.yml`（notify/capture/clipboard/hotkey 四行）、`locale/{en,zh}.json`、`src/*.ts` + `lib/*.js` 空插件导出（`name`/`inject`/`apply`/Config schema）、`settings.ts`、`tsconfig.json`、`vitest.config.ts`、`tests/exports.spec.ts`、`README.md`。
- 参考本机已装插件（dsh-context / dsh-cost-meter / dsh-vault / dsh-token-pet）确认约定：ESM `export const name` + `export const inject` + `export function apply`；bundle patch 用 `- insert: [{id, name}]`；locale 提供 `meta.title/description`。
- M0 集中验证一次：`node` 加载 5 个入口全部通过（name/inject/apply/Config 齐全，子插件名唯一）。
- git：root commit `18009f6`，23 文件；Z 盘备份 `Z:\backup\dsh-desktop-shell-m0-20261003`。
- 交付方式：框架 + git 就绪，交给 opencode 续作 M1–M5。

---

## [2026-10-04] 真机验证（自动完成，未改动 desktop profile）

`dsh` CLI 不在 PATH，但它就在 `app.asar` 里。用 Electron 以纯 Node 模式跑即可：

```powershell
$env:ELECTRON_RUN_AS_NODE='1'
& 'C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe' `
  '...\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js' --version   # => 0.2.0-rc.2
```

**过程中查到的三件重要事实：**

1. **`desktop` profile 由 Electron 应用独占管理**，CLI 直接拒绝：
   `profile "desktop" is managed exclusively by the Electron application`。
   所以**没有动 desktop profile**，改为从 web 模板新建了临时 profile `dshtest` 来验证。
2. **PLAN §7 原来的安装命令是错的**：`dsh plugin add file:F:/...` 会失败 ——
   pnpm 把 `file:F:/...` 当**相对路径**，拼成 `<profile>/F:\mimo\...` 后
   `ENOENT: scandir`。`file:///F:/...` 也不行（dsh 会先归一化成带 `file:` 的路径）。
   **必须用普通绝对路径** `F:/mimo/dsh/dsh-desktop-shell`。
3. **pnpm 9 需要** profile 目录下 `.npmrc` 含 `ignore-workspace-root-check=true`
   （写在 `pnpm-workspace.yaml` 里无效，那是 pnpm 10+ 的位置）。

**验证结果（硬证据）：**

- `dsh plugin --profile dshtest add F:/...` → 成功，`dsh-desktop-shell 0.1.0` 已装。
- 4 行 bundle patch **全部从 profile 的 `node_modules` 解析并加载成功**：
  `name` / `inject` / `apply` 齐备、`Config` 为 Standard Schema、**字段全部 volatile**，
  且行 id 与导出的插件名一一对应。
- **依赖经 link 安装后仍能解析**（含 `@deepseek-ai/schemastery`）—— 之前担心的
  「symlink 安装解析不到 schemastery」这个坑**不存在**。
- **profile 正常启动**：`dsh web: http://127.0.0.1:3080/`，stderr 里**没有任何**
  本插件的 warning/error（只有一条无关的 Node `fs.Stats` 弃用提示）。
- 桌面端进程当时未运行，安装没有打断任何活动会话。

**仍未验证（需要 UI 或模型对话，自动化到头了）：**
设置页是否真的渲染出字段、三个工具是否进入模型的工具目录、通知是否真弹。
尝试过读 API（`/api/ping`、`/api/v1/graphql`）：鉴权 cookie 能拿到，但该 profile
未挂载这些路由（404），拿不到 settings 描述。

**顺带把 §11.4 的推断升级为定案**：asar 里能直接读出
`@deepseek-ai/dsh-desktop-host/lib/index.js`，它的 `name` 是 **`desktop-office`** ——
只管 LibreOffice skills，**不提供任何窗口/托盘/通知/剪贴板能力**。
`dsh-host-open-in-app` 是「在工作区目录上打开外部编辑器」，与本主题无关。
故 M4「热键聚焦窗口」在当前宿主上确认**不可能实现**。

**留下的东西：** profile `dshtest`（含 `.npmrc` / `pnpm-workspace.yaml` 配置）保留
在 `$DSH_HOME/profiles/` 下作为后续验证用的脚手架，对 `desktop` 无任何影响。
不需要时直接删掉该目录即可。

---

## [2026-10-04] M2–M5 全部完成

**先验依赖，结果原方案点名的东西有两个是坑：**

- `uiohook-nans`（原方案热键**首选**）**在 npm 上根本不存在**。
- `iohook`（备选）当前 Node/Windows **无预编译二进制**（404），需本地编译，
  而本机 `cl.exe` 缺失 → 装不上。`node-global-key-listener` 只是键盘监听，不具备全局注册。
- 结论：**热键不装原生模块**，改用 PowerShell 宿主进程调 Win32
  `RegisterHotKey` + `GetMessage` 消息循环，Node 侧零依赖。
- `clipboardy` 能用，但导出的是 **`read()` 不是 `readText()`**，且**没有变更事件 API**
  → 剪贴板监听只能轮询（750ms，`unref` 掉以免吊住宿主进程）。

**M2 截图**：字节直接进宿主 `ctx.attachments.saveImage()`（实测签名
`{ data: Buffer, mediaType, name? }` → ref，渲染为 `{ type:'image', attachment: ref }`），
**不落临时文件**，比原方案的「临时文件用后即删」更干净。
`window` 模式与拖拽框选**已从范围移除**并明确报错 —— 宿主无窗口句柄，且拖拽遮罩需要
装不上的原生输入捕获模块。

**M3 剪贴板**：`desktop_read_clipboard` 工具按需读取；监听为轮询，默认关闭；
首次轮询只建立基线不触发；内容超出 10 万字符截断并在渲染里说明。

**M4 热键**：注册/占用检测/消息循环/退出释放均已实测通过。
**按键触发那一跳未验证** —— 本会话环境禁止注入键盘（`SendInput` 返回 0、
`ERROR_ACCESS_DENIED`，结构体大小 40 正确，属环境限制而非代码问题）。
因为宿主没有窗口 seam，热键按下只能弹通知提示手动切窗口（`fallbackMessage`
如实说明，不假装成功）；同时注册了 `shell-bridge/raise` 路由等上游 seam。
`loader/volatile-update` 时会重新注册，改热键不必重启。

**测试（114 项，全绿）** 且**测试抓出两个真 bug**：

1. `defaultMode` 默认 `'region'` —— 但 region 需要显式坐标且没有拖拽遮罩，
   等于**默认调用必然失败**。已改默认为 `'fullscreen'`。
2. 无 `ctx.attachments` 时返回了 `ok: true` 却带着 `error` 字段。已修为 `ok: false`。

另外**构建产物冒烟测试抓到第三个 bug**：单元测试全绿（因为都注入假后端），
但真加载 `clipboardy` 时因 interop 形状不符直接崩。新增 `tests/deps.spec.ts`
加载**真实模块**断言依赖的成员存在，并断言 `readText` **不存在**，
防止下一个人再把代码"改回"猜的 API。

**M5**：README 中英双语 + 已知限制前置、`dshhub` 上架清单、`LICENSE`、
locale 更新、PLAN §11.5 记录模块实测结论、§5 里程碑状态更新。

**仍未验证**：全部四项都**没在真 DSH 里跑过**。测试证明逻辑，不证明宿主集成。
需 `dsh plugin add file:F:/mimo/dsh/dsh-desktop-shell` 后按 PLAN §7 验收。

---

## [2026-10-03] M1 通知（代码+测试完成，待真机验证）

先做了 API 核实，结论推翻了好几条 `PLAN.md` 原假设（详见 PLAN.md §11）。

**实测确认的关键点：**

- `Config` 必须导出 **Schemastery schema**，且**只有 `Config` 这一个名字**被读；
  `ConfigSchema` 不读。普通对象不是 validator → 静默失效。
- 设置页**只渲染 `.volatile()` 字段**；非 volatile 字段既不显示也不可写。
- `.volatile()` 字段到 `apply` 手里是一个只有 `get()` 的包装器（已实测：
  `JSON.stringify` 显示为 `{}`，没有 `set`），**必须在使用时重读**，不能启动时读一次。
  → 删掉了 `withDefaults`，改为 `readConfigField(field, fallback)`。
- 工具定义字段是 **`parameters`**（JSON Schema），**没有** `schema` 字段；
  **`output: { schema, render }` 是必填**，`execute` 只能返回规范 JSON 值。
- `agent/turn-stopping` 存在，但是 **serial**（`{ agent, turn, signal }`，无 `next()`）
  且**被 await** → 里面只 fire-and-forget，绝不阻塞。
- 待审批的正确 seam 是 **`approval/request`**（waterfall，必须 `next()`），
  不是原方案猜的「`tools/pre-execute` + `event.tool`」（真实字段是 `exec.name`）。
- 宿主**没有**通知服务、也没有打包 `node-notifier` → 确认要用第三方模块。
- 宿主 ctx 中 `desktopShell` / `shell-bridge` / `globalShortcut` 在 `app.asar` 里
  **0 命中**，证实没有窗口/托盘/快捷键 seam（PLAN §4.1 的方案 a 是唯一可行路线）。

**实现：**

- `src/notify.ts`：工具名改 `desktop_notify`（dsh 注册表分层，避免被宿主同名工具遮蔽）。
  行为抽成 `createNotifyPlugin({ config, backend, logger })`，`apply` 只做接线 ——
  这样测试能注入假后端，**测试绝不真弹通知**（PLAN §8 要求）。
- 后端 `node-notifier` **首次使用时才动态 import**：缺依赖/坏安装只会退化成
  「通知不可用」，不会让插件行加载失败。
- 容错原则：通知失败**绝不能**弄坏 agent 回合。后端异常被吸收成 `{ ok:false, error }`
  返回值（不抛），`approval/request` 无论如何都调 `next()`（审批决定是宿主的）。
- 工具注册失败（重名/宿主改接口）只 warn 不炸，参考 modlens 的 degrade-loudly 做法。

**顺带修正：** `engines.dsh` `>=0.1.7-rc.2` → `>=0.2.0-rc.2`（本机 profile 实测运行时
是 0.2.0-rc.2，原声明偏低）。新增运行时依赖 `@deepseek-ai/schemastery`、`node-notifier`。

**验证：** typecheck 通过；`npm test` **42 passed**（notify 35 + exports 7）。
测试覆盖：schema 是 Standard Schema、默认值填充、volatile 包装器读取、
空消息拒绝、后端异常不外泄、urgent 升级提示音、注册失败降级、
两个事件的开关与 sessionId、以及 `apply` 的注入/订阅形状。

**未验证：** 还没在真 DSH 里跑过（设置页是否出现、通知是否真弹）。
需 `dsh plugin add file:...` 后实测，见 PLAN §7 验收 1、2、6。

---

## [2026-10-03] 修 M0 两个缺陷：lib 非构建产物 + Config 导出名不一致

背景：接手续作时先验证工具链，发现 M0 遗留两个真实缺陷。

**缺陷 1：`lib/` 是手写的，不是构建产物。** 跑 `npm run build` 后 6 个已提交的
`lib/*.js` 全部被 tsc 覆盖（注释被剥、格式变化）——说明这些文件从未由构建生成，
一直手工维护且已漂移。

**缺陷 2：`Config` 导出名不一致（严重）。**

| 来源 | 导出名 |
|---|---|
| `src/notify.ts` | `ConfigSchema` |
| 已提交 `lib/notify.js`（手写） | `Config` |
| `tsc` 输出 | `ConfigSchema` |

即 M0 验证记录中「5 个入口全部通过（name/inject/apply/**Config** 齐全）」验的是
手写 `lib/`，**从未验过真正的构建产物**；DSH 读设置页认哪个名字，两边必有一错。

**处理：**

> ⚠️ **本条结论已被 M1 推翻，见下方 M1 小节。**「两个名字都导出」是无效兜底 ——
> 宿主只读 `Config`，且真正的问题是**形态**（必须是 Schemastery schema）而非名字。
> 下面这条双导出仅作为当时的处置记录保留。

- 两个名字都导出。`interface Config`（类型空间）与 `const Config`（值空间）在 TS
  中可共存，`ConfigSchema` 保留为同一对象的别名 —— 与 `dsh-cost-meter` 写法一致，
  且宿主无论读哪个名字设置页都能解析。
- `lib/` 明确为「提交的构建产物」，并加 `npm run check:lib`（重新构建 +
  `git diff --exit-code -- lib`）作为防漂移闸门；`npm run verify` =
  typecheck + check:lib + test。
- 补 `.d.ts`（此前未跟踪，但 `types` 指向 `lib/index.d.ts` 且 `files` 打包 `lib/`）。
- 工具链：`package.json` 原本**零依赖**，`npm test` 跑不起来。已加
  `typescript` / `vitest` / `@types/node` 为 devDependencies，并批准 `esbuild`
  的 postinstall（npm 11 默认拦截，不批 vitest 无法运行）。

**验证：** typecheck 通过；build 通过；`npm test` 5 passed；node 加载 5 个**构建
产物**入口全部通过（name/inject/apply/Config 齐全）—— 这正是 M0 缺的那一步。

**遗留：** DSH 设置页究竟读 `Config` 还是 `ConfigSchema`，仍待在真实宿主上确认；
现为双导出兜底，确认后可收敛成一个。

---

## [2026-10-03] 初始化日志

- 创建本开发日志 `DEVLOG.md`，约定：**每一步操作写入本文件**（倒序追加）。
- 当前里程碑：**M0 脚手架**（任务 T1）。

## [2026-10-03] 通读 PLAN.md

- 完整阅读 `F:\mimo\dsh\dsh-desktop-shell\PLAN.md`（327 行）。
- 要点摘录：
  - MVP 四能力：A 热键(P0) / B 通知(P0) / C 截图(P1) / D 剪贴板(P1)。
  - Host 是 `ELECTRON_RUN_AS_NODE=1` 纯 Node，不能用 Electron API。
  - 单 npm 包 + `dsh.bundle.patch` → `cordis.patch.yml` 挂 4 个子插件。
  - 每个子插件单独 `inject` 依赖；Config schema 派生设置页。
  - 热键唤起走本地 HTTP `GET /shell-bridge/raise` + 通知回退（方案 a）。
  - 隐私：不收集不上传；临时文件用后即删。
  - 里程碑：M0 → M1 通知 → M2 截图 → M3 剪贴板 → M4 热键 → M5 设置页+文档。
  - 验收 7 条见 PLAN.md §7。

## [2026-10-03] 勘察本机 DSH 桌面 profile

- 目录 `C:\Users\Administrator\.dsh\profiles\desktop\` 确认存在：
  - `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml`
  - `cordis.yml`、`cordis.patch.yml`（及多个 .bak）
  - `node_modules\`（含 `.pnpm`，pnpm 布局；可见 `@deepseek-ai`、`dshmarket` 等）
  - `.plugin-manager\`、`.dsh-market\` 等插件管理目录
- 下一步：读取已有插件（`dshmarket` / `dsh-context` 等）的 `package.json` 与 `cordis.patch.yml` 写法，作为本包模板。

## [2026-10-03] 任务登记

- 创建任务 **T1: M0 脚手架：包结构 + cordis.patch.yml + locale + 空插件可被 dsh 加载**。
- 工作目录：`F:\mimo\dsh\dsh-desktop-shell\`（PLAN.md 已在，其余待建）。
