/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 棋币与经验（经济系统通用 UI）
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */

// 同一页面会渲染多个图标，渐变 id 逐次递增避免冲突
let wallet_svg_seq = 0;

/**
 * @description: 棋币图标（金币 + 中央绿草 + 左上黑子 + 右下白子）
 * @param {number} [size]
 * @return {string}
 */
const wallet_coin_svg = (size = 28) => {
    const uid = `wallet${++wallet_svg_seq}`;
    return `<svg viewBox='0 0 100 100' width='${size}' height='${size}' role='img' aria-label='棋币'>
<defs>
<linearGradient id='${uid}-gold' x1='0' y1='0' x2='0.9' y2='1'>
<stop offset='0' stop-color='#ffe9a3'/><stop offset='0.45' stop-color='#f6c948'/><stop offset='1' stop-color='#c9871b'/>
</linearGradient>
<radialGradient id='${uid}-shine' cx='0.32' cy='0.26' r='0.78'>
<stop offset='0' stop-color='#fff8d6' stop-opacity='0.95'/><stop offset='0.55' stop-color='#fff8d6' stop-opacity='0'/>
</radialGradient>
<radialGradient id='${uid}-black' cx='0.34' cy='0.28' r='0.85'>
<stop offset='0' stop-color='#6f6f78'/><stop offset='0.55' stop-color='#26262c'/><stop offset='1' stop-color='#08080a'/>
</radialGradient>
<radialGradient id='${uid}-white' cx='0.34' cy='0.28' r='0.88'>
<stop offset='0' stop-color='#ffffff'/><stop offset='0.6' stop-color='#f1f2f4'/><stop offset='1' stop-color='#c9ccd2'/>
</radialGradient>
<radialGradient id='${uid}-grass' cx='0.36' cy='0.3' r='0.8'>
<stop offset='0' stop-color='#a8f7b4'/><stop offset='0.6' stop-color='#37c95a'/><stop offset='1' stop-color='#159438'/>
</radialGradient>
</defs>
<circle cx='50' cy='50' r='48' fill='#b3771a'/>
<circle cx='50' cy='50' r='44.5' fill='url(#${uid}-gold)'/>
<circle cx='50' cy='50' r='36' fill='none' stroke='#a86a10' stroke-opacity='0.42' stroke-width='2'/>
<circle cx='50' cy='50' r='44.5' fill='url(#${uid}-shine)'/>
<circle cx='34.5' cy='34.5' r='12' fill='url(#${uid}-black)'/>
<circle cx='65.5' cy='65.5' r='12' fill='url(#${uid}-white)' stroke='#b9bcc2' stroke-width='1'/>
<circle cx='50' cy='50' r='6.4' fill='url(#${uid}-grass)'/>
<circle cx='47.9' cy='47.7' r='1.7' fill='#e0ffe6' fill-opacity='0.9'/>
</svg>`;
};

/**
 * @description: 经验图标（绿色四角星，中心为当前经验等级）
 * @param {number} [level]
 * @param {number} [size]
 * @return {string}
 */
const wallet_exp_svg = (level = 1, size = 40) => {
    const uid = `wallet${++wallet_svg_seq}`;
    const text = String(Math.max(1, Math.trunc(Number(level) || 1)));
    const font_size = text.length >= 4 ? 18 : text.length === 3 ? 22 : 30;
    return `<svg viewBox='0 0 100 100' width='${size}' height='${size}' role='img' aria-label='经验等级 ${text}'>
<defs>
<linearGradient id='${uid}-star' x1='0.15' y1='0' x2='0.85' y2='1'>
<stop offset='0' stop-color='#9cf7a9'/><stop offset='0.5' stop-color='#3ed36a'/><stop offset='1' stop-color='#0f8f36'/>
</linearGradient>
</defs>
<path d='M50 3 Q66 34 97 50 Q66 66 50 97 Q34 66 3 50 Q34 34 50 3 Z' fill='url(#${uid}-star)' stroke='#0b6f2a' stroke-width='2' stroke-linejoin='round'/>
<text x='50' y='52' text-anchor='middle' dominant-baseline='middle' font-size='${font_size}' font-weight='800' fill='#ffffff' stroke='#0b6f2a' stroke-width='2.6' paint-order='stroke' font-family='system-ui,-apple-system,Segoe UI,Roboto,sans-serif'>${text}</text>
</svg>`;
};

/**
 * @description: 注入经济系统通用样式（同一页面只注入一次）
 * @return {void}
 */
const wallet_ensure_style = () => {
    if (document.getElementById('style_wallet_ui')) return;
    const style = document.createElement('style');
    style.id = 'style_wallet_ui';
    style.textContent = `
.wallet-card{display:flex;align-items:center;justify-content:space-between;gap:.9rem;flex-wrap:wrap;padding:.8rem .95rem;border-radius:.9rem;border:1px solid rgba(22,163,74,.18);background:linear-gradient(135deg,#f7fdf8,#eff6ff);box-shadow:inset 0 1px 0 #fff}
.wallet-card-exp{display:flex;align-items:center;gap:.7rem;flex:1 1 15rem;min-width:0}
.wallet-card-star{line-height:0;filter:drop-shadow(0 .22rem .38rem rgba(22,163,74,.26))}
.wallet-card-exp-main{flex:1;min-width:0}
.wallet-card-exp-title{font-size:.78rem;color:#475569;font-weight:600}
.wallet-card-exp-title b{color:#15803d;font-size:.92rem}
.wallet-bar{height:.42rem;border-radius:99px;background:#dbe7dd;overflow:hidden;margin:.3rem 0 .22rem}
.wallet-bar-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#4ade80,#16a34a);transition:width .35s ease}
.wallet-card-exp-sub{font-size:.7rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wallet-card-coin{display:flex;align-items:center;gap:.55rem;padding:.32rem .85rem .32rem .45rem;border-radius:99px;background:#fff;border:1px solid rgba(200,135,26,.28);box-shadow:0 .2rem .6rem rgba(200,135,26,.12)}
.wallet-card-coin-icon{line-height:0}
.wallet-card-coin-label{font-size:.66rem;color:#a16207;font-weight:600;line-height:1.15}
.wallet-card-coin-value{font-size:1.02rem;font-weight:800;color:#b45309;line-height:1.2}
.wallet-card-bag{display:flex;align-items:center;gap:.55rem;padding:.34rem .9rem .34rem .6rem;border-radius:.7rem;border:1px solid rgba(37,99,235,.24);background:linear-gradient(135deg,#eff6ff,#fff);box-shadow:0 .2rem .6rem rgba(37,99,235,.12);cursor:pointer;transition:filter .18s ease,transform .18s ease}
.wallet-card-bag:hover{filter:brightness(1.03)}
.wallet-card-bag:active{transform:scale(.98)}
.wallet-card-bag-icon{line-height:0;color:#2563eb;font-size:1.35rem}
.wallet-card-bag-main{display:flex;flex-direction:column;line-height:1.2;text-align:left}
.wallet-card-bag-title{font-size:.78rem;font-weight:800;color:#1e3a8a}
.wallet-card-bag-sub{display:inline-flex;align-items:center;gap:.25rem;font-size:.72rem;font-weight:700;color:#b45309}
.wallet-inline{display:inline-flex;align-items:center;gap:.28rem;font-weight:700;color:#b45309}
.wallet-inline svg{display:block}
`;
    document.head.appendChild(style);
};

/**
 * @description: 归一化服务端经济数据，缺失字段回落到 1 级 / 0 棋币
 * @param {Object} info
 * @return {{level:number, cur:number, need:number, coin:number}}
 */
const wallet_normalize = (info) => {
    const level = Math.max(1, Math.trunc(Number(info && info.exp_level) || 1));
    const need = Math.max(1, Math.trunc(Number(info && info.exp_need) || 100));
    const raw_cur = Math.trunc(Number(info && info.exp_cur) || 0);
    const cur = Math.min(Math.max(0, raw_cur), need);
    const coin = Math.max(0, Math.trunc(Number(info && info.coin) || 0));
    return { level, cur, need, coin };
};

/**
 * @description: 渲染经济面板（经验等级 + 经验进度 + 棋币余额）
 * @param {HTMLElement} container
 * @param {Object} info 服务端返回的账号 / 资料数据
 * @param {{detail?: boolean, backpack?: boolean}} [options] detail=false 时隐藏当前经验与升级数值（公开资料 / 商店使用）；backpack=true 时把棋币块替换成「我的背包」入口（账号信息使用）
 * @return {{level:number, cur:number, need:number, coin:number} | null}
 */
const wallet_render_panel = (container, info, options = {}) => {
    if (!container) return null;
    wallet_ensure_style();

    const data = wallet_normalize(info);
    const percent = data.need > 0 ? Math.min(100, Math.max(0, (data.cur / data.need) * 100)) : 0;
    const remain = Math.max(0, data.need - data.cur);
    // 经验细节仅账号信息本人可见；公开资料与商店只展示等级与棋币
    const detail = options.detail !== false;
    const exp_main = detail
        ? `<div class='wallet-bar'><div class='wallet-bar-fill' style='width:${percent.toFixed(2)}%;'></div></div>
            <div class='wallet-card-exp-sub'>距下一级还需 ${remain} 经验 · ${data.cur} / ${data.need}</div>`
        : `<div class='wallet-card-exp-sub'>经验进度仅本人可在账号信息中查看</div>`;

    // 账号信息里不再直接展示棋币数，改为「我的背包」入口，棋币与道具都在背包中查看。
    const coin_main = options.backpack
        ? `<button type='button' id='button_user_bag' class='wallet-card-bag' title='打开我的背包'>
            <span class='wallet-card-bag-icon'><sl-icon name='bag'></sl-icon></span>
            <span class='wallet-card-bag-main'>
                <span class='wallet-card-bag-title'>我的背包</span>
                <span class='wallet-card-bag-sub'>${wallet_coin_svg(14)} ${data.coin}</span>
            </span>
        </button>`
        : `<div class='wallet-card-coin'>
        <span class='wallet-card-coin-icon'>${wallet_coin_svg(42)}</span>
        <div>
            <div class='wallet-card-coin-label'>棋币</div>
            <div class='wallet-card-coin-value'>${data.coin}</div>
        </div>
    </div>`;

    container.innerHTML = `
<div class='wallet-card'>
    <div class='wallet-card-exp'>
        <span class='wallet-card-star'>${wallet_exp_svg(data.level, 54)}</span>
        <div class='wallet-card-exp-main'>
            <div class='wallet-card-exp-title'>经验等级 <b>Lv.${data.level}</b></div>
            ${exp_main}
        </div>
    </div>
    ${coin_main}
</div>`;

    return data;
};

/**
 * @description: 行内棋币显示（图标 + 数量）
 * @param {number} value
 * @param {number} [size]
 * @return {string}
 */
const wallet_inline_coin = (value, size = 18) => {
    const count = Math.max(0, Math.trunc(Number(value) || 0));
    return `<span class='wallet-inline'>${wallet_coin_svg(size)}${count}</span>`;
};


window.WalletUI = {
    coin_svg: wallet_coin_svg,
    exp_svg: wallet_exp_svg,
    ensure_style: wallet_ensure_style,
    normalize: wallet_normalize,
    render_panel: wallet_render_panel,
    inline_coin: wallet_inline_coin,
};

export { wallet_coin_svg, wallet_exp_svg, wallet_ensure_style, wallet_render_panel, wallet_inline_coin };
