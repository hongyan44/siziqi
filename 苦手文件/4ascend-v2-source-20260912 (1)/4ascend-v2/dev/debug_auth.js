(() => {
    'use strict';

    const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
    if (!LOCAL_HOSTS.has(location.hostname)) {
        console.error('[4ASCEND] Refused to enable debug authentication outside localhost.');
        return;
    }

    const script = document.currentScript;
    const requestedLevel = Number(script && script.dataset.userLevel);
    const userLevel = Math.min(4, Math.max(1, requestedLevel || 4));
    const tokenHex = '34415343454e442d44454255472d41555448';
    const previousToken = localStorage.getItem('token');
    const debugNameKey = '4ascend.debug-user-name';

    const tokenBytes = () => {
        const bytes = new Uint8Array(tokenHex.length / 2);
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Number.parseInt(tokenHex.slice(index * 2, index * 2 + 2), 16);
        }
        return bytes;
    };

    const debugUser = () => ({
        name: sessionStorage.getItem(debugNameKey) || 'Local Debugger',
        avatar: '',
        time: Math.floor(Date.now() / 1000),
        mail: 'debug@localhost',
        level: userLevel,
        debug: true,
    });

    // The existing navigation gate checks this key synchronously.
    localStorage.setItem('token', tokenHex);

    // Restore the user's original local token when leaving this debug page.
    window.addEventListener('pagehide', () => {
        if (localStorage.getItem('token') !== tokenHex) return;
        if (previousToken === null) localStorage.removeItem('token');
        else localStorage.setItem('token', previousToken);
    }, { once: true });

    // These replace only the browser-side account calls. Server-side protected
    // operations continue to require a real backend token.
    window.http_user_exist = async () => true;
    window.http_user_sms = async () => true;
    window.http_user_login = async () => tokenBytes();
    window.http_user_register = async () => tokenBytes();
    window.http_user_info = async () => debugUser();
    window.http_user_rtoken = async () => tokenBytes();
    window.http_user_unlock_level = async () => userLevel;
    window.http_user_update = async (_token, name) => {
        sessionStorage.setItem(debugNameKey, String(name || 'Local Debugger'));
        return true;
    };

    Object.defineProperty(window, '__4ASCEND_DEBUG_AUTH__', {
        configurable: false,
        enumerable: true,
        writable: false,
        value: Object.freeze({ enabled: true, level: userLevel }),
    });

    const showDebugBadge = () => {
        if (!document.body || document.getElementById('debug_auth_badge')) return;
        const badge = document.createElement('div');
        badge.id = 'debug_auth_badge';
        badge.textContent = `LOCAL DEBUG AUTH · LEVEL ${userLevel}`;
        badge.title = '仅由本地调试服务器注入；不代表真实的后端登录状态';
        Object.assign(badge.style, {
            position: 'fixed',
            right: '8px',
            bottom: '8px',
            zIndex: '2147483647',
            padding: '5px 9px',
            border: '1px solid #b45309',
            borderRadius: '6px',
            background: '#fef3c7',
            color: '#78350f',
            font: '600 11px/1.2 ui-monospace, Consolas, monospace',
            boxShadow: '0 2px 8px rgba(0, 0, 0, .18)',
            pointerEvents: 'none',
        });
        document.body.append(badge);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showDebugBadge, { once: true });
    } else {
        showDebugBadge();
    }

    console.warn(`[4ASCEND] Local debug authentication enabled at level ${userLevel}.`);
})();

