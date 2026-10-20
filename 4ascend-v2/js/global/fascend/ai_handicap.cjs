/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 人机挑战难度取用弱化（简单 / 普通）
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const { STONE_ENUM, PLANT_ENUM, PLAYER_ENUM } = require('./enum.cjs');


/**
 * 只改写“取用”环节，不参与“选子”：MCTS 的搜索、先验与打分完全保持原样，
 * 仅在引擎返回落点之后、真正落子之前，按难度把落点替换成更弱的选择。
 *
 * - 入门（opt=0）：最低难度，同时叠加简单与普通两条规则（先占草改堵，未命中再卖血改打）。
 * - 简单（opt=1）：引擎若选了占草点，且盘面上存在玩家单独打点，则改为堵点。
 * - 普通（opt=2）：引擎若选了卖血点，则改为自己的打点；没有打点时才允许卖血。
 *
 * 熟练（3）/ 高级（4）/ 顶级（5）/ ???（6）不进入本模块，行为完全不变。
 */
class AiHandicap {
    /**
     * @param {{RulesRuntime: any}} deps
     */
    static create(deps) {
        if (!deps || !deps.RulesRuntime) throw new TypeError('AiHandicap 需要 RulesRuntime');
        return new AiHandicap(deps.RulesRuntime);
    }

    /**
     * @param {any} RulesRuntime
     */
    constructor(RulesRuntime) {
        this.RulesRuntime = RulesRuntime;
    }

    /**
     * 难度选项 → 取用弱化档位。
     * @param {string | number | null | undefined} option
     * @return {'dumb' | 'easy' | 'normal' | null}
     */
    static levelOf(option) {
        const value = String(option === null || option === undefined ? '' : option);
        if (value === '0') return 'dumb';
        if (value === '1') return 'easy';
        if (value === '2') return 'normal';
        return null;
    }

    /**
     * 按难度矫正引擎落点。返回 null 表示保持原落点。
     * @param {any} game 实时对局（非搜索副本）
     * @param {number} action 引擎返回的落点
     * @param {string | number} option 难度选项
     * @return {{action: number, level: string, reason: string, original: number, detail: object} | null}
     */
    adjust(game, action, option) {
        const level = AiHandicap.levelOf(option);
        if (!level) return null;
        if (!game || !game.board || !game.state) return null;
        if (!Number.isInteger(action)) return null;

        const legal = this.RulesRuntime.legalMoves(game);
        if (!legal.includes(action)) return null;

        const info = this.describe(game, action);
        if (level === 'easy') return this.weakenEasy(game, action, info, legal);
        if (level === 'dumb') return this.weakenDumb(game, action, info, legal);
        return this.weakenNormal(game, action, info, legal);
    }

    /**
     * 单个落点的规则属性。
     * @param {any} game
     * @param {number} action
     */
    describe(game, action) {
        const state = game.state;
        const board = game.board;
        const width = board.w;
        const x = action % width;
        const y = Math.floor(action / width);

        const selfStone = state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
        const foeStone = state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.WHITE : STONE_ENUM.BLACK;
        const foeAscendStone = state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.WHITE_ASCEND : STONE_ENUM.BLACK_ASCEND;

        const plant = board.get_plant(x, y);
        const selfPoints = board.get_ascend(x, y, selfStone);
        const foePoints = board.get_ascend(x, y, foeStone);

        const formsAscend = Boolean(selfPoints);
        const foeWouldAscend = Boolean(foePoints);

        return {
            action,
            x,
            y,
            selfStone,
            foeStone,
            /** 占草：落点本身带草 */
            landsOnPlant: plant === PLANT_ENUM.ONE || plant === PLANT_ENUM.TWO,
            /** 自身形成打 */
            formsAscend,
            selfPower: this.powerOf(selfPoints),
            /** 落在对手盘旋子（打）上 */
            landsOnFoeAscend: board.get_stone(x, y) === foeAscendStone,
            /** 卖血：落对手打点但自身不成打 */
            sellBlood: board.get_stone(x, y) === foeAscendStone && !formsAscend,
            /** 玩家单独打点：仅对手在此落子能成打，己方不成 */
            blockPoint: foeWouldAscend && !formsAscend,
            foePower: this.powerOf(foePoints),
        };
    }

    /**
     * @param {import('./pos.cjs').Pos[] | null} points
     */
    powerOf(points) {
        if (!points || !points.length) return { M: 0, N: 0, MN: 0 };
        let M = 0;
        let N = 0;
        points.forEach((pos) => {
            M += 1;
            if (pos.plant === PLANT_ENUM.ONE) N += 1;
            else if (pos.plant === PLANT_ENUM.TWO) N += 2;
        });
        return { M, N, MN: M + N };
    }

    /**
     * 遍历全部合法点的属性。
     * @param {any} game
     * @param {number[]} legal
     */
    scan(game, legal) {
        return legal.map((action) => this.describe(game, action));
    }

    /**
     * 确定性地取最强候选（先比 M+N，再比 M，最后比索引），避免随机选取。
     * @param {ReturnType<AiHandicap['describe']>[]} moves
     */
    pickStrongest(moves) {
        if (!moves.length) return null;
        return [...moves].sort((a, b) =>
            (b.selfPower.MN - a.selfPower.MN)
            || (b.selfPower.M - a.selfPower.M)
            || (a.action - b.action)
        )[0];
    }

    /**
     * 入门难度（最低）：同时叠加简单与普通两条弱化规则。
     * 先按简单规则处理占草点（改为堵玩家打点），未命中时再按普通规则处理卖血点（改自己打点）。
     * @param {any} game
     * @param {number} action
     * @param {ReturnType<AiHandicap['describe']>} info
     * @param {number[]} legal
     */
    weakenDumb(game, action, info, legal) {
        const rewritten = this.weakenEasy(game, action, info, legal)
            || this.weakenNormal(game, action, info, legal);
        if (!rewritten) return null;
        rewritten.level = 'dumb';
        return rewritten;
    }

    /**
     * 简单难度：不优先占草，改为堵住玩家的打。
     * 仅在引擎原本取了占草点时改写，其余选点保持原样。
     * @param {any} game
     * @param {number} action
     * @param {ReturnType<AiHandicap['describe']>} info
     * @param {number[]} legal
     */
    weakenEasy(game, action, info, legal) {
        if (!info.landsOnPlant) return null;
        if (info.blockPoint) return null;

        const blocks = this.scan(game, legal).filter((move) => move.blockPoint);
        if (!blocks.length) return null;

        const chosen = this.pickStrongest(blocks);
        if (!chosen || chosen.action === action) return null;

        return {
            action: chosen.action,
            level: 'easy',
            reason: 'easy-block-player-ascend',
            original: action,
            detail: {
                original: { x: info.x, y: info.y },
                chosen: { x: chosen.x, y: chosen.y },
                foePower: chosen.foePower,
            },
        };
    }

    /**
     * 普通难度：任何情况下都不卖血。
     * 把原本的卖血点改到自己任意打点；只有确实没有打点时才允许卖血。
     * @param {any} game
     * @param {number} action
     * @param {ReturnType<AiHandicap['describe']>} info
     * @param {number[]} legal
     */
    weakenNormal(game, action, info, legal) {
        if (!info.sellBlood) return null;

        const builds = this.scan(game, legal).filter((move) => move.formsAscend);
        if (!builds.length) return null;

        const chosen = this.pickStrongest(builds);
        if (!chosen || chosen.action === action) return null;

        return {
            action: chosen.action,
            level: 'normal',
            reason: 'normal-no-sell-blood',
            original: action,
            detail: {
                original: { x: info.x, y: info.y },
                chosen: { x: chosen.x, y: chosen.y },
                selfPower: chosen.selfPower,
            },
        };
    }
}


export { AiHandicap };
