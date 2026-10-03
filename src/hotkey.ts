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

import { spawn } from 'node:child_process'

import Schema from '@deepseek-ai/schemastery'

import { HOTKEY_DEFAULTS } from './settings.js'

export const name = 'desktop-shell-hotkey'
export const inject: string[] = []

export interface HotkeySettings {
  hotkey: string
  enabled: boolean
  behavior: 'toggle' | 'summon' | 'hide'
}

export const Config = Schema.object({
  hotkey: Schema.string().default(HOTKEY_DEFAULTS.hotkey).volatile(),
  enabled: Schema.boolean().default(HOTKEY_DEFAULTS.enabled).volatile(),
  behavior: Schema.union(['toggle', 'summon', 'hide'] as const).default(HOTKEY_DEFAULTS.behavior).volatile(),
})

export interface Accelerator {
  /** Win32 modifier bitmask: ALT 1, CONTROL 2, SHIFT 4, WIN 8. */
  mods: number
  /** Win32 virtual-key code. */
  vk: number
}

const MOD_ALT = 0x0001
const MOD_CONTROL = 0x0002
const MOD_SHIFT = 0x0004
const MOD_WIN = 0x0008

const MODIFIER_ALIASES: Record<string, number> = {
  alt: MOD_ALT,
  option: MOD_ALT,
  opt: MOD_ALT,
  control: MOD_CONTROL,
  ctrl: MOD_CONTROL,
  shift: MOD_SHIFT,
  win: MOD_WIN,
  super: MOD_WIN,
  meta: MOD_WIN,
  cmd: MOD_WIN,
  command: MOD_WIN,
}

const VK_ALIASES: Record<string, number> = {
  space: 0x20,
  spacebar: 0x20,
  enter: 0x0d,
  return: 0x0d,
  tab: 0x09,
  esc: 0x1b,
  escape: 0x1b,
  backspace: 0x08,
  delete: 0x2e,
  del: 0x2e,
  insert: 0x2d,
  ins: 0x2d,
  home: 0x24,
  end: 0x23,
  pageup: 0x21,
  pagedown: 0x22,
  up: 0x26,
  down: 0x28,
  left: 0x25,
  right: 0x27,
  '.': 0xbe,
  ',': 0xbc,
  '/': 0xbf,
  ';': 0xba,
  "'": 0xde,
  '[': 0xdb,
  ']': 0xdd,
  '`': 0xc0,
  '-': 0xbd,
  '=': 0xbb,
  '\\': 0xdc,
}

/** Parse an Electron-style accelerator such as `Alt+Space` or `Ctrl+Shift+K`. */
export function parseAccelerator(accelerator: string): Accelerator {
  const parts = String(accelerator ?? '')
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) throw new Error('hotkey is empty')

  let mods = 0
  let key: string | undefined

  for (const part of parts) {
    const lower = part.toLowerCase()
    const mod = MODIFIER_ALIASES[lower]
    if (mod !== undefined) {
      mods |= mod
      continue
    }
    if (key !== undefined) throw new Error(`hotkey has more than one non-modifier key: "${part}"`)
    key = part
  }

  if (key === undefined) throw new Error('hotkey has modifiers but no key')

  let vk: number | undefined = VK_ALIASES[key.toLowerCase()]
  if (vk === undefined) {
    if (/^f([1-9]|1[0-9]|2[0-4])$/.test(lower(key))) {
      vk = 0x70 + Number(key.slice(1)) - 1
    } else if (/^[a-z0-9]$/.test(key.toLowerCase())) {
      // Win32 virtual-key codes for the unshifted alphanumerics are their ASCII value.
      vk = key.toUpperCase().charCodeAt(0)
    }
  }
  if (vk === undefined) throw new Error(`unknown key in hotkey: "${key}"`)

  return { mods, vk }
}

function lower(s: string): string {
  return s.toLowerCase()
}

/** The PowerShell helper that registers the combo and pumps for WM_HOTKEY. */
export const HELPER_SCRIPT = `$ErrorActionPreference = 'Stop'
$src = @'
using System;
using System.Runtime.InteropServices;
public static class DshHotkey {
  [StructLayout(LayoutKind.Sequential)]
  public struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public long ptX; public long ptY; }
  [DllImport("user32.dll", SetLastError = true)] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
  [DllImport("user32.dll", SetLastError = true)] static extern bool UnregisterHotKey(IntPtr hWnd, int id);
  [DllImport("user32.dll")] static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint min, uint max);
  public static int Register(uint mods, uint vk) {
    if (!RegisterHotKey(IntPtr.Zero, 1, mods, vk)) return Marshal.GetLastWin32Error();
    return 0;
  }
  public static void Unregister() { UnregisterHotKey(IntPtr.Zero, 1); }
  public static void Pump() {
    MSG msg;
    while (true) {
      int r = GetMessage(out msg, IntPtr.Zero, 0, 0);
      if (r <= 0) break;
      if (msg.message == 0x0312) { Console.Out.WriteLine("HOTKEY"); Console.Out.Flush(); }
    }
  }
}
'@
Add-Type -TypeDefinition $src
$err = [DshHotkey]::Register([uint32]$args[0], [uint32]$args[1])
if ($err -ne 0) { Write-Output ("CONFLICT " + $err); exit 2 }
Write-Output 'READY'
[Console]::Out.Flush()
try { [DshHotkey]::Pump() } finally { [DshHotkey]::Unregister() }
`

export interface HotkeyListener {
  /** Resolves once the combo is registered, or rejects with a conflict. */
  ready: Promise<void>
  /** Fires each time the combo is pressed. */
  onTrigger: (fn: () => void) => void
  stop: () => void
}

export interface SpawnLike {
  (command: string, args: string[]): {
    stdout: { on: (e: 'data', cb: (c: Buffer) => void) => void }
    stderr: { on: (e: 'data', cb: (c: Buffer) => void) => void }
    on: (e: string, cb: (...a: never[]) => void) => void
    kill: () => void
    pid?: number
  }
}

/** Start the helper. Injection point so tests can supply a fake process. */
export function startHotkeyListener(accelerator: string, spawn: SpawnLike, command = 'powershell.exe'): HotkeyListener {
  const { mods, vk } = parseAccelerator(accelerator)
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', HELPER_SCRIPT, String(mods), String(vk)]

  let resolveReady: () => void = () => {}
  let rejectReady: (e: Error) => void = () => {}
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  const handlers: (() => void)[] = []
  const child = spawn(command, args)

  let pending = ''
  child.stdout.on('data', (chunk: Buffer) => {
    pending += chunk.toString('utf8')
    let index = pending.indexOf('\n')
    while (index !== -1) {
      const line = pending.slice(0, index).trim()
      pending = pending.slice(index + 1)
      index = pending.indexOf('\n')
      if (line === 'READY') resolveReady()
      else if (line.startsWith('CONFLICT')) {
        const code = Number(line.slice('CONFLICT'.length).trim())
        rejectReady(
          new Error(
            code === 1409
              ? 'hotkey is already taken by another application'
              : `could not register the hotkey (Win32 error ${code || 'unknown'})`,
          ),
        )
      } else if (line === 'HOTKEY') {
        for (const fn of handlers) {
          try {
            fn()
          } catch {
            // A broken handler must not kill the listener.
          }
        }
      }
    }
  })

  child.stderr.on('data', (chunk: Buffer) => {
    rejectReady(new Error(`hotkey helper failed: ${chunk.toString('utf8').trim().slice(0, 200)}`))
  })

  child.on('error', (error: unknown) => {
    rejectReady(error instanceof Error ? error : new Error(String(error)))
  })
  child.on('exit', (code: number) => {
    rejectReady(new Error(`hotkey helper exited unexpectedly (code ${code})`))
  })

  return {
    ready,
    onTrigger: (fn) => handlers.push(fn),
    stop: () => {
      try {
        child.kill()
      } catch {
        // Already gone.
      }
    },
  }
}

export function resolveSettings(config: unknown): HotkeySettings {
  const raw = (config ?? {}) as Record<string, unknown>
  const read = <T,>(key: string, fallback: T): T => {
    const field = raw[key]
    if (field !== null && typeof field === 'object' && typeof (field as { get?: unknown }).get === 'function') {
      const value = (field as { get(): T }).get()
      return value === undefined || value === null ? fallback : value
    }
    if (field === undefined || field === null) return fallback
    return field as T
  }
  const behavior = read<HotkeySettings['behavior']>('behavior', HOTKEY_DEFAULTS.behavior)
  return {
    hotkey: read('hotkey', HOTKEY_DEFAULTS.hotkey) || HOTKEY_DEFAULTS.hotkey,
    enabled: read('enabled', HOTKEY_DEFAULTS.enabled),
    behavior: behavior === 'summon' || behavior === 'hide' ? behavior : HOTKEY_DEFAULTS.behavior,
  }
}

/** The notification sent when the shortcut fires, since we cannot focus the window. */
export function fallbackMessage(behavior: HotkeySettings['behavior']): string {
  if (behavior === 'hide') return 'Hide was requested, but this build cannot reach the DSH window. Bring it forward manually.'
  if (behavior === 'summon') return 'Summon was requested, but this build cannot focus the DSH window. Bring it forward manually.'
  return 'Toggle was requested, but this build cannot focus the DSH window. Bring it forward manually.'
}

export function apply(ctx: unknown, config: unknown = {}): void {
  const host = ctx as {
    effect?: (fn: () => unknown, label?: string) => unknown
    inject?: (names: string[], fn: (c: unknown) => void) => void
    webServer?: {
      register: (route: { kind: 'exact' | 'prefix'; path: string; handler: () => void }) => () => void
    }
    logger?: { warn: (m: string) => void; info?: (m: string) => void }
  }
  const logger = host.logger
  let settings = resolveSettings(config)
  let listener: HotkeyListener | undefined

  const notify = async (title: string, message: string) => {
    try {
      const mod = (await import('node-notifier')) as unknown as { default?: { notify: (o: Record<string, unknown>) => void } }
      mod.default?.notify({ title, message, sound: true, wait: false })
    } catch (error) {
      logger?.warn?.(`[desktop-shell-hotkey] fallback notification failed: ${String(error)}`)
    }
  }

  const stop = () => {
    listener?.stop()
    listener = undefined
  }

  const start = () => {
    stop()
    if (!settings.enabled) return
    try {
      listener = startHotkeyListener(settings.hotkey, spawnPowershell)
      listener.ready.catch((error: unknown) => {
        // Acceptance criterion: a taken combo must surface, not fail silently.
        logger?.warn?.(`[desktop-shell-hotkey] ${settings.hotkey} unavailable: ${String(error)}`)
      })
      listener.onTrigger(() => {
        settings = resolveSettings(config)
        void notify(`${settings.hotkey} pressed`, fallbackMessage(settings.behavior))
      })
      logger?.info?.(`[desktop-shell-hotkey] registered ${settings.hotkey}`)
    } catch (error) {
      logger?.warn?.(`[desktop-shell-hotkey] could not register ${settings.hotkey}: ${String(error)}`)
    }
  }

  // A `/shell-bridge/raise` route so a future Desktop shell has an endpoint to
  // call. Path is document-relative with no leading slash, as the host serves
  // with `<base href="./">`. Nothing calls this today.
  try {
    host.webServer?.register({
      kind: 'prefix',
      path: 'shell-bridge/raise',
      handler: () => {
        void notify('DSH', 'The window was requested, but this build cannot focus it.')
      },
    })
  } catch (error) {
    logger?.warn?.(`[desktop-shell-hotkey] raise route not registered: ${String(error)}`)
  }

  if (host.effect) {
    host.effect(() => {
      start()
      return stop
    }, 'desktop-shell-hotkey: global hotkey')
  } else {
    start()
  }

  // Volatile settings change without remounting the fiber, so re-register when
  // they actually change rather than only at startup.
  const anyHost = host as { on?: (e: string, h: (...a: never[]) => unknown) => unknown }
  try {
    anyHost.on?.('loader/volatile-update', (() => {
      const next = resolveSettings(config)
      if (next.hotkey !== settings.hotkey || next.enabled !== settings.enabled) {
        settings = next
        start()
      }
    }) as (...args: never[]) => unknown)
  } catch {
    // Older host without the event: startup registration still applies.
  }
}

const spawnPowershell: SpawnLike = (command, args) =>
  spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }) as unknown as ReturnType<SpawnLike>
