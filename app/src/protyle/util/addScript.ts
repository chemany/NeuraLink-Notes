export const addScriptSync = async (path: string, id: string) => {
    if (document.getElementById(id)) {
        return false;
    }
    // [性能优化] 使用异步 script 标签加载，避免同步 XHR 阻塞页面渲染
    // 原来使用 xhr.open("GET", path, false) 同步请求，在外网访问时需要近1秒，导致页面卡顿
    return new Promise((resolve) => {
        const scriptElement = document.createElement("script");
        scriptElement.type = "text/javascript";
        scriptElement.src = path;
        scriptElement.async = true;
        scriptElement.id = id;

        // 添加超时保护，避免反复刷新
        const timeout = setTimeout(() => {
            console.warn(`Script load timeout: ${path}`);
            // 超时时如果 Lute 已定义就继续，否则继续等待
            if (typeof Lute !== "undefined") {
                resolve(true);
            } else {
                resolve(true); // 继续尝试，不要反复刷新
            }
        }, 30000); // 30秒超时

        scriptElement.onload = () => {
            clearTimeout(timeout);
            if (typeof Lute === "undefined") {
                // Lute 未定义时继续等待，不要立即重试
                console.warn("Lute not defined after load, waiting...");
                setTimeout(() => {
                    if (typeof Lute !== "undefined") {
                        resolve(true);
                    } else {
                        console.error("Lute still undefined after wait");
                        resolve(true); // 不要反复刷新页面
                    }
                }, 1000);
            } else {
                resolve(true);
            }
        };
        scriptElement.onerror = () => {
            clearTimeout(timeout);
            console.error(`Failed to load script: ${path}`);
            resolve(false);
        };
        document.head.appendChild(scriptElement);
    });
};

export const addScript = (path: string, id: string) => {
    return new Promise((resolve) => {
        if (document.getElementById(id)) {
            // 脚本加载后再次调用直接返回
            resolve(false);
            return false;
        }
        const scriptElement = document.createElement("script");
        scriptElement.src = path;
        scriptElement.async = true;
        // 循环调用时 Chrome 不会重复请求 js
        document.head.appendChild(scriptElement);
        scriptElement.onload = () => {
            if (document.getElementById(id)) {
                // 循环调用需清除 DOM 中的 script 标签
                scriptElement.remove();
                resolve(false);
                return false;
            }
            scriptElement.id = id;
            resolve(true);
        };
    });
};
