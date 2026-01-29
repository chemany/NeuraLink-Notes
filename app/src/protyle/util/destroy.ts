import {hideElements} from "../ui/hideElements";
import {isSupportCSSHL} from "../render/searchMarkRender";

// 全局定时器管理，用于跟踪所有protyle实例的定时器
const protyleTimers = new WeakMap<IProtyle, Set<number>>();

export const addProtyleTimer = (protyle: IProtyle, timerId: number) => {
    if (!protyleTimers.has(protyle)) {
        protyleTimers.set(protyle, new Set());
    }
    protyleTimers.get(protyle).add(timerId);
    return timerId;
};

export const removeProtyleTimer = (protyle: IProtyle, timerId: number) => {
    const timers = protyleTimers.get(protyle);
    if (timers) {
        timers.delete(timerId);
    }
    clearTimeout(timerId);
};

export const clearAllProtyleTimers = (protyle: IProtyle) => {
    const timers = protyleTimers.get(protyle);
    if (timers) {
        timers.forEach(timerId => clearTimeout(timerId));
        timers.clear();
    }
};

export const destroy = (protyle: IProtyle) => {
    if (!protyle) {
        return;
    }
    hideElements(["util"], protyle);
    if (isSupportCSSHL()) {
        protyle.highlight.markHL.clear();
        protyle.highlight.mark.clear();
        protyle.highlight.ranges = [];
        protyle.highlight.rangeIndex = 0;
    }
    protyle.observer?.disconnect();
    protyle.observerLoad?.disconnect();

    // 清理所有DOM引用和事件监听器
    if (protyle.wysiwyg?.element) {
        // 清理DOM内容以释放内存
        protyle.wysiwyg.element.innerHTML = '';
        protyle.wysiwyg.lastHTMLs = {};
    }

    // 清理内容元素
    if (protyle.contentElement) {
        protyle.contentElement.innerHTML = '';
    }

    protyle.element.classList.remove("protyle");
    protyle.element.removeAttribute("style");

    // 清理所有定时器
    clearAllProtyleTimers(protyle);

    if (protyle.undo) {
        protyle.undo.clear();
    }
    try {
        protyle.ws.send("closews", {});
    } catch (e) {
        const timerId = window.setTimeout(() => {
            try {
                protyle.ws.send("closews", {});
            } catch (e2) {
                // 忽略关闭时的错误
            }
        }, 10240);
        // 不跟踪这个定时器，因为它在destroy之后执行
    }
    protyle.app.plugins.forEach(item => {
        item.eventBus.emit("destroy-protyle", {
            protyle,
        });
    });
};
