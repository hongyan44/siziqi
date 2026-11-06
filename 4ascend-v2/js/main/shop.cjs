/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 棋币商店页面
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const shop_wallet = document.getElementById('shop_wallet');
const shop_rules = document.getElementById('shop_rules');
const shop_rates = document.getElementById('shop_rates');
const shop_pass = document.getElementById('shop_pass');
const shop_consume = document.getElementById('shop_consume');
const shop_style = document.getElementById('shop_style');
const shop_subtitle = document.getElementById('shop_subtitle');
const shop_rules_button = document.getElementById('button_rules');
const shop_rules_dialog = document.getElementById('dialog_rules');

const ShToast = window.UiExports.ShToast;
const Skins = window.UiExports.Skins;
const toast = new ShToast();


/**
 * @description: 商品点击委托：卡片与按钮都先打开商品弹窗，真正扣费需在弹窗内二次确认
 * @param {HTMLElement | null} container
 * @return {void}
 */
const shop_bind = (container) => {
    if (!container) return;
    container.addEventListener('click', (event) => {
        const card = event.target.closest('.good');
        if (!card) return;
        const button = event.target.closest('.good-buy');
        if (button && button.disabled) return;
        shop_dialog_open(card.dataset.item);
    });
};


// 基础收益：不足 1 分钟为快棋奖励（胜方 / 和棋 20，败方 1）；其余按在线对局时长计算，败方 0-15，胜方双倍。
// 排位 / 赛事在此基础上叠加倍率。
const SHOP_RULES = [
    { icon: 'lightning', name: '不足 1 分钟', desc: '快棋奖励：胜方与和棋 20 币 / 20 经验，败方 1 币 / 1 经验', value: '20 / 1' },
    { icon: 'stopwatch', name: '1 — 5 分钟', desc: '按对局时间递增，最长接近 7', value: '1 - 7' },
    { icon: 'hourglass-split', name: '5 — 10 分钟', desc: '对局越久收益越高', value: '8 - 10' },
    { icon: 'hourglass', name: '10 — 15 分钟', desc: '接近满额奖励', value: '11 - 14' },
    { icon: 'trophy', name: '15 分钟以上', desc: '败方拿满，胜方翻倍至 30', value: '15' },
];

const SHOP_RATES = [
    { mode: '在线对局', note: '房间号对局', coin: '×1', exp: '×1' },
    { mode: '人机对战', note: 'AI 挑战', coin: '×1', exp: '×1' },
    { mode: '排位对战', note: '排位结算', coin: '×3', exp: '×2' },
    { mode: '赛事对战', note: '赛事对局', coin: '×5', exp: '×3' },
];


/**
 * @description: 2 级 / 3 级权限码卡面（通行证造型）
 * @param {number} level
 * @return {string}
 */
const shop_pass_art = (level) => `
<div class='art-pass ${level >= 3 ? 'lv3' : 'lv2'}'>
    <div class='pass-top'>
        <span class='pass-chip'>LV.${level}</span>
        <span class='pass-label'>ACCESS PASS</span>
    </div>
    <div class='pass-nick'>${level >= 3 ? '渐变色昵称' : '单色昵称'}</div>
    <div class='pass-bar'><i></i><i></i></div>
    <div class='pass-code'>4A-${level}-••••-••••</div>
</div>`;

/**
 * @description: 棋盘皮肤卡面（半写实青玉棋盘）
 * @return {string}
 */
const shop_board_art = () => `
<div class='art-board'>
    <div class='board-skin'>
        <i class='jade-sheen'></i>
        <i class='jade-vein is-wide'></i>
        <i class='jade-vein is-thin'></i>
        <i class='bs-b' style='left:25%;top:25%;'></i>
        <i class='bs-w' style='left:50%;top:50%;'></i>
        <i class='bs-b' style='left:75%;top:50%;'></i>
        <i class='bs-w' style='left:50%;top:75%;'></i>
        <i class='bs-b' style='left:75%;top:25%;'></i>
    </div>
    <span class='board-tag'>青玉</span>
</div>`;

/**
 * @description: 玄金棋盘卡面（黑石棋盘 + 亮金网格 + 罗马数字）
 * @return {string}
 */
const shop_board_gold_art = () => `
<div class='art-board art-board-gold'>
    <div class='board-skin is-gold'>
        <i class='gold-sheen'></i>
        <i class='gold-vein is-wide'></i>
        <i class='gold-vein is-thin'></i>
        <i class='bs-b' style='left:25%;top:25%;'></i>
        <i class='bs-w' style='left:50%;top:50%;'></i>
        <i class='bs-b' style='left:75%;top:50%;'></i>
        <i class='bs-w' style='left:50%;top:75%;'></i>
        <i class='bs-b' style='left:75%;top:25%;'></i>
        <span class='gold-num' style='left:5%;top:20%;'>I</span>
        <span class='gold-num' style='left:5%;top:60%;'>V</span>
        <span class='gold-num' style='left:20%;top:92%;'>I</span>
        <span class='gold-num' style='left:60%;top:92%;'>V</span>
    </div>
    <span class='board-tag is-gold'>黑派</span>
</div>`;

/**
 * @description: 亚特兰蒂斯棋盘卡面（深海渐变 + 金色星点 + 金色圆弧 + 宋体金色数字）
 * @return {string}
 */
const shop_board_atlantis_art = () => `
<div class='art-board art-board-atlantis'>
    <div class='board-skin is-atlantis'>
        <i class='atl-glow'></i>
        <svg class='atl-arcs' viewBox='0 0 100 100' preserveAspectRatio='none' aria-hidden='true'>
            <g fill='none' stroke='#e9c67c' stroke-linecap='round'>
                <circle cx='8' cy='92' r='56' stroke-width='1.1' stroke-dasharray='86 266' transform='rotate(-58 8 92)' opacity='.4' />
                <circle cx='8' cy='92' r='68' stroke-width='.7' stroke-dasharray='70 357' transform='rotate(-40 8 92)' opacity='.26' />
                <circle cx='8' cy='92' r='80' stroke-width='.5' stroke-dasharray='52 451' transform='rotate(-26 8 92)' opacity='.16' />
                <circle cx='92' cy='8' r='38' stroke-width='1' stroke-dasharray='58 181' transform='rotate(70 92 8)' opacity='.34' />
                <circle cx='92' cy='8' r='50' stroke-width='.6' stroke-dasharray='44 270' transform='rotate(85 92 8)' opacity='.2' />
                <circle cx='50' cy='51' r='40' stroke-width='.55' stroke-dasharray='118 133' opacity='.13' />
            </g>
        </svg>
        <i class='atl-grid'></i>
        <i class='atl-spark is-star' style='left:18%;top:22%;'></i>
        <i class='atl-spark' style='left:34%;top:64%;'></i>
        <i class='atl-spark is-big' style='left:62%;top:18%;'></i>
        <i class='atl-spark' style='left:76%;top:44%;'></i>
        <i class='atl-spark is-star' style='left:84%;top:72%;'></i>
        <i class='atl-spark' style='left:46%;top:38%;'></i>
        <i class='atl-spark' style='left:12%;top:82%;'></i>
        <i class='atl-spark is-big' style='left:28%;top:10%;'></i>
        <span class='atl-num' style='left:5.5%;top:22%;'>9</span>
        <span class='atl-num' style='left:5.5%;top:60%;'>5</span>
        <span class='atl-num' style='left:22%;top:93%;'>1</span>
        <span class='atl-num' style='left:60%;top:93%;'>5</span>
        <span class='atl-num' style='left:93%;top:93%;'>9</span>
    </div>
    <span class='board-tag is-atlantis'>深海</span>
</div>`;

/**
 * @description: 亚特兰蒂斯棋子卡面（左：番茄 / 右：洋葱，双方贴照片里的一对眼睛）
 * @return {string}
 */
const shop_piece_atlantis_art = () => `
<div class='art-piece-atlantis'>
    <div class='ap-pane is-dark'>
        <span class='atl-produce is-tomato'>
            <i class='atl-leaf'></i>
            <img class='atl-eyes' src='${Skins.atlantis_eyes_src}' alt=''>
        </span>
        <em class='ap-label'>黑棋 · 番茄</em>
    </div>
    <div class='ap-pane is-light'>
        <span class='atl-produce is-onion'>
            <i class='atl-sprout'></i>
            <img class='atl-eyes' src='${Skins.atlantis_eyes_src}' alt=''>
        </span>
        <em class='ap-label'>白棋 · 洋葱</em>
    </div>
</div>`;

/**
 * @description: 棋子皮肤卡面（左右各半：黑子与白子）
 * @return {string}
 */
const shop_piece_art = () => `
<div class='art-piece'>
    <div class='piece-pane is-dark'>
        <i class='piece-halo'></i>
        <span class='stone-piece is-black p-mid'></span>
        <em class='piece-name'>黑子</em>
    </div>
    <div class='piece-pane is-light'>
        <i class='piece-halo'></i>
        <span class='stone-piece is-white p-mid'></span>
        <em class='piece-name'>白子</em>
    </div>
</div>`;

/**
 * @description: 高级定制棋子卡面（左：红皮革层叠 / 右：黑布料镶金；上正常、下成打）
 * @return {string}
 */
const shop_piece_rouge_art = () => `
<div class='art-piece-rouge'>
    <div class='pr-pane is-rouge'>
        <span class='pr-stone is-leather'></span>
        <i class='pr-drop'></i>
        <span class='pr-stone is-leather is-hit'></span>
        <em class='pr-label'>皮革</em>
    </div>
    <div class='pr-pane is-noir'>
        <span class='pr-stone is-cloth'>
            <svg viewBox='0 0 100 100' preserveAspectRatio='xMidYMid meet' aria-hidden='true'>
                <g stroke='#f0c25a' stroke-width='4.5' stroke-linecap='butt' stroke-linejoin='miter' fill='none'>
                    <path d='M50 0L50 100' />
                    <path d='M50 50L85.4 14.6' />
                    <path d='M50 50L100 50' />
                </g>
            </svg>
        </span>
        <i class='pr-drop'></i>
        <span class='pr-stone is-cloth is-hit'>
            <svg viewBox='0 0 100 100' preserveAspectRatio='xMidYMid meet' aria-hidden='true'>
                <g stroke='#ffd76a' stroke-width='8' stroke-linecap='butt' fill='none'>
                    <path d='M50 0L50 100' />
                    <path d='M0 50L100 50' />
                    <path d='M50 0L100 50L50 100L0 50Z' />
                    <path d='M14.6 85.4L85.4 14.6' />
                </g>
            </svg>
        </span>
        <em class='pr-label'>镶金</em>
    </div>
</div>`;

/**
 * @description: 草皮肤卡面（反曲点：中心蓝色高亮 + 黑红交替渐变环）
 * @return {string}
 */
const shop_grass_art = () => `
<div class='art-grass'>
    <span class='grass-point'>
        <i class='grass-ring'></i>
        <i class='grass-core'></i>
    </span>
    <span class='grass-point is-small'>
        <i class='grass-ring'></i>
        <i class='grass-core'></i>
    </span>
</div>`;

/**
 * @description: 金菱草皮肤卡面（金色菱形：渐变金面 + 中心高光）
 * @return {string}
 */
const shop_grass_gold_art = () => `
<div class='art-grass art-grass-gold'>
    <span class='grass-diamond'>
        <i class='grass-diamond-core'></i>
    </span>
    <span class='grass-diamond is-small'>
        <i class='grass-diamond-core'></i>
    </span>
</div>`;

/**
 * @description: 白玉玲珑草皮肤卡面（玉质圆片：中心白玉 → 四周翠绿 → 外缘墨绿）
 * @return {string}
 */
const shop_grass_jade_art = () => `
<div class='art-grass art-grass-jade'>
    <span class='grass-jade'>
        <i class='jade-gloss'></i>
        <i class='jade-vein is-wide'></i>
        <i class='jade-vein is-thin'></i>
    </span>
    <span class='grass-jade is-small'>
        <i class='jade-gloss'></i>
        <i class='jade-vein is-wide'></i>
    </span>
</div>`;

/**
 * @description: 火与钢草皮肤卡面（猩红三角徽记：双草加圆形边框与刀纹，灼热余烬氛围）
 * @return {string}
 */
const shop_grass_firesteel_art = () => `
<div class='art-grass art-grass-firesteel'>
    <span class='fs-emblem'>
        <i class='fs-ring'></i>
        <i class='fs-tri'></i>
        <svg class='fs-blade' viewBox='0 0 24 24' aria-hidden='true'>
            <path d='M12 2.5c2.3 3 3.4 6.3 2.5 9.7H9.5C8.6 8.8 9.7 5.5 12 2.5z' fill='#ffe6c4' stroke='#4a0508' stroke-width='1.1'/>
            <path d='M8.9 13.6h6.2' stroke='#4a0508' stroke-width='1.6' stroke-linecap='round'/>
            <path d='M10.6 14.1h2.8v6.1h-2.8z' fill='#2b0407'/>
        </svg>
    </span>
    <span class='fs-single'></span>
</div>`;

/**
 * @description: 风格 UI 卡面（星际舰桥：蓝黑面板 + 红色警示灯 + 星图氛围）
 * @return {string}
 */
const shop_ui_art = () => `
<div class='art-ui'>
    <i class='ui-stars'></i>
    <i class='ui-nebula'></i>
    <div class='ui-hud'>
        <div class='ui-hud-top'>
            <i class='ui-dot'></i>
            <i class='ui-dot is-red'></i>
            <i class='ui-top-line'></i>
            <span class='ui-tag'>BRIDGE</span>
        </div>
        <div class='ui-hud-body'>
            <div class='ui-hud-col'>
                <i class='ui-bar' style='width:82%;'></i>
                <i class='ui-bar' style='width:58%;'></i>
                <i class='ui-bar is-red' style='width:36%;'></i>
            </div>
            <span class='ui-ring'><i></i></span>
        </div>
        <div class='ui-hud-foot'>
            <i class='ui-bar is-red' style='width:26%;'></i>
            <i class='ui-bar' style='width:44%;'></i>
        </div>
    </div>
</div>`;


/**
 * @description: 风格 UI 卡面（黑金大厅：炭黑石材 + 日轮顶灯 + 亮金放射纹 + 双金框线）
 * @return {string}
 */
const shop_ui_black_art = () => `
<div class='art-ui-black'>
    <i class='ub-hall'></i>
    <i class='ub-rays'><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b></i>
    <i class='ub-sun'></i>
    <i class='ub-floor'></i>
    <div class='ub-hud'>
        <div class='ub-hud-top'>
            <i class='ub-dot'></i>
            <i class='ub-top-line'></i>
            <span class='ub-tag'>BLACK</span>
        </div>
        <div class='ub-hud-body'>
            <i class='ub-diamond'></i>
            <i class='ub-diamond is-small'></i>
        </div>
        <div class='ub-hud-foot'>
            <i class='ub-bar' style='width:46%;'></i>
            <i class='ub-bar is-gold' style='width:68%;'></i>
        </div>
    </div>
    <i class='ub-frame'></i>
</div>`;


/**
 * @description: 风格 UI 卡面（留青：白纸书封 + 深青标题 + 青绿折扇晕染）
 * @return {string}
 */
const shop_ui_liuqing_art = () => `
<div class='art-ui-liuqing'>
    <i class='ul-wash'></i>
    <i class='ul-band'></i>
    <div class='ul-head'>
        <span class='ul-title'>留青</span>
        <span class='ul-en'>LIU QING</span>
    </div>
    <i class='ul-fan'></i>
    <i class='ul-leaf'></i>
    <i class='ul-leaf is-small'></i>
</div>`;

/**
 * @description: 单局投稿券卡面（撕边票据：虚线裁切线 + 票根编号）
 * @return {string}
 */
const shop_ticket_art = () => `
<div class='art-ticket'>
    <i class='ticket-glow'></i>
    <div class='ticket-slip'>
        <div class='ticket-head'>
            <span class='ticket-mark'>4A</span>
            <span class='ticket-kind'>单局投稿券</span>
        </div>
        <div class='ticket-main'>
            <span class='ticket-title'>投稿券</span>
            <span class='ticket-sub'>SUBMIT · ONE ROUND</span>
        </div>
        <div class='ticket-cut'><i></i></div>
        <div class='ticket-foot'>
            <span class='ticket-stub'>NO. 0001</span>
            <span class='ticket-price-tag'>×1</span>
        </div>
    </div>
</div>`;

const SHOP_PASS = [
    {
        id: 'level2',
        level: 2,
        price: 499,
        name: '2 级权限码',
        desc: '解锁等级 2：昵称可使用单色，并显示等级角标。',
        art: shop_pass_art(2),
    },
    {
        id: 'level3',
        level: 3,
        price: 3999,
        name: '3 级权限码',
        desc: '解锁等级 3：昵称可使用渐变，并显示等级角标。',
        art: shop_pass_art(3),
    },
];

/**
 * @description: 好友赠礼卡面（红金礼盒 + 指定棋币面额与限购标签）
 * @param {string} amount 面额
 * @param {string} tag 限购标签
 * @return {string}
 */
const shop_gift_art = (amount = '500', tag = 'LIMIT 1 / DAY') => `
<div class='art-gift'>
    <i class='gift-glow'></i>
    <div class='gift-box'>
        <div class='gift-lid'><span class='gift-knot'></span></div>
        <div class='gift-body'>
            <span class='gift-ribbon'></span>
            <span class='gift-amount'>${amount}</span>
            <span class='gift-unit'>棋币</span>
        </div>
    </div>
    <div class='gift-tag'>${tag}</div>
</div>`;

const SHOP_CONSUME = [
    { id: 'ticket', price: 49, name: '单局投稿券', desc: '消耗品：等级不足 2 时，可凭券在残局投稿页提交一次投稿。', art: shop_ticket_art() },
    {
        id: 'gift500',
        price: 500,
        name: '好友赠礼：500棋币',
        desc: '消耗品：每天限购 1 个。购买后存入背包，可在背包选择好友赠送，或在好友聊天中直接赠送；对方获得 1 张 500 棋币兑换券。',
        art: shop_gift_art(),
    },
    {
        id: 'gift3000',
        price: 3000,
        min_level: 3,
        name: '好友赠礼：3000棋币',
        desc: '消耗品：每周限购 1 个，周一 0 点刷新，仅权限等级 3 及以上可见。购买后存入背包，可在背包选择好友赠送；对方获得 1 张 3000 棋币兑换券。',
        art: shop_gift_art('3000', 'LIMIT 1 / WEEK'),
    },
];

const SHOP_STYLE = [
    { id: 'piece', price: 999, name: '棋子皮肤：止变', desc: '棋子经典的材质。这种材质的表象，令人很难不联想到对局中的苦算。一百多个回合过去，而棋手仍执黑白两立，落子无悔。', art: shop_piece_art() },
    { id: 'piece_atlantis', price: 1499, name: '棋子皮肤：亚拉弥赛亚的遗留', desc: '“让我们迎接下一位选手！让我们听她报出自己的名字！”<br>“……傻逼主教……”<br>“好的！让我们欢迎傻逼主教选手到擂台上来！”<br>“……？什么鬼，等等……！”', art: shop_piece_atlantis_art() },
    { id: 'piece_rouge', price: 1830, name: '棋子皮肤：Le Rouge et Le Noir', desc: '人因喜恶来定义某物。因此会在注视着某物的时候，不自知的投下钉子。而这里的这种表象，无疑是某个存在因自己所见之物而故意投下的钉子。在系统之外，也在系统的系统之外——这种素材，也许正在被滥用着，一如这系统曾经的产物。', art: shop_piece_rouge_art() },
    { id: 'grass', price: 599, name: '草皮肤：反曲点', desc: '从凌日的潮汐中提取出的概念，现被用于具现、固定化一个有关键作用的节点。它正在扭曲、左右战局。', art: shop_grass_art() },
    { id: 'grass_gold', price: 325, name: '草皮肤：黄金', desc: '轻易无法生成的元素。象征着必须去夺取的事物。然而夺取与否并不决定胜负，只有凝结后的，那些渴望最快结束与祈求最慢结束的意志的碰撞，才能裁决金冠的所属。', art: shop_grass_gold_art() },
    { id: 'grass_jade', price: 899, name: '草皮肤：白玉玲珑', desc: '温润而典雅的白玉，棋品好的棋手非常喜欢。<br>苍耳埋径，白茅压野，枯根一寸映新春。<br>露梳乱子，苔蚀空枰，一着落处判枯荣。', art: shop_grass_jade_art() },
    { id: 'grass_firesteel', price: 1299, name: '草皮肤：火与钢', desc: '火与钢<br>让我们纪念一名战士。<br>利刃出鞘，重铸起源。', art: shop_grass_firesteel_art() },
    { id: 'board', price: 999, name: '棋盘皮肤：玉中乾坤', desc: '从某个存在的记忆中提取出的、温润与青涩的棋盘。会有人愿意在此对弈十年，甚至更久。<br>川绣春江，山锁秋暝，故梦更尽万物新。<br>月斫冷子，日老残枰，劫灰吹尽送古今。', art: shop_board_art() },
    { id: 'board_gold', price: 799, name: '棋盘皮肤：黑派', desc: '在那些崇尚填满棋盘、用黑色不透气布料包裹自己的棋手中，有些非常喜欢这种棋盘。', art: shop_board_gold_art() },
    { id: 'board_atlantis', price: 1999, name: '棋盘皮肤：亚特兰蒂斯', desc: '海中的残余是无数人渴求的宝藏，亦曾有人幻想以此为家。可它已经沉在那里，不再闪耀。<br><i>O Fortuna velut luna statu variabilis……</i>', art: shop_board_atlantis_art() },
    { id: 'theme', price: 3999, name: 'UI替换：幽蓝时空', desc: '时空在脚下流淌，未来在手中交织。<br>在蓝移与红移的交错中，前进吧。', art: shop_ui_art() },
    { id: 'theme_black', price: 4999, name: 'UI替换：保存神域', desc: '黑派所追求的保存价值被保存的领域。所有因填棋盘而被填堵的棋子所进行的黑派式的下法，都在这个领域中被妥善地保存着。这个领域既是永远保存的领域，也是棋子想要无限接近填满棋盘的冲动的领域。如此诸多的意志缠紧，于是永恒的殿堂在此具现。', art: shop_ui_black_art() },
    { id: 'theme_liuqing', price: 1399, name: 'UI替换：留青', desc: '于是万物更新。', art: shop_ui_liuqing_art() },
];

// 商品详情弹窗里补充的说明文字
const SHOP_NOTES = {
    level2: '兑换后立即生效：昵称可使用单色，并在资料中显示等级角标。',
    level3: '兑换后立即生效：昵称可使用渐变，并在资料中显示等级角标。',
    piece: '购买后立即生效于本账号：棋盘上双方的黑子与白子都会替换为止变棋子，对手不可见。',
    piece_rouge: '购买后立即生效于本账号：白子换成皮革层叠、黑子换成布料镶金，成打（ASCEND）时纹理加深并加粗金线，与基础棋子皮肤互斥，对手不可见。',
    piece_atlantis: '购买后立即生效于本账号：黑子换成番茄、白子换成洋葱，双方都贴上一对眼睛；与止变、Le Rouge et Le Noir 互斥，对手不可见。',
    grass: '购买后立即生效于本账号：棋盘上所有草都会替换为反曲点样式，对手不可见。',
    grass_gold: '购买后立即生效于本账号：棋盘上所有草都会替换为草皮肤：黄金样式，与反曲点皮肤互斥，对手不可见。',
    grass_jade: '购买后立即生效于本账号：棋盘上所有草都会替换为白玉玲珑玉质圆片，中心白玉渐入翠绿、外缘墨绿，与反曲点、黄金皮肤互斥，对手不可见。',
    grass_firesteel: '购买后立即生效于本账号：草点未被棋子占据时显示猩红三角徽记，被占据时改为环绕棋子的火焰；双草为三角外加圆形边框、中心刀纹的徽记，被占据时火焰更炽烈猩红。与反曲点、黄金、白玉玲珑皮肤互斥，对手不可见。',
    board: '购买后立即生效于本账号：棋盘替换为玉中乾坤样式，对手不可见。',
    board_gold: '购买后立即生效于本账号：棋盘替换为黑派定制黑石样式，网格与坐标改为亮金色罗马数字，对手不可见。',
    board_atlantis: '购买后立即生效于本账号：棋盘替换为深海蓝渐变，点缀金色星点与圆弧暗纹，网格与坐标改为金色，坐标使用宋体阿拉伯数字；与玉中乾坤、黑派棋盘互斥，对手不可见。',
    theme: '购买后立即生效于本账号：全站界面切换为蓝黑星际舰桥风格，红色点缀，主页附带专属星图插画；棋盘、棋子与反曲点同步换成虚空能量样式（已购的棋子/草皮肤优先）；可在本地设置中随时关闭。',
    theme_black: '购买后立即生效于本账号：全站界面切换为黑石亮金风格，主页附带专属黑金大厅插画与日轮金芒动态；棋盘、棋子与反曲点同步换成黑派样式（已购的棋子/草/棋盘皮肤优先），与幽蓝时空互斥且优先；可在本地设置中随时关闭。',
    theme_liuqing: '购买后立即生效于本账号：全站界面切换为白纸青绿的清爽风格，主页与对局、赛事、剧情、成就页各自附带不同的动态纸景插画；棋盘、棋子与草同步换成留青样式（已购的棋子/草/棋盘皮肤优先），与幽蓝时空、黑派互斥且优先；可在本地设置中随时关闭。',
    ticket: '购买后存入背包的消耗品类：等级不足 2 时可在残局投稿页凭券提交一次投稿，投稿成功后才扣除；等级 2 及以上正常投稿不消耗。',
    gift500: '购买后存入背包的消耗品类：每天限购 1 个。赠送好友后，对方背包获得 1 张 500 棋币兑换券，可自行在背包中使用。',
    gift3000: '购买后存入背包的消耗品类：每周限购 1 个，每周一 0 点刷新，仅权限等级 3 及以上可见。赠送好友后，对方背包获得 1 张 3000 棋币兑换券，可自行在背包中使用。',
};


// 皮肤商品：购买后只在本账号生效，双方棋子、草、棋盘与风格 UI 都按皮肤绘制，对手不可见
const SHOP_SKIN_IDS = ['piece', 'piece_rouge', 'piece_atlantis', 'grass', 'grass_gold', 'grass_jade', 'grass_firesteel', 'board', 'board_gold', 'board_atlantis', 'theme', 'theme_black', 'theme_liuqing'];

let shop_token = null;
let shop_info = null;
let shop_busy = false;

const shop_dialog = document.getElementById('dialog_good');
const shop_dialog_body = document.getElementById('shop_good_detail');
let shop_dialog_item = null;


/**
 * @description: 当前账号已拥有的皮肤 id 列表
 * @return {string[]}
 */
const shop_skin_list = () => {
    const skins = shop_info && Array.isArray(shop_info.skins) ? shop_info.skins : [];
    return SHOP_SKIN_IDS.filter((id) => skins.includes(id));
};

/**
 * @description: 把本账号已购皮肤写入本机缓存，供对局画布读取
 * @return {void}
 */
const shop_skin_sync = () => {
    const list = shop_skin_list();
    try {
        window.localStorage.setItem('4a_skins', JSON.stringify({
            piece: list.includes('piece'),
            piece_rouge: list.includes('piece_rouge'),
            piece_atlantis: list.includes('piece_atlantis'),
            grass: list.includes('grass'),
            grass_gold: list.includes('grass_gold'),
            grass_jade: list.includes('grass_jade'),
            grass_firesteel: list.includes('grass_firesteel'),
            board: list.includes('board'),
            board_gold: list.includes('board_gold'),
            board_atlantis: list.includes('board_atlantis'),
            theme: list.includes('theme'),
            theme_black: list.includes('theme_black'),
            theme_liuqing: list.includes('theme_liuqing'),
        }));
    } catch (_) {
        // 隐私模式下 localStorage 可能不可用，忽略即可
    }
};

/**
 * @description: 同步装扮成就（按账号当前拥有的外观列表判定：≥1 解锁「投影」，≥3 解锁「交织的投影」）
 * @return {void}
 */
const shop_achievement_sync = () => {
    if (typeof window.achievement_event !== 'function') return;
    window.achievement_event('skin_owned', { skins: shop_skin_list() });
};


/**
 * @description: 渲染收益规则与模式倍率
 * @return {void}
 */
const shop_render_rules = () => {
    const coin_icon = window.WalletUI ? window.WalletUI.coin_svg(18) : '';
    if (shop_rules) {
        shop_rules.innerHTML = SHOP_RULES.map((rule) => `
<div class='shop-rule'>
    <div class='shop-rule-icon'><sl-icon name='${rule.icon}'></sl-icon></div>
    <div class='shop-rule-main'>
        <div class='shop-rule-name'>${rule.name}</div>
        <div class='shop-rule-desc'>${rule.desc}</div>
    </div>
    <div class='shop-rule-value'>${coin_icon}${rule.value}</div>
</div>`).join('');
    }

    if (shop_rates) {
        shop_rates.innerHTML = SHOP_RATES.map((rate, index) => `
<div class='shop-rate ${index === 0 ? 'is-base' : ''}'>
    <div class='shop-rate-mode'><b>${rate.mode}</b><span>${rate.note}</span></div>
    <div class='shop-rate-pill'><span>棋币</span>${rate.coin}</div>
    <div class='shop-rate-pill is-exp'><span>经验</span>${rate.exp}</div>
</div>`).join('');
    }
};

/**
 * @description: 商品卡模板
 * @param {Object} good
 * @param {{badge:string, badge_class:string, tag:string, action:string, disabled:boolean, buy_class:string}} opts
 * @return {string}
 */
const shop_good_html = (good, opts) => {
    const coin_icon = window.WalletUI ? window.WalletUI.coin_svg(16) : '';
    return `
<div class='good' data-item='${good.id}'>
    <div class='good-art'>
        ${good.art}
        <span class='good-badge ${opts.badge_class}'>${opts.badge}</span>
    </div>
    <div class='good-body'>
        <div class='good-name'>${good.name}<span class='good-tag'>${opts.tag}</span></div>
        <div class='good-desc'>${good.desc}</div>
    </div>
    <div class='good-foot'>
        <span class='good-price'>${coin_icon}${good.price}</span>
        <button type='button' class='good-buy ${opts.buy_class}' ${opts.disabled ? 'disabled' : ''}>${opts.action}</button>
    </div>
</div>`;
};

/**
 * @description: 按商品类型与当前账号状态计算卡片展示状态
 * @param {Object} good
 * @param {boolean} locked 未登录时只展示商品，不允许兑换
 * @return {{badge:string, badge_class:string, tag:string, action:string, disabled:boolean, buy_class:string}}
 */
const shop_good_state = (good, locked = false) => {
    const info = shop_info || {};
    const level = Math.max(1, Math.trunc(Number(info.level) || 1));
    const coin = Math.max(0, Math.trunc(Number(info.coin) || 0));
    const skin = SHOP_SKIN_IDS.includes(good.id);
    const consume = good.id === 'ticket' || good.id === 'gift500';

    // 外观分区：未实装商品保持占位
    if (good.dev) {
        return { badge: '开发中', badge_class: 'dev', tag: '外观', action: '敬请期待', disabled: true, buy_class: '' };
    }
    if (locked) {
        return { badge: '未登录', badge_class: 'no', tag: consume ? '消耗品' : (skin ? '外观' : '权限'), action: '请先登录', disabled: true, buy_class: '' };
    }
    // 好友赠礼：每天限购 1 个，徽标展示当前持有数量
    if (good.id === 'gift500') {
        const held = Math.max(0, Math.trunc(Number(info.gift_vouchers) || 0));
        const badge = held > 0 ? `持有 ${held} 个` : '可购买';
        if (Boolean(info.gift_today)) {
            return { badge: held > 0 ? `持有 ${held} 个` : '今日已购', badge_class: held > 0 ? 'ok' : 'no', tag: '消耗品', action: '今日已购', disabled: true, buy_class: '' };
        }
        if (coin >= good.price) {
            return { badge, badge_class: 'ok', tag: '消耗品', action: '购买', disabled: false, buy_class: 'buy-gold' };
        }
        return { badge: held > 0 ? `持有 ${held} 个` : '棋币不足', badge_class: 'no', tag: '消耗品', action: '棋币不足', disabled: true, buy_class: '' };
    }
    // 3000 好友赠礼：每周限购 1 个（周一 0 点刷新），徽标展示当前持有数量
    if (good.id === 'gift3000') {
        const held = Math.max(0, Math.trunc(Number(info.gift3000_vouchers) || 0));
        const badge = held > 0 ? `持有 ${held} 个` : '可购买';
        if (Boolean(info.gift3000_week)) {
            return { badge: held > 0 ? `持有 ${held} 个` : '本周已购', badge_class: held > 0 ? 'ok' : 'no', tag: '消耗品', action: '本周已购', disabled: true, buy_class: '' };
        }
        if (coin >= good.price) {
            return { badge, badge_class: 'ok', tag: '消耗品', action: '购买', disabled: false, buy_class: 'buy-gold' };
        }
        return { badge: held > 0 ? `持有 ${held} 个` : '棋币不足', badge_class: 'no', tag: '消耗品', action: '棋币不足', disabled: true, buy_class: '' };
    }
    // 消耗品可重复购买，徽标展示当前持有数量
    if (consume) {
        const tickets = Math.max(0, Math.trunc(Number(info.tickets) || 0));
        if (coin >= good.price) {
            return { badge: tickets > 0 ? `持有 ${tickets} 张` : '可购买', badge_class: 'ok', tag: '消耗品', action: '购买', disabled: false, buy_class: 'buy-gold' };
        }
        return { badge: tickets > 0 ? `持有 ${tickets} 张` : '棋币不足', badge_class: 'no', tag: '消耗品', action: '棋币不足', disabled: true, buy_class: '' };
    }
    if (skin ? shop_skin_list().includes(good.id) : level >= good.level) {
        return { badge: '已拥有', badge_class: 'ok', tag: skin ? '外观' : `当前 Lv.${level}`, action: '已拥有', disabled: true, buy_class: '' };
    }
    if (coin >= good.price) {
        return { badge: '可兑换', badge_class: 'ok', tag: skin ? '外观' : '权限', action: skin ? '购买' : '兑换', disabled: false, buy_class: 'buy-gold' };
    }
    return { badge: '棋币不足', badge_class: 'no', tag: skin ? '外观' : '权限', action: '棋币不足', disabled: true, buy_class: '' };
};

/**
 * @description: 渲染商品（权限码可兑换；皮肤购买后仅自己可见，本账号生效）
 * @param {boolean} locked 未登录时只展示商品，不允许兑换
 * @return {void}
 */
const shop_render_goods = (locked = false) => {
    if (shop_consume) {
        // 带 min_level 的消耗品（如 3000 好友赠礼）仅对足够权限等级的已登录用户可见
        const level = Math.max(1, Math.trunc(Number(shop_info && shop_info.level) || 1));
        const visible = SHOP_CONSUME.filter((good) => !good.min_level || (!locked && level >= good.min_level));
        shop_consume.innerHTML = visible.map((good) => shop_good_html(good, shop_good_state(good, locked))).join('');
    }

    if (shop_pass) {
        shop_pass.innerHTML = SHOP_PASS.map((good) => shop_good_html(good, shop_good_state(good, locked))).join('');
    }

    if (shop_style) {
        shop_style.innerHTML = SHOP_STYLE.map((good) => shop_good_html(good, shop_good_state(good, locked))).join('');
    }
};

/**
 * @description: 按 id 查找商品定义
 * @param {string} id
 * @return {Object | undefined}
 */
const shop_good_find = (id) => SHOP_CONSUME.concat(SHOP_PASS, SHOP_STYLE).find((good) => good.id === id);

/**
 * @description: 打开商品说明弹窗
 * @param {string} id
 * @return {void}
 */
const shop_dialog_open = (id) => {
    if (!shop_dialog || !shop_dialog_body) return;
    const good = shop_good_find(id);
    if (!good) return;

    const opts = shop_good_state(good, !shop_token || !shop_info);
    const coin_icon = window.WalletUI ? window.WalletUI.coin_svg(18) : '';
    // 弹窗内按钮为二次确认：未拥有时明确标注「确认购买 / 确认兑换」
    const confirm_action = opts.disabled ? opts.action : (opts.action === '兑换' ? '确认兑换' : '确认购买');

    shop_dialog_item = id;
    shop_dialog_body.innerHTML = `
<div class='good-detail'>
    <div class='good-detail-art'>
        ${good.art}
        <span class='good-badge ${opts.badge_class}'>${opts.badge}</span>
    </div>
    <div class='good-detail-head'>
        <div class='good-detail-name'>${good.name}</div>
        <div class='good-detail-price'>${coin_icon}${good.price}</div>
    </div>
    <div class='good-detail-desc'>${good.desc}</div>
    <div class='good-detail-note'>${SHOP_NOTES[good.id] || ''}</div>
    <div class='good-detail-foot'>
        <button type='button' class='good-buy ${opts.buy_class}' ${opts.disabled ? 'disabled' : ''}>${confirm_action}</button>
    </div>
</div>`;

    if ('label' in shop_dialog) shop_dialog.label = good.name;
    shop_dialog.classList.remove('d-none');
    // 自定义元素尚未升级完成时，等 sl-dialog 定义后再弹出
    if (typeof shop_dialog.show === 'function') shop_dialog.show();
    else customElements.whenDefined('sl-dialog').then(() => shop_dialog.show());
};

/**
 * @description: 渲染未登录 / 加载失败时的占位提示
 * @param {string} title
 * @param {string} tip
 * @return {void}
 */
const shop_render_placeholder = (title, tip) => {
    if (!shop_wallet) return;
    if (window.WalletUI) window.WalletUI.ensure_style();
    shop_wallet.innerHTML = `
<div class='wallet-card'>
    <div class='wallet-card-exp'>
        <div class='wallet-card-exp-main'>
            <div class='wallet-card-exp-title'><b>${title}</b></div>
            <div class='wallet-card-exp-sub'>${tip}</div>
        </div>
    </div>
</div>`;
};

/**
 * @description: 拉取账号经济数据并刷新商品状态
 * @return {Promise<void>}
 */
const shop_refresh = async () => {
    let info = null;
    try {
        info = await window.http_user_info(shop_token);
    } catch (_) {
        info = null;
    }

    if (!info) {
        shop_info = null;
        shop_render_placeholder('数据加载失败', '请刷新页面重试');
        shop_render_goods(true);
        return;
    }

    shop_info = info;
    // 本账号已购皮肤写入本机缓存，对局画布据此替换双方棋子、草与棋盘（仅自己可见）
    shop_skin_sync();
    // 购买 / 拥有装扮后解锁对应成就
    shop_achievement_sync();
    // 主题按最新已购状态刷新，购买后商店页立即换肤
    if (Skins) Skins.apply_theme();
    // 商店页面不展示经验进度，仅展示等级与棋币余额
    if (window.WalletUI) window.WalletUI.render_panel(shop_wallet, info, { detail: false });

    const coin = Math.max(0, Math.trunc(Number(info.coin) || 0));
    const level = Math.max(1, Math.trunc(Number(info.level) || 1));
    if (shop_subtitle) shop_subtitle.textContent = `当前持有 ${coin} 枚棋币 · 权限等级 Lv.${level}`;

    shop_render_goods(false);
};

/**
 * @description: 兑换商品
 * @param {string} item
 * @return {Promise<void>}
 */
const shop_buy = async (item) => {
    if (shop_busy || !shop_token || typeof window.http_shop_buy !== 'function') return;
    shop_busy = true;
    let result = null;
    try {
        result = await window.http_shop_buy(shop_token, item);
    } catch (_) {
        result = null;
    }
    shop_busy = false;

    const skin = SHOP_SKIN_IDS.includes(item);
    const consume = item === 'ticket' || item === 'gift500' || item === 'gift3000';

    if (!result) {
        toast.error('兑换失败，请稍后重试');
        return;
    }
    if (result.ok) {
        if (item === 'gift500') {
            const gifts = Math.max(0, Math.trunc(Number(result.gift_vouchers) || 0));
            toast.success(`购买成功，好友赠礼已存入背包（当前 ${gifts} 个）`);
        } else if (item === 'gift3000') {
            const gifts = Math.max(0, Math.trunc(Number(result.gift3000_vouchers) || 0));
            toast.success(`购买成功，3000 好友赠礼已存入背包（当前 ${gifts} 个）`);
        } else if (consume) {
            const tickets = Math.max(0, Math.trunc(Number(result.tickets) || 0));
            toast.success(`购买成功，投稿券已存入背包（当前 ${tickets} 张）`);
        } else toast.success(skin ? '购买成功，外观已在本账号生效' : '兑换成功，权限已解锁');
    }
    else if (result.reason === 'owned') toast.info(skin ? '你已拥有该外观' : '你已拥有该权限');
    else if (result.reason === 'daily') toast.info('好友赠礼每天限购 1 个，明天再来吧');
    else if (result.reason === 'weekly') toast.info('好友赠礼每周限购 1 个，下周再来吧');
    else if (result.reason === 'coin') toast.error('棋币不足，去对局赢取棋币吧');
    else toast.error('兑换失败，请稍后重试');

    await shop_refresh();

    // 弹窗打开时同步刷新其中的购买按钮状态
    if (shop_dialog_item && shop_dialog && shop_dialog.open) shop_dialog_open(shop_dialog_item);
};

/**
 * @description: 页面初始化
 * @return {Promise<void>}
 */
const shop_init = async () => {
    shop_render_rules();

    shop_token = typeof window.get_token === 'function' ? window.get_token() : null;
    if (!shop_token || typeof window.http_user_info !== 'function') {
        shop_render_placeholder('尚未登录', '返回主页登录后即可查看棋币与权限等级');
        shop_render_goods(true);
        return;
    }

    await shop_refresh();
};

/**
 * @description: 打开收益规则弹窗
 * @return {void}
 */
const shop_show_rules = () => {
    if (!shop_rules_dialog) return;
    shop_rules_dialog.classList.remove('d-none');
    // 自定义元素尚未升级完成时，等 sl-dialog 定义后再弹出
    if (typeof shop_rules_dialog.show === 'function') shop_rules_dialog.show();
    else customElements.whenDefined('sl-dialog').then(() => shop_rules_dialog.show());
};

if (shop_rules_button) shop_rules_button.addEventListener('click', shop_show_rules);

shop_bind(shop_consume);
shop_bind(shop_pass);
shop_bind(shop_style);

// 详情弹窗内的购买按钮
if (shop_dialog_body) {
    shop_dialog_body.addEventListener('click', (event) => {
        const button = event.target.closest('.good-buy');
        if (!button || button.disabled || !shop_dialog_item) return;
        shop_buy(shop_dialog_item);
    });
}

shop_init();
