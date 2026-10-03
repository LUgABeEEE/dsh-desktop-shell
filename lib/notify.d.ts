export declare const name = "desktop-shell-notify";
export declare const inject: string[];
export interface Config {
    onTaskComplete?: boolean;
    onApprovalNeeded?: boolean;
    sound?: boolean;
    titlePrefix?: string;
}
/**
 * Settings schema. DSH 0.1.7+ derives the settings page from the plugin's Config
 * export (see PLAN.md §3.4). Exported under both `Config` and `ConfigSchema`
 * because the two names are in use across the installed plugin set — keeping
 * both means the settings page resolves regardless of which one the host reads.
 *
 * `Config` the interface (type space) and `Config` the const (value space)
 * deliberately share a name; TypeScript allows this and it mirrors how
 * dsh-cost-meter exposes its schema.
 */
export declare const Config: {
    readonly type: "object";
    readonly properties: {
        readonly onTaskComplete: {
            readonly type: "boolean";
            readonly default: true;
            readonly description: "Notify when a task/turn completes";
        };
        readonly onApprovalNeeded: {
            readonly type: "boolean";
            readonly default: true;
            readonly description: "Notify when user approval is required";
        };
        readonly sound: {
            readonly type: "boolean";
            readonly default: true;
            readonly description: "Play notification sound";
        };
        readonly titlePrefix: {
            readonly type: "string";
            readonly default: "DSH · ";
            readonly description: "Notification title prefix";
        };
    };
};
/** Alias of {@link Config}, kept for callers written against the M0 scaffold. */
export declare const ConfigSchema: {
    readonly type: "object";
    readonly properties: {
        readonly onTaskComplete: {
            readonly type: "boolean";
            readonly default: true;
            readonly description: "Notify when a task/turn completes";
        };
        readonly onApprovalNeeded: {
            readonly type: "boolean";
            readonly default: true;
            readonly description: "Notify when user approval is required";
        };
        readonly sound: {
            readonly type: "boolean";
            readonly default: true;
            readonly description: "Play notification sound";
        };
        readonly titlePrefix: {
            readonly type: "string";
            readonly default: "DSH · ";
            readonly description: "Notification title prefix";
        };
    };
};
export declare function apply(_ctx: unknown, _config?: Config): void;
