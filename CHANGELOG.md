# Changelog

## 0.1.0 (2026-10-04)

DeepSeek Harness 桌面 OS 集成插件首个版本。

### 能力

- **通知** desktop_notify：系统原生通知；挂钩任务完成 / 待审批（approval/request）
- **截图** desktop_capture_screen：全屏 / region（显式坐标）→ 会话附件，不落临时文件
- **剪贴板** desktop_read_clipboard：按需读取 + 可选轮询监听（默认关闭）
- **全局热键**：Win32 RegisterHotKey（PowerShell 宿主，零原生模块）；按下弹通知提示切换

### 安装

```bash
dsh plugin --profile <非 desktop 的 profile> add F:/mimo/dsh/dsh-desktop-shell
```

desktop profile 由 Electron 应用独占管理，请在应用内插件页安装。
路径不要加 `file:` 前缀。

### 兼容

- DSH >= 0.2.0-rc.2（已在 0.2.0-rc.2 真机加载验证）
- Node >= 20

### 已知限制

1. 热键无法聚焦 DSH 窗口（宿主无窗口 seam），按下仅弹通知
2. 截图无拖拽框选；region 需显式坐标；不支持 window 模式
3. 剪贴板监听为 750ms 轮询，高完整性级别进程的写入可能看不到
4. 热键「真实按键触发」需人工键盘验证

### 质量

- typecheck / check:lib / vitest **114/114**
- 真机：临时 profile 安装加载成功，4 行 bundle patch 全部解析
- 真机：4 个子插件在宿主插件清单中均为 `enabled: true` + `fiberPhase: "active"`
- 真机：4 组设置项 `autoGenerate: true` / `applies: "live"`，写入往返（minLength 8→21→8）成功
- **未验证**：通知真弹、截图进会话、剪贴板读出 —— 需可用的模型凭据跑真实对话
