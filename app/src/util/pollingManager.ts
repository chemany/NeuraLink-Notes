import {fetchPost} from "./fetch";
import {progressBackgroundTask, progressStatus} from "../dialog/processSystem";

type PollingCallback = (data: any) => void;

// 轮询配置
interface PollingConfig {
    url: string;
    interval: number; // 毫秒
    callbacks: {
        onData?: PollingCallback;
        onError?: (error: Error) => void;
    };
}

interface PollingState {
    failureCount: number;
}

class PollingManager {
    private timers: Map<string, number> = new Map();
    private pollingConfigs: Map<string, PollingConfig> = new Map();
    private pollingStates: Map<string, PollingState> = new Map();

    constructor() {
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", () => {
                if (!document.hidden) {
                    this.runAllPollingNow();
                }
            });
        }
        if (typeof window !== "undefined") {
            window.addEventListener("online", () => {
                this.runAllPollingNow();
            });
        }
    }

    // 启动轮询
    startPolling(id: string, config: PollingConfig) {
        if (this.timers.has(id)) {
            this.stopPolling(id);
        }

        this.pollingConfigs.set(id, config);
        this.pollingStates.set(id, {failureCount: 0});

        // 立即执行一次
        this.executePolling(id);

        // 设置定时器
        const timer = window.setInterval(() => {
            this.executePolling(id);
        }, config.interval);

        this.timers.set(id, timer);
    }

    // 停止轮询
    stopPolling(id: string) {
        const timer = this.timers.get(id);
        if (timer) {
            clearInterval(timer);
            this.timers.delete(id);
        }
        this.pollingConfigs.delete(id);
        this.pollingStates.delete(id);
    }

    private runAllPollingNow() {
        this.pollingConfigs.forEach((_config, id) => {
            this.executePolling(id);
        });
    }

    private shouldSkipPolling(): boolean {
        if (typeof document !== "undefined" && document.hidden) {
            return true;
        }
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            return true;
        }
        return false;
    }

    // 执行一次轮询
    private executePolling(id: string) {
        const config = this.pollingConfigs.get(id);
        if (!config || this.shouldSkipPolling()) {
            return;
        }

        const state = this.pollingStates.get(id) || {failureCount: 0};

        fetchPost(config.url, {}, (response) => {
            if (state.failureCount > 0) {
                console.info(`[polling:${id}] recovered after ${state.failureCount} failed attempts`);
                state.failureCount = 0;
            }
            if (config.callbacks.onData) {
                config.callbacks.onData(response.data);
            }
        }, {
            silentNetworkError: true,
            onError: (error) => {
                state.failureCount += 1;
                if (state.failureCount === 1 || state.failureCount % 20 === 0) {
                    console.warn(`[polling:${id}] request failed, will retry (${state.failureCount})`, error);
                }
                if (config.callbacks.onError) {
                    config.callbacks.onError(error);
                }
            },
        });

        this.pollingStates.set(id, state);
    }

    // 停止所有轮询
    stopAll() {
        this.timers.forEach((timer) => {
            clearInterval(timer);
        });
        this.timers.clear();
        this.pollingConfigs.clear();
        this.pollingStates.clear();
    }

    // 检查是否正在轮询
    isPolling(id: string): boolean {
        return this.timers.has(id);
    }
}

// 导出单例
export const pollingManager = new PollingManager();

// 预定义的轮询配置
export const POLLING_IDS = {
    SYSTEM_STATUS: "system_status",
    TASK_LIST: "task_list",
    TAG_LIST: "tag_list",
    REF_COUNT: "ref_count",
} as const;

// 启动系统状态轮询
export function startSystemStatusPolling() {
    pollingManager.startPolling(POLLING_IDS.SYSTEM_STATUS, {
        url: "/api/system/status",
        interval: 5000, // 5秒
        callbacks: {
            onData: (data) => {
                // 更新状态栏消息
                if (data.msg) {
                    progressStatus({msg: data.msg, cmd: "statusbar"});
                }
            },
        },
    });
}

// 启动后台任务轮询
export function startTaskListPolling() {
    pollingManager.startPolling(POLLING_IDS.TASK_LIST, {
        url: "/api/task/list",
        interval: 3000, // 3秒
        callbacks: {
            onData: (data) => {
                progressBackgroundTask(data.tasks || []);
            },
        },
    });
}

// 启动标签列表轮询
export function startTagListPolling() {
    pollingManager.startPolling(POLLING_IDS.TAG_LIST, {
        url: "/api/tag/list",
        interval: 10000, // 10秒
        callbacks: {
            onData: (data) => {
                // 标签更新由前端组件自行处理
                window.siyuan.emitter.emit("tag-list-update", data.tags);
            },
        },
    });
}

// 停止所有轮询
export function stopAllPolling() {
    pollingManager.stopAll();
}
