/**
 * D — clipboard watch / read (P1).
 *
 * M3. Only the settings schema is wired up so far; see DEVLOG.md.
 *
 * Both `watch` and `autoInject` default to false on purpose: clipboard contents
 * are private, and the plugin must not start reading them unless asked
 * (PLAN.md §6).
 */
import Schema from '@deepseek-ai/schemastery';
export declare const name = "desktop-shell-clipboard";
export declare const inject: string[];
export interface ClipboardSettings {
    watch: boolean;
    autoInject: boolean;
    minLength: number;
}
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    watch: Schema<boolean, boolean, "volatile-defined">;
    autoInject: Schema<boolean, boolean, "volatile-defined">;
    minLength: Schema<number, number, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    watch: Schema<boolean, boolean, "volatile-defined">;
    autoInject: Schema<boolean, boolean, "volatile-defined">;
    minLength: Schema<number, number, "volatile-defined">;
}>>, "plain">;
export declare function apply(_ctx: unknown, _config?: unknown): void;
