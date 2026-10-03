# dsh-desktop-shell 开发日志

> 里程碑结束后集中记录（不写流水账）。关联方案：`PLAN.md`。

## M0 脚手架（完成）

- 包结构落地：`package.json`（含 `dsh.bundle.patch`、`engines.dsh >= 0.1.7-rc.2`、4 个 subpath exports）、`cordis.patch.yml`（notify/capture/clipboard/hotkey 四行）、`locale/{en,zh}.json`、`src/*.ts` + `lib/*.js` 空插件导出（`name`/`inject`/`apply`/Config schema）、`settings.ts`、`tsconfig.json`、`vitest.config.ts`、`tests/exports.spec.ts`、`README.md`。
- 参考本机已装插件（dsh-context / dsh-cost-meter / dsh-vault / dsh-token-pet）确认约定：ESM `export const name` + `export const inject` + `export function apply`；bundle patch 用 `- insert: [{id, name}]`；locale 提供 `meta.title/description`。
- M0 集中验证一次：`node` 加载 5 个入口全部通过（name/inject/apply/Config 齐全，子插件名唯一）。
- git：root commit `18009f6`，23 文件；Z 盘备份 `Z:\backup\dsh-desktop-shell-m0-20261003`。
- 交付方式：框架 + git 就绪，交给 opencode 续作 M1–M5。

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
