/**
 * A — global hotkey to summon/hide the window (P0, hardest).
 *
 * The hard part is not the hotkey, it is what to do with it. There is no window
 * seam: no `ctx.desktopShell`, and searching the Desktop bundle for
 * `desktopShell` / `shell-bridge` / `globalShortcut` returns nothing, so the
 * Electron-side window and keyboard handling are unreachable from a Cordis
 * plugin (PLAN.md section 11.4).
 *
 * Two consequences worth stating plainly:
 *
 * 1. Hotkeys are registered with the Win32 `RegisterHotKey` API through a
 *    PowerShell host process. This is pure Node on our side — no native addon —
 *    which matters because the obvious native options do not work here: the
 *    `uiohook-nans` named in the original plan does not exist on npm at all, and
 *    `iohook` has no prebuilt binary for current Node on Windows (404, and there
 *    is no compiler toolchain present).
 * 2. Because the window cannot be focused, every `behavior` currently performs
 *    the same fallback: a native notification telling the user the shortcut
 *    fired. A `/shell-bridge/raise` route is registered on the host web server so
 *    a future Desktop shell has an endpoint to call, but nothing calls it today.
 *
 * Verified on Windows: the helper registers (READY), reports a taken combo as
 * `CONFLICT 1409`, and blocks in its message pump until killed. NOT verified:
 * that a physical keypress produces WM_HOTKEY — synthetic key injection is
 * denied in this environment (`SendInput` fails with ERROR_ACCESS_DENIED), so
 * that last hop needs a human at a keyboard.
 */
import Schema from '@deepseek-ai/schemastery';
export declare const name = "desktop-shell-hotkey";
export declare const inject: string[];
export interface HotkeySettings {
    hotkey: string;
    enabled: boolean;
    behavior: 'toggle' | 'summon' | 'hide';
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    hotkey: Schema<string, string, "volatile-defined">;
    enabled: Schema<boolean, boolean, "volatile-defined">;
    behavior: Schema<"toggle" | "summon" | "hide", "toggle" | "summon" | "hide", "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    hotkey: Schema<string, string, "volatile-defined">;
    enabled: Schema<boolean, boolean, "volatile-defined">;
    behavior: Schema<"toggle" | "summon" | "hide", "toggle" | "summon" | "hide", "volatile-defined">;
}>>, "plain">;
export interface Accelerator {
    /** Win32 modifier bitmask: ALT 1, CONTROL 2, SHIFT 4, WIN 8. */
    mods: number;
    /** Win32 virtual-key code. */
    vk: number;
}
/** Parse an Electron-style accelerator such as `Alt+Space` or `Ctrl+Shift+K`. */
export declare function parseAccelerator(accelerator: string): Accelerator;
/** The PowerShell helper that registers the combo and pumps for WM_HOTKEY. */
export declare const HELPER_SCRIPT = "$ErrorActionPreference = 'Stop'\n$src = @'\nusing System;\nusing System.Runtime.InteropServices;\npublic static class DshHotkey {\n  [StructLayout(LayoutKind.Sequential)]\n  public struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public long ptX; public long ptY; }\n  [DllImport(\"user32.dll\", SetLastError = true)] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);\n  [DllImport(\"user32.dll\", SetLastError = true)] static extern bool UnregisterHotKey(IntPtr hWnd, int id);\n  [DllImport(\"user32.dll\")] static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint min, uint max);\n  public static int Register(uint mods, uint vk) {\n    if (!RegisterHotKey(IntPtr.Zero, 1, mods, vk)) return Marshal.GetLastWin32Error();\n    return 0;\n  }\n  public static void Unregister() { UnregisterHotKey(IntPtr.Zero, 1); }\n  public static void Pump() {\n    MSG msg;\n    while (true) {\n      int r = GetMessage(out msg, IntPtr.Zero, 0, 0);\n      if (r <= 0) break;\n      if (msg.message == 0x0312) { Console.Out.WriteLine(\"HOTKEY\"); Console.Out.Flush(); }\n    }\n  }\n}\n'@\nAdd-Type -TypeDefinition $src\n$err = [DshHotkey]::Register([uint32]$args[0], [uint32]$args[1])\nif ($err -ne 0) { Write-Output (\"CONFLICT \" + $err); exit 2 }\nWrite-Output 'READY'\n[Console]::Out.Flush()\ntry { [DshHotkey]::Pump() } finally { [DshHotkey]::Unregister() }\n";
export interface HotkeyListener {
    /** Resolves once the combo is registered, or rejects with a conflict. */
    ready: Promise<void>;
    /** Fires each time the combo is pressed. */
    onTrigger: (fn: () => void) => void;
    stop: () => void;
}
export interface SpawnLike {
    (command: string, args: string[]): {
        stdout: {
            on: (e: 'data', cb: (c: Buffer) => void) => void;
        };
        stderr: {
            on: (e: 'data', cb: (c: Buffer) => void) => void;
        };
        on: (e: string, cb: (...a: never[]) => void) => void;
        kill: () => void;
        pid?: number;
    };
}
/** Start the helper. Injection point so tests can supply a fake process. */
export declare function startHotkeyListener(accelerator: string, spawn: SpawnLike, command?: string): HotkeyListener;
export declare function resolveSettings(config: unknown): HotkeySettings;
/** The notification sent when the shortcut fires, since we cannot focus the window. */
export declare function fallbackMessage(behavior: HotkeySettings['behavior']): string;
export declare function apply(ctx: unknown, config?: unknown): void;
