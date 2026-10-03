# dsh-desktop-shell 开发日志

> 里程碑结束后集中记录（不写流水账）。关联方案：`PLAN.md`。

## M0 脚手架（完成）

- 包结构落地：`package.json`（含 `dsh.bundle.patch`、`engines.dsh >= 0.1.7-rc.2`、4 个 subpath exports）、`cordis.patch.yml`（notify/capture/clipboard/hotkey 四行）、`locale/{en,zh}.json`、`src/*.ts` + `lib/*.js` 空插件导出（`name`/`inject`/`apply`/Config schema）、`settings.ts`、`tsconfig.json`、`vitest.config.ts`、`tests/exports.spec.ts`、`README.md`。
- 参考本机已装插件（dsh-context / dsh-cost-meter / dsh-vault / dsh-token-pet）确认约定：ESM `export const name` + `export const inject` + `export function apply`；bundle patch 用 `- insert: [{id, name}]`；locale 提供 `meta.title/description`。
- M0 集中验证一次：`node` 加载 5 个入口全部通过（name/inject/apply/Config 齐全，子插件名唯一）。
- git：root commit `18009f6`，23 文件；Z 盘备份 `Z:\backup\dsh-desktop-shell-m0-20261003`。
- 交付方式：框架 + git 就绪，交给 opencode 续作 M1–M5。

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
