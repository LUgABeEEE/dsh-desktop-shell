/**
 * C — screenshot capture → image attachment (P1).
 * M0 stub: export shape only; M2 implements screenshot-desktop + attachments.
 */

export const name = 'desktop-shell-capture'

/** Planned inject for M2: tools, attachments, fs. */
export const inject = []

/**
 * Settings schema (PLAN.md §3.4).
 */
export const Config = {
  type: 'object',
  properties: {
    defaultMode: {
      type: 'string',
      enum: ['fullscreen', 'region', 'window'],
      default: 'region',
      description: 'Default capture mode',
    },
    imageFormat: {
      type: 'string',
      enum: ['png', 'jpeg'],
      default: 'png',
      description: 'Screenshot image format',
    },
  },
}

/**
 * @param {any} ctx
 * @param {any} [config]
 */
export function apply(ctx, config = {}) {
  // M2: register `capture_screen` tool (PLAN.md §4.3)
}
