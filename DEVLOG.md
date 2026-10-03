# dsh-desktop-shell 开发日志

> 里程碑结束后集中记录（不写流水账）。关联方案：`PLAN.md`。

## M0 脚手架（完成）

- 包结构落地：`package.json`（含 `dsh.bundle.patch`、`engines.dsh >= 0.1.7-rc.2`、4 个 subpath exports）、`cordis.patch.yml`（notify/capture/clipboard/hotkey 四行）、`locale/{en,zh}.json`、`src/*.ts` + `lib/*.js` 空插件导出（`name`/`inject`/`apply`/Config schema）、`settings.ts`、`tsconfig.json`、`vitest.config.ts`、`tests/exports.spec.ts`、`README.md`。
- 参考本机已装插件（dsh-context / dsh-cost-meter / dsh-vault / dsh-token-pet）确认约定：ESM `export const name` + `export const inject` + `export function apply`；bundle patch 用 `- insert: [{id, name}]`；locale 提供 `meta.title/description`。
- 交付方式：git 仓库就绪，便于交给 opencode 续作 M1–M5。

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
