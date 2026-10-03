# dsh-desktop-shell

DeepSeek Harness 桌面端 OS 集成插件包（Cordis bundle）。

## 能力（MVP）

| 编号 | 能力 | 入口 | 状态 |
|---|---|---|---|
| A | 全局热键唤起/隐藏 DSH | `lib/hotkey.js` | 待做 |
| B | 系统原生通知（工具 `desktop_notify`） | `lib/notify.js` | 代码+测试完成，待真机验证 |
| C | 截图采集 → 会话附件 | `lib/capture.js` | 待做 |
| D | 剪贴板监听 / 读取 | `lib/clipboard.js` | 待做 |

方案与验收：见 [PLAN.md](./PLAN.md)（**§11 记录了与真实 API 的差异，开工前必读**）。
开发日志：见 [DEVLOG.md](./DEVLOG.md)。

## 依赖的宿主能力

宿主 `ctx` 里**没有**窗口/托盘/通知/剪贴板/截图服务，也没有 `ctx.desktopShell`
seam（见 PLAN.md §11.4），所以四项能力都自带第三方模块：

| 能力 | 模块 |
|---|---|
| 通知 | `node-notifier` |
| 截图 | `screenshot-desktop`（计划）+ `sharp` |
| 剪贴板 | `clipboardy`（计划） |
| 全局热键 | `uiohook-nans`（计划） |

配置走 Schemastery schema，设置页字段全部标 `.volatile()`（可在设置页改，改动即时生效）。

## 安装

```bash
dsh plugin --profile desktop add file:F:/mimo/dsh/dsh-desktop-shell
```

## 开发

```bash
npm install
npm run verify   # typecheck + check:lib + test
```

单独跑：`npm run typecheck` / `npm run build` / `npm test` / `npm run check:lib`。

- 源码：`src/*.ts` → 构建产物：`lib/*.js`（**提交进 git**，DSH 直接加载 `lib/`，
  安装不跑构建）。`check:lib` 在 `lib/` 与 `src/` 漂移时失败。
- 代码/commit 英文；文档中文。
- Host 为纯 Node（`ELECTRON_RUN_AS_NODE=1`），禁止使用 Electron API。
- 隐私：不收集、不上传剪贴板/截图内容；临时文件用后即删。

## 兼容

- `engines.dsh >= 0.2.0-rc.2`
- Windows 优先，macOS / Linux 尽力。
