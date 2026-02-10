import { Constants } from "../constants";
/// #if !MOBILE
import { Tab } from "./Tab";
/// #endif
import { processMessage } from "../util/processMessage";
import { kernelError, reloadSync } from "../dialog/processSystem";
import { App } from "../index";

interface IModelConnectOptions {
    id: string,
    type?: TWS,
    callback?: () => void,
    msgCallback?: (data: IWebSocketData) => void
}

export class Model {
    public ws: WebSocket;
    public reqId: number;
    /// #if !MOBILE
    public parent: Tab;
    /// #else
    // @ts-ignore
    public parent: any;
    /// #endif
    public app: App;
    private reconnectTimer?: number;
    private reconnectDelay = 3000;
    private reconnectResumeHandler?: () => void;
    private pendingReconnectOptions?: IModelConnectOptions;

    constructor(options: {
        app: App,
        id: string,
        type?: TWS,
        callback?: () => void,
        msgCallback?: (data: IWebSocketData) => void
    }) {
        this.app = options.app;
        if (options.msgCallback) {
            this.connect(options);
        }
    }

    private shouldPauseReconnect(): boolean {
        if (typeof document !== "undefined" && document.hidden) {
            return true;
        }
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            return true;
        }
        return false;
    }

    private clearReconnectTimer() {
        if (typeof this.reconnectTimer === "number") {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }

    private clearReconnectResumeHandler() {
        if (this.reconnectResumeHandler) {
            if (typeof document !== "undefined") {
                document.removeEventListener("visibilitychange", this.reconnectResumeHandler);
            }
            if (typeof window !== "undefined") {
                window.removeEventListener("online", this.reconnectResumeHandler);
            }
            this.reconnectResumeHandler = undefined;
        }
    }

    private scheduleReconnect(options: IModelConnectOptions, delay = this.reconnectDelay) {
        this.clearReconnectTimer();
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = undefined;
            this.connect(options);
        }, delay);

        if (delay > 0) {
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        }
    }

    private pauseReconnectUntilActive(options: IModelConnectOptions) {
        this.pendingReconnectOptions = options;
        if (this.reconnectResumeHandler) {
            return;
        }
        this.reconnectResumeHandler = () => {
            if (!this.pendingReconnectOptions || this.shouldPauseReconnect()) {
                return;
            }
            const pending = this.pendingReconnectOptions;
            this.pendingReconnectOptions = undefined;
            this.clearReconnectResumeHandler();
            this.scheduleReconnect(pending, 0);
        };

        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", this.reconnectResumeHandler);
        }
        if (typeof window !== "undefined") {
            window.addEventListener("online", this.reconnectResumeHandler);
        }
    }

    private connect(options: IModelConnectOptions) {
        const websocketURL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
        // 获取认证token
        const getCookie = (name: string): string | null => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) {
                return parts.pop()?.split(';').shift() || null;
            }
            return null;
        };
        const token = localStorage.getItem("siyuan_token") || getCookie("siyuan_token");
        let url = `${websocketURL}?app=${Constants.SIYUAN_APPID}&id=${options.id}${options.type ? "&type=" + options.type : ""}`;
        if (token) {
            url += `&token=${encodeURIComponent(token)}`;
        }
        const ws = new WebSocket(url);
        ws.onopen = () => {
            this.reconnectDelay = 3000;
            this.clearReconnectTimer();
            this.pendingReconnectOptions = undefined;
            this.clearReconnectResumeHandler();

            if (options.callback) {
                options.callback.call(this);
            }
            const logElement = document.getElementById("errorLog");
            if (logElement) {
                // 内核中断后无法 catch fetch 请求错误，重连会导致无法执行 transactionsTimeout
                reloadSync(this.app, { upsertRootIDs: [], removeRootIDs: [] });
                window.siyuan.dialogs.find(item => {
                    if (item.element.id === "errorLog") {
                        item.destroy();
                        return true;
                    }
                });
            }
        };
        ws.onmessage = (event) => {
            if (options.msgCallback) {
                const rawData = JSON.parse(event.data);
                const data = processMessage(rawData);
                options.msgCallback.call(this, data);
            }
        };
        ws.onclose = (ev) => {
            if (0 <= ev.reason.indexOf("unauthenticated")) {
                return;
            }

            if (0 > ev.reason.indexOf("close websocket")) {
                const reconnectOptions = {
                    id: options.id,
                    type: options.type,
                    msgCallback: options.msgCallback
                };

                if (this.shouldPauseReconnect()) {
                    console.debug("WebSocket is closed while page is hidden/offline. Reconnect is paused.", ev);
                    this.pauseReconnectUntilActive(reconnectOptions);
                    return;
                }

                console.warn(`WebSocket is closed. Reconnect will be attempted in ${Math.floor(this.reconnectDelay / 1000)} second.`, ev);
                this.scheduleReconnect(reconnectOptions);
            }
        };
        ws.onerror = (err: Event & { target: { url: string, readyState: number } }) => {
            if (err.target.url.endsWith("&type=main") && err.target.readyState === 3 && !this.shouldPauseReconnect()) {
                kernelError();
            }
        };
        this.ws = ws;
    }

    public send(cmd: string, param: Record<string, unknown>, process = false) {
        if (!this.ws) { // Inbox 无 ws
            return;
        }
        // 检查 WebSocket 状态，只有在 OPEN 状态才发送
        // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
        if (this.ws.readyState !== WebSocket.OPEN) {
            console.debug(`WebSocket not ready (state=${this.ws.readyState}), skip sending: ${cmd}`);
            return;
        }
        this.reqId = process ? 0 : new Date().getTime();
        this.ws.send(JSON.stringify({
            cmd,
            reqId: this.reqId,
            param,
            // pushMode
            // 0: 所有应用所有会话广播
            // 1：自我应用会话单播
            // 2：非自我会话广播
            // 4：非自我应用所有会话广播
            // 5：单个应用内所有会话广播
            // 6：非自我应用主会话广播
        }));
    }
}
