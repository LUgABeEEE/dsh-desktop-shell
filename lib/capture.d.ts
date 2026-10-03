/**
 * C — screen capture (P1).
 *
 * M2. Only the settings schema is wired up so far; see DEVLOG.md.
 *
 * Note for whoever implements the tool: the host has no general screenshot API.
 * `ctx.computerUse` exists but only exposes a single opt-in provider slot and is
 * not installed by default, so real capture needs a third-party module.
 */
import Schema from '@deepseek-ai/schemastery';
export declare const name = "desktop-shell-capture";
export declare const inject: string[];
export interface CaptureSettings {
    defaultMode: 'fullscreen' | 'region' | 'window';
    imageFormat: 'png' | 'jpeg';
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    defaultMode: Schema<"region" | "fullscreen" | "window", "region" | "fullscreen" | "window", "volatile-defined">;
    imageFormat: Schema<"png" | "jpeg", "png" | "jpeg", "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    defaultMode: Schema<"region" | "fullscreen" | "window", "region" | "fullscreen" | "window", "volatile-defined">;
    imageFormat: Schema<"png" | "jpeg", "png" | "jpeg", "volatile-defined">;
}>>, "plain">;
export declare function apply(_ctx: unknown, _config?: unknown): void;
