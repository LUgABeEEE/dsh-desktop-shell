/**
 * D — clipboard watch / read (P1).
 *
 * M3. Only the settings schema is wired up so far; see DEVLOG.md.
 *
 * Both `watch` and `autoInject` default to false on purpose: clipboard contents
 * are private, and the plugin must not start reading them unless asked
 * (PLAN.md §6).
 */

import Schema from '@deepseek-ai/schemastery'

import { CLIPBOARD_DEFAULTS } from './settings.js'

export const name = 'desktop-shell-clipboard'
export const inject: string[] = []

export interface ClipboardSettings {
  watch: boolean
  autoInject: boolean
  minLength: number
}

export const Config = Schema.object({
  watch: Schema.boolean().default(CLIPBOARD_DEFAULTS.watch).volatile(),
  autoInject: Schema.boolean().default(CLIPBOARD_DEFAULTS.autoInject).volatile(),
  minLength: Schema.number().default(CLIPBOARD_DEFAULTS.minLength).volatile(),
})

export function apply(_ctx: unknown, _config: unknown = {}): void {
  // M3: clipboard watch service + `read_clipboard` tool (PLAN.md §4.4).
}
