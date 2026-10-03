# dsh-desktop-shell

DeepSeek Harness 桌面端 OS 集成插件包（Cordis bundle）。

> English summary: see [English](#english) at the bottom.

## 能力（MVP）

| 编号 | 能力 | 工具 / 设置 | 状态 |
|---|---|---|---|
| B | 系统原生通知 | 工具 `desktop_notify` | ✅ 完成 |
| C | 截图采集 → 会话附件 | 工具 `desktop_capture_screen` | ✅ 完成 |
| D | 剪贴板读取 / 监听 | 工具 `desktop_read_clipboard` | ✅ 完成 |
| A | 全局热键唤起 DSH | 设置项 `hotkey` | ⚠️ 见下方限制 |

全部内容**仅在本机处理，不上传**。方案与验收见 [PLAN.md](./PLAN.md)（**§11 记录了与真实 API 的差异**），
开发日志见 [DEVLOG.md](./DEVLOG.md)。

## 已知限制（重要，请先读）

这些不是待办，而是本机实测后的既有限制：

1. **热键无法真正聚焦 DSH 窗口。** 宿主 `ctx` 里没有窗口/托盘 seam（无 `ctx.desktopShell`，
   在 Desktop 包中检索 `desktopShell` / `shell-bridge` / `globalShortcut` 均 0 命中）。
   因此按热键会弹一条系统通知提示"请手动切到 DSH"，而不是把窗口拉到前台。
   已注册 `shell-bridge/raise` 路由，等上游提供窗口 seam 后即可生效。
2. **截图没有拖拽框选。** region 模式必须显式传 `{x, y, width, height}`。
   做拖拽遮罩需要原生输入捕获模块，而 `uiohook-nans`（原方案首选）**在 npm 上根本不存在**，
   `iohook` 在当前 Node/Windows 上没有预编译二进制（404，且本机无 C++ 工具链）。
   因此 `defaultMode` 默认是 `fullscreen` 而非原方案的 `region` —— 否则默认调用必然失败。
3. **不支持窗口截图（`window` 模式）。** 宿主不暴露窗口句柄，传了会明确报错而不是偷偷截全屏。
4. **剪贴板监听是轮询（750ms）。** `clipboardy` 没有变更事件 API；轮询看不到高完整性级别
   进程的剪贴板写入，且会按间隔唤醒 CPU。默认关闭。
5. **热键触发那一跳未在真机验证。** 注册 / 冲突检测（`1409`）/ 消息循环均已实测通过，
   但本会话环境禁止注入键盘输入（`SendInput` 返回 `ERROR_ACCESS_DENIED`），
   所以"真实按键 → WM_HOTKEY"需要人在键盘前手测。

## 依赖的宿主能力

宿主 `ctx` **不提供**通知、剪贴板、截图、全局快捷键服务，所以四项能力都自带模块：

| 能力 | 模块 | 备注 |
|---|---|---|
| 通知 | `node-notifier` | 首次使用时才动态加载 |
| 截图 | `screenshot-desktop` + `sharp` | `sharp` 仅 region 模式需要 |
| 剪贴板 | `clipboardy` | 无变更事件，故轮询 |
| 全局热键 | Win32 `RegisterHotKey`（经 PowerShell） | 纯 Node，无原生模块 |

存在的宿主服务：`ctx.tools` / `ctx.attachments` / `ctx.webServer` / `ctx.settings`。

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

- 源码 `src/*.ts` → 构建产物 `lib/*.js`，**提交进 git**（DSH 直接加载 `lib/`，
  安装不跑构建）。`check:lib` 在 `lib/` 与 `src/` 漂移时失败。
- 测试 106 项，全部注入假后端，**不会真弹通知、不真截屏、不真读剪贴板**。
- 配置走 Schemastery schema，字段全部 `.volatile()` → 设置页可改且**即时生效**。
- 代码/commit 英文；文档中文。
- Host 为纯 Node（`ELECTRON_RUN_AS_NODE=1`），禁止使用 Electron API。

## 隐私

- 不收集、不上传任何剪贴板/截图/通知内容。
- 截图**不落临时文件**：字节直接进宿主内容寻址附件库（`ctx.attachments.saveImage`）。
  注意宿主附件库无 GC，截图会累积直到 DSH 自行清理。
- `watch` 与 `autoInject` **默认关闭**；`read_clipboard` 只在模型调用时读。

## 兼容

- `engines.dsh >= 0.2.0-rc.2`（本机 profile 实测运行时版本）
- Windows 优先（热键仅 Windows 实现了注册路径）；macOS / Linux 尽力。

---

## English

`dsh-desktop-shell` is a Cordis plugin bundle for the DeepSeek Harness desktop app.

| Capability | Tool / setting | Status |
|---|---|---|
| Native OS notifications | tool `desktop_notify` | done |
| Screen capture into the conversation | tool `desktop_capture_screen` | done |
| Clipboard read / watch | tool `desktop_read_clipboard` | done |
| Global hotkey | setting `hotkey` | partial, see limits |

**Known limits.** The host exposes no window or tray seam (there is no
`ctx.desktopShell`), so the hotkey cannot focus the DSH window and instead raises a
notification asking you to switch manually; a `shell-bridge/raise` route is registered
for a future upstream seam. There is no drag-to-select overlay for screen capture —
region mode needs an explicit `{x, y, width, height}` rect — because the native
input-capture modules are unavailable (`uiohook-nans` does not exist on npm, and
`iohook` has no prebuilt binary for current Node on Windows). Window capture is not
supported. Clipboard watching is a 750 ms poll and is off by default. All content stays
on the local machine and is never uploaded.

**Dev.** `npm install && npm run verify` (typecheck + build-drift guard + 106 tests).
Tests inject fake backends and never fire a real notification, capture the screen, or
read the clipboard.

See [PLAN.md](./PLAN.md) §11 for the differences between the original plan and the
verified DSH API.
