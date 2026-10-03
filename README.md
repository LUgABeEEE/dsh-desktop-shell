# dsh-desktop-shell

DeepSeek Harness 桌面端 OS 集成插件包（Cordis bundle）。

## 能力（MVP）

| 编号 | 能力 | 入口 |
|---|---|---|
| A | 全局热键唤起/隐藏 DSH | `lib/hotkey.js` |
| B | 系统原生通知 | `lib/notify.js` |
| C | 截图采集 → 会话附件 | `lib/capture.js` |
| D | 剪贴板监听 / 读取 | `lib/clipboard.js` |

方案与验收：见 [PLAN.md](./PLAN.md)。开发日志：见 [DEVLOG.md](./DEVLOG.md)。

## 安装

```bash
dsh plugin --profile desktop add file:F:/mimo/dsh/dsh-desktop-shell
```

## 开发

```bash
npm install
npm run build
npm test
```

- 源码：`src/*.ts` → 构建产物：`lib/*.js`（DSH 实际加载）。
- 代码/commit 英文；文档中文。
- Host 为纯 Node（`ELECTRON_RUN_AS_NODE=1`），禁止使用 Electron API。
- 隐私：不收集、不上传剪贴板/截图内容；临时文件用后即删。

## 兼容

- `engines.dsh >= 0.1.7-rc.2`
- Windows 优先，macOS / Linux 尽力。
