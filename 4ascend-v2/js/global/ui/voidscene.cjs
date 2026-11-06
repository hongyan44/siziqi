/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 虚空舰队主题的分页面动态星景（按页面类型挂载不同配色与构图）
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
import { theme_kind } from '../game/skin.cjs';


const SCENE_ID = 'void_scene_layer';
const SCENE_CLASS = 'void-scene';
const SCENE_FLAG = 'void-scene-on';

// 黑派主题：黑石大厅 + 顶灯日轮 + 金色浮尘，与虚空舰队星景互斥
const BLACK_SCENE_ID = 'black_scene_layer';
const BLACK_SCENE_CLASS = 'black-scene';
const BLACK_SCENE_FLAG = 'black-scene-on';
const BLACK_SCENE_HTML = `
    <div class="bs-hall"></div>
    <div class="bs-rays"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="bs-lamp"></div>
    <div class="bs-floor"></div>
    <div class="bs-dust"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="bs-vignette"></div>
`;

// 留青主题：白纸青晕 + 漂移纸带 + 飘落新叶 + 柔光，三个主题互斥
const LQ_SCENE_ID = 'lq_scene_layer';
const LQ_SCENE_CLASS = 'lq-scene';
const LQ_SCENE_FLAG = 'lq-scene-on';
const LQ_SCENE_HTML = `
    <div class="lq-paper"></div>
    <div class="lq-wash"></div>
    <div class="lq-ribbons"><i></i><i></i><i></i><i></i></div>
    <div class="lq-leaves"><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="lq-motes"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="lq-vignette"></div>
`;

// 场景 DOM 结构统一，具体显隐与配色由场景 class 控制
const SCENE_HTML = `
    <div class="vs-stars vs-stars-far"></div>
    <div class="vs-stars vs-stars-near"></div>
    <div class="vs-nebula"></div>
    <div class="vs-galaxy"></div>
    <div class="vs-orb">
        <div class="vs-ring"></div>
        <div class="vs-planet"></div>
    </div>
    <div class="vs-halo"></div>
    <div class="vs-core"></div>
    <div class="vs-moon vs-moon-a"></div>
    <div class="vs-moon vs-moon-b"></div>
    <div class="vs-meteors"><i></i><i></i><i></i></div>
    <div class="vs-frame"></div>
    <div class="vs-console"></div>
    <div class="vs-vignette"></div>
`;


/**
 * @description: 根据当前页面归入对应星景分组
 * @return {string} play / event / lore / honor / ''
 */
const scene_kind = () => {
    const path = (window.location.pathname || '').toLowerCase().replace(/\\/g, '/');

    // 对局准备：在线对局、排位、观战、本地对战、人机对战、回放
    if (/(\/local\/(ai|debug|replay)|\/online\/(friend|ranked|view|replayonline)|\/mod\/match-game)\.html$/.test(path)) return 'play';

    // 赛事主页与残局主页
    if (/(\/mod\/match|match-registration|match-rules|\/endgame\/(index|levels|submit))\.html$/.test(path)) return 'event';

    // 商店、剧情主页与使用教程 / 游戏规则文档
    if (/(\/user\/shop|\/docs\/(story|story-characters|tip|rule))\.html$/.test(path)) return 'lore';

    // 成就主页
    if (/\/user\/achievements\.html$/.test(path)) return 'honor';

    return '';
};


/**
 * @description: 移除指定 id 的场景层（主题切换时避免两套场景同时存在）
 * @param {string} id
 * @return {void}
 */
const scene_remove = (id) => {
    const old = document.getElementById(id);
    if (old) old.remove();
};

/**
 * @description: 按主题与当前页面挂载或移除场景层（虚空星景 / 黑派大厅 / 留青纸景互斥）
 * @return {void}
 */
const scene_apply = () => {
    if (!document.body) return;

    const kind = scene_kind();
    const theme = kind ? theme_kind() : '';

    // 三套场景互斥：先清掉不属于当前主题的层与标记
    if (theme !== 'void') scene_remove(SCENE_ID);
    if (theme !== 'black') scene_remove(BLACK_SCENE_ID);
    if (theme !== 'liuqing') scene_remove(LQ_SCENE_ID);
    document.documentElement.classList.toggle(SCENE_FLAG, theme === 'void');
    document.documentElement.classList.toggle(BLACK_SCENE_FLAG, theme === 'black');
    document.documentElement.classList.toggle(LQ_SCENE_FLAG, theme === 'liuqing');

    if (!theme) return;

    if (theme === 'liuqing') {
        let layer = document.getElementById(LQ_SCENE_ID);
        if (!layer) {
            layer = document.createElement('div');
            layer.id = LQ_SCENE_ID;
            layer.setAttribute('aria-hidden', 'true');
            layer.innerHTML = LQ_SCENE_HTML;
            document.body.insertBefore(layer, document.body.firstChild);
        }
        layer.className = `${LQ_SCENE_CLASS} ${LQ_SCENE_CLASS}-${kind}`;
        return;
    }

    if (theme === 'void') {
        let layer = document.getElementById(SCENE_ID);
        if (!layer) {
            layer = document.createElement('div');
            layer.id = SCENE_ID;
            layer.setAttribute('aria-hidden', 'true');
            layer.innerHTML = SCENE_HTML;
            document.body.insertBefore(layer, document.body.firstChild);
        }
        layer.className = `${SCENE_CLASS} ${SCENE_CLASS}-${kind}`;
        return;
    }

    // 黑派大厅场景
    let layer = document.getElementById(BLACK_SCENE_ID);
    if (!layer) {
        layer = document.createElement('div');
        layer.id = BLACK_SCENE_ID;
        layer.setAttribute('aria-hidden', 'true');
        layer.innerHTML = BLACK_SCENE_HTML;
        document.body.insertBefore(layer, document.body.firstChild);
    }
    layer.className = `${BLACK_SCENE_CLASS} ${BLACK_SCENE_CLASS}-${kind}`;
};


const scene_init = () => {
    document.addEventListener('void-theme-change', scene_apply);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scene_apply);
    else scene_apply();
};


const VoidScene = {
    apply: scene_apply,
    kind: scene_kind,
    theme: theme_kind,
};


scene_init();

export { VoidScene };
