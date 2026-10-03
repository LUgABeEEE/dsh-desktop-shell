import { describe, expect, it, vi } from 'vitest'

import { Config, fallbackMessage, parseAccelerator, resolveSettings, startHotkeyListener } from '../src/hotkey.js'
import type { SpawnLike } from '../src/hotkey.js'

/** A fake child process whose stdout the test drives by hand. */
function fakeSpawn() {
  const state = {
    stdoutHandlers: [] as ((c: Buffer) => void)[],
    stderrHandlers: [] as ((c: Buffer) => void)[],
    handlers: new Map<string, ((...a: never[]) => void)[]>(),
    killed: false,
    args: [] as string[],
  }
  const spawn: SpawnLike = (_command, args) => {
    state.args = args
    return {
      stdout: { on: (_e, cb) => state.stdoutHandlers.push(cb as (c: Buffer) => void) },
      stderr: { on: (_e, cb) => state.stderrHandlers.push(cb as (c: Buffer) => void) },
      on: (e, cb) => {
        const list = state.handlers.get(e) ?? []
        list.push(cb)
        state.handlers.set(e, list)
      },
      kill: () => {
        state.killed = true
      },
    }
  }
  return {
    state,
    spawn,
    emitStdout: (text: string) => state.stdoutHandlers.forEach((h) => h(Buffer.from(text, 'utf8'))),
    emitStderr: (text: string) => state.stderrHandlers.forEach((h) => h(Buffer.from(text, 'utf8'))),
    emit: (event: string, ...a: never[]) => (state.handlers.get(event) ?? []).forEach((h) => h(...a)),
  }
}

describe('hotkey Config', () => {
  it('is a Standard Schema with volatile fields', () => {
    expect(Config['~standard']).toBeTruthy()
    const parsed = Config({}) as Record<string, { get(): unknown }>
    expect(Object.keys(parsed).sort()).toEqual(['behavior', 'enabled', 'hotkey'])
  })

  it('defaults to Alt+Space, enabled, toggle', () => {
    expect(resolveSettings(Config({}))).toEqual({ hotkey: 'Alt+Space', enabled: true, behavior: 'toggle' })
  })
})

describe('parseAccelerator', () => {
  it('parses the default Alt+Space', () => {
    expect(parseAccelerator('Alt+Space')).toEqual({ mods: 0x0001, vk: 0x20 })
  })

  it('combines multiple modifiers', () => {
    expect(parseAccelerator('Ctrl+Shift+K')).toEqual({ mods: 0x0002 | 0x0004, vk: 'K'.charCodeAt(0) })
    expect(parseAccelerator('Ctrl+Alt+Shift+Win+F5').mods).toBe(0x0001 | 0x0002 | 0x0004 | 0x0008)
  })

  it('accepts modifier aliases', () => {
    const viaCtrl = parseAccelerator('Control+Alt+Space')
    expect(viaCtrl).toEqual(parseAccelerator('Ctrl+Alt+Space'))
    const viaWin = parseAccelerator('Win+F1')
    expect(viaWin.mods).toBe(0x0008)
    expect(viaWin.vk).toBe(0x70)
  })

  it('parses function keys and single characters', () => {
    expect(parseAccelerator('F12').vk).toBe(0x7b)
    expect(parseAccelerator('F1').vk).toBe(0x70)
    expect(parseAccelerator('A').vk).toBe(65)
  })

  it('parses punctuation and navigation keys', () => {
    expect(parseAccelerator('Ctrl+/').vk).toBe(0xbf)
    expect(parseAccelerator('Alt+Down').vk).toBe(0x28)
  })

  it('is case insensitive on modifiers', () => {
    expect(parseAccelerator('aLT+sPACE')).toEqual(parseAccelerator('Alt+Space'))
  })

  it('rejects empty, modifier-only, unknown and doubled keys', () => {
    expect(() => parseAccelerator('')).toThrow(/empty/)
    expect(() => parseAccelerator('   ')).toThrow()
    expect(() => parseAccelerator('Ctrl')).toThrow(/no key/)
    expect(() => parseAccelerator('Ctrl+Shift')).toThrow(/no key/)
    expect(() => parseAccelerator('Alt+Nope')).toThrow(/unknown key/)
    expect(() => parseAccelerator('A+B')).toThrow(/more than one/)
  })
})

describe('startHotkeyListener', () => {
  it('resolves once the helper reports READY', async () => {
    const fake = fakeSpawn()
    const listener = startHotkeyListener('Alt+Space', fake.spawn)
    fake.emitStdout('READY\n')
    await expect(listener.ready).resolves.toBeUndefined()
    listener.stop()
  })

  it('passes the parsed modifier and key to the helper', () => {
    const fake = fakeSpawn()
    const listener = startHotkeyListener('Ctrl+Alt+F9', fake.spawn)
    const { mods, vk } = parseAccelerator('Ctrl+Alt+F9')
    expect(fake.state.args).toContain(String(mods))
    expect(fake.state.args).toContain(String(vk))
    listener.stop()
  })

  it('fires handlers on HOTKEY', async () => {
    const fake = fakeSpawn()
    const listener = startHotkeyListener('Alt+Space', fake.spawn)
    const onTrigger = vi.fn()
    listener.onTrigger(onTrigger)
    fake.emitStdout('READY\n')
    fake.emitStdout('HOTKEY\n')
    expect(onTrigger).toHaveBeenCalledTimes(1)
    listener.stop()
  })

  it('handles several triggers in one chunk and a chunk split mid-line', async () => {
    const fake = fakeSpawn()
    const listener = startHotkeyListener('Alt+Space', fake.spawn)
    const onTrigger = vi.fn()
    listener.onTrigger(onTrigger)
    fake.emitStdout('HOTKEY\nHOTKEY\n')
    expect(onTrigger).toHaveBeenCalledTimes(2)
    fake.emitStdout('HOT')
    expect(onTrigger).toHaveBeenCalledTimes(2)
    fake.emitStdout('KEY\n')
    expect(onTrigger).toHaveBeenCalledTimes(3)
    listener.stop()
  })

  it('surfaces a taken combo as a clear error', async () => {
    const fake = fakeSpawn()
    const listener = startHotkeyListener('Alt+Space', fake.spawn)
    fake.emitStdout('CONFLICT 1409\n')
    await expect(listener.ready).rejects.toThrow(/already taken/)
    listener.stop()
  })

  it('surfaces other registration errors with the Win32 code', async () => {
    const fake = fakeSpawn()
    const listener = startHotkeyListener('Alt+Space', fake.spawn)
    fake.emitStdout('CONFLICT 5\n')
    await expect(listener.ready).rejects.toThrow(/Win32 error 5/)
    listener.stop()
  })

  it('surfaces helper stderr and unexpected exit', async () => {
    const fakeErr = fakeSpawn()
    const l1 = startHotkeyListener('Alt+Space', fakeErr.spawn)
    fakeErr.emitStderr('Add-Type : boom')
    await expect(l1.ready).rejects.toThrow(/hotkey helper failed/)

    const fakeExit = fakeSpawn()
    const l2 = startHotkeyListener('Alt+Space', fakeExit.spawn)
    fakeExit.emit('exit', 3 as never)
    await expect(l2.ready).rejects.toThrow(/exited unexpectedly/)
  })

  it('keeps listening when a handler throws', async () => {
    const fake = fakeSpawn()
    const listener = startHotkeyListener('Alt+Space', fake.spawn)
    listener.onTrigger(() => {
      throw new Error('handler blew up')
    })
    const second = vi.fn()
    listener.onTrigger(second)
    fake.emitStdout('READY\n')
    expect(() => fake.emitStdout('HOTKEY\n')).not.toThrow()
    expect(second).toHaveBeenCalled()
    listener.stop()
  })

  it('kills the helper on stop', () => {
    const fake = fakeSpawn()
    const listener = startHotkeyListener('Alt+Space', fake.spawn)
    listener.stop()
    expect(fake.state.killed).toBe(true)
  })

  it('rejects a malformed accelerator before spawning anything', () => {
    const fake = fakeSpawn()
    expect(() => startHotkeyListener('Ctrl', fake.spawn)).toThrow()
    expect(fake.state.args).toHaveLength(0)
  })
})

describe('fallbackMessage', () => {
  it('is honest that the window cannot be reached, for every behavior', () => {
    for (const behavior of ['toggle', 'summon', 'hide'] as const) {
      const message = fallbackMessage(behavior)
      expect(message.toLowerCase()).toContain('cannot')
      expect(message.length).toBeGreaterThan(20)
    }
  })
})

describe('hotkey plugin contract', () => {
  it('needs no host service', async () => {
    const mod = await import('../src/hotkey.js')
    expect(mod.inject).toEqual([])
    expect(mod.name).toBe('desktop-shell-hotkey')
  })
})
