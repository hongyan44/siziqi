/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 残局 AI 防自杀 / 斩杀落子矫正
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const { STONE_ENUM, PLANT_ENUM, PLAYER_ENUM, ASCEND_ENUM } = require('./enum.cjs');
const { ATK } = require('./utils.cjs');


/** @typedef {import('./runtime.cjs').RulesRuntime} RulesRuntimeType */

/**
 * 残局挑战底层战术：遍历全部合法落点，按防自杀 / 斩杀规则改写 AI 落子。
 * 不依赖 MCTS 历史；可在无落子历史上直接对 snapshot 求最优矫正点。
 */
class EndgameTactics {
    /**
     * @param {{RulesRuntime: any}} deps
     */
    static create(deps) {
        if (!deps || !deps.RulesRuntime) throw new TypeError('EndgameTactics 需要 RulesRuntime');
        return new EndgameTactics(deps.RulesRuntime);
    }

    /**
     * @param {any} RulesRuntime
     */
    constructor(RulesRuntime) {
        this.RulesRuntime = RulesRuntime;
    }

    /**
     * @param {any} game
     * @return {{action: number, x: number, y: number, reason: string, detail: object} | null}
     */
    chooseMove(game) {
        const legal = this.RulesRuntime.legalMoves(game);
        if (!legal.length) return null;

        const analysis = this.analyzeBoard(game, legal);
        const corrected = this.pickByLogic(game, analysis);
        return corrected;
    }

    /**
     * 在候选动作中优先采用战术矫正；无命中时返回 null，由上层回退到树搜索。
     * @param {any} game
     * @param {number[]} [candidateActions]
     */
    correctMove(game, candidateActions = null) {
        const legal = candidateActions && candidateActions.length
            ? candidateActions.filter((action) => this.RulesRuntime.legalMoves(game).includes(action))
            : this.RulesRuntime.legalMoves(game);
        if (!legal.length) return null;
        const analysis = this.analyzeBoard(game, legal);
        return this.pickByLogic(game, analysis);
    }

    /**
     * 是否进入“斩杀线残局”：任意一方血量 <= 3。
     * @param {any} game
     * @return {boolean}
     */
    static isKillZone(game) {
        if (!game || !game.state || !Array.isArray(game.state.hp)) return false;
        const blackHp = Number(game.state.hp[0]);
        const whiteHp = Number(game.state.hp[1]);
        return blackHp <= 3 || whiteHp <= 3;
    }

    /**
     * 人机挑战 ??? 难度兜底：只返回斩杀 / 防自杀关键落点。
     * 普通构建、堵点不覆盖 MCTS，避免影响常规选点。
     * @param {any} game
     * @return {{action: number, x: number, y: number, reason: string, detail: object} | null}
     */
    safetyNet(game) {
        if (!EndgameTactics.isKillZone(game)) return null;
        const move = this.chooseMove(game);
        if (!move) return null;
        const criticalReasons = new Set([
            'kill',
            'anti-suicide-must-ascend',
            'anti-suicide-stronger-ascend',
            'anti-suicide-fallback',
            'answer-ascend',
            'answer-stronger-ascend',
        ]);
        if (!criticalReasons.has(move.reason)) return null;
        return move;
    }

    /**
     * @param {any} game
     * @param {number[]} legal
     */
    analyzeBoard(game, legal) {
        const state = game.state;
        const board = game.board;
        const selfPlayer = state.turn_player;
        const foePlayer = selfPlayer === PLAYER_ENUM.BLACK ? PLAYER_ENUM.WHITE : PLAYER_ENUM.BLACK;
        const selfIndex = selfPlayer === PLAYER_ENUM.BLACK ? 0 : 1;
        const foeIndex = selfIndex ^ 1;
        const selfStone = selfPlayer === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
        const foeStone = selfPlayer === PLAYER_ENUM.BLACK ? STONE_ENUM.WHITE : STONE_ENUM.BLACK;
        const foeAscendStone = selfPlayer === PLAYER_ENUM.BLACK ? STONE_ENUM.WHITE_ASCEND : STONE_ENUM.BLACK_ASCEND;

        // X = 玩家血量，Y = AI 血量（相对当前行棋方：self=Y, foe=X）
        const X = state.hp[foeIndex];
        const Y = state.hp[selfIndex];

        const pendingThreat = state.ascend_status === ASCEND_ENUM.START
            ? this.collectAscendPower(board, foeAscendStone)
            : null;

        const mustAnswer = Boolean(
            pendingThreat
            && pendingThreat.M >= 1
            && (
                pendingThreat.M >= 7 // 核弹不可卖血
                || pendingThreat.M >= Y + 1 // 卖血仍致死：伤害 M-1 >= Y
            )
        );

        const moves = legal.map((action) => this.evaluateAction(game, action, {
            selfStone,
            foeStone,
            foeAscendStone,
            selfIndex,
            foeIndex,
            X,
            Y,
            pendingThreat,
            mustAnswer,
        }));

        return { X, Y, pendingThreat, mustAnswer, selfStone, foeStone, moves };
    }

    /**
     * @param {any} board
     * @param {symbol} ascendStone
     */
    collectAscendPower(board, ascendStone) {
        let M = 0;
        let N = 0;
        const points = [];
        board.data.forEach((pos) => {
            if (pos.stone !== ascendStone) return;
            M += 1;
            if (pos.plant === PLANT_ENUM.ONE) N += 1;
            else if (pos.plant === PLANT_ENUM.TWO) N += 2;
            points.push(pos);
        });
        return { M, N, MN: M + N, points };
    }

    /**
     * @param {import('./pos.cjs').Pos[] | null} points
     */
    powerOf(points) {
        if (!points || !points.length) return { M: 0, N: 0, MN: 0, powers: [] };
        let M = 0;
        let N = 0;
        const powers = [];
        points.forEach((pos) => {
            M += 1;
            let power = 1;
            if (pos.plant === PLANT_ENUM.ONE) {
                N += 1;
                power += 1;
            } else if (pos.plant === PLANT_ENUM.TWO) {
                N += 2;
                power += 2;
            }
            powers.push(power);
        });
        return { M, N, MN: M + N, powers };
    }

    /**
     * 抵消后双方剩余棋子数 → 伤害（与 GameNormal.ed_as_2 一致）。
     * @param {number[]} selfPowers
     * @param {number[]} foePowers
     * @return {{damageToSelf: number, damageToFoe: number}}
     */
    cancelDamage(selfPowers, foePowers) {
        const a = [...selfPowers];
        const b = [...foePowers];
        ATK.parse(a, b);
        // pending_damage = [whiteRemaining, blackRemaining] 在引擎里按颜色写入；
        // 这里用“己方/对方”语义：对方剩余 = 伤己，己方剩余 = 伤敌。
        return {
            damageToSelf: b.length,
            damageToFoe: a.length,
        };
    }

    /**
     * @param {any} game
     * @param {number} action
     * @param {object} ctx
     */
    evaluateAction(game, action, ctx) {
        const x = action % game.board.w;
        const y = Math.floor(action / game.board.w);
        const beforeStone = game.board.get_stone(x, y);
        const landsOnFoeAscend = beforeStone === ctx.foeAscendStone;
        const ascendPoints = game.board.get_ascend(x, y, ctx.selfStone);
        const formsAscend = Boolean(ascendPoints);
        const selfPower = this.powerOf(ascendPoints);

        // 敌方单独打点：仅敌方在此落子能成 ASCEND，己方不成
        const foeWouldAscend = Boolean(game.board.get_ascend(x, y, ctx.foeStone));
        const blockPoint = foeWouldAscend && !formsAscend;

        let damageToFoeIfUnanswered = 0;
        let sellBloodDamageToFoe = 0;
        let isNuke = false;
        let killsByUnanswered = false;
        let killsBySellBloodLine = false;
        let killsAfterBestCancel = false;
        let suicideIfNoAscend = false;
        let answersThreat = false;
        let beatsThreat = false;
        let simulatedWinner = null;
        let simulatedDamageToFoe = 0;
        let simulatedDamageToSelf = 0;
        let suicidalAscend = false;

        if (formsAscend) {
            isNuke = selfPower.M >= 7;
            damageToFoeIfUnanswered = selfPower.M;
            sellBloodDamageToFoe = isNuke ? selfPower.M : Math.max(0, selfPower.M - 1);
            // 斩杀线 1：对手血量 <= 拿起子数-1（核弹则按满伤）时，对方即使卖血/无法有效应手也会死
            killsBySellBloodLine = ctx.X <= sellBloodDamageToFoe;
            killsByUnanswered = ctx.X <= damageToFoeIfUnanswered;
        }

        if (ctx.pendingThreat) {
            // 防自杀：对方已形成 ASCEND 时，在威胁点卖血且自身不成 ASCEND
            if (landsOnFoeAscend && !formsAscend) {
                const sellDamage = ctx.pendingThreat.M >= 7
                    ? ctx.pendingThreat.M
                    : Math.max(0, ctx.pendingThreat.M - 1);
                suicideIfNoAscend = sellDamage >= ctx.Y || ctx.mustAnswer;
            }
            if (formsAscend) {
                answersThreat = true;
                beatsThreat = selfPower.MN > ctx.pendingThreat.MN;
                const cancel = this.cancelDamage(selfPower.powers, this.powersFromThreat(ctx.pendingThreat));
                simulatedDamageToSelf = cancel.damageToSelf;
                simulatedDamageToFoe = cancel.damageToFoe;
                // 反击拿起对方一子：本地用抵消近似；精确胜负交由完整模拟
            }
        }

        // 完整规则模拟：确认斩杀 / 自杀 / 胜负
        const forked = this.RulesRuntime.fork(game);
        const result = this.RulesRuntime.applyMove(forked, action, { collectEvents: true });
        if (result.legal) {
            simulatedWinner = result.winner || null;
            const combat = (result.events || []).find((event) => event.type === 'combat');
            if (combat) {
                const hpBefore = combat.hpBefore || [...game.state.hp];
                const hpAfter = combat.hpAfter || [...forked.state.hp];
                simulatedDamageToSelf = Math.max(0, hpBefore[ctx.selfIndex] - hpAfter[ctx.selfIndex]);
                simulatedDamageToFoe = Math.max(0, hpBefore[ctx.foeIndex] - hpAfter[ctx.foeIndex]);
            } else if (formsAscend && !ctx.pendingThreat) {
                // 仅发起 ASCEND：伤害挂起，对手下回合才结算；斩杀看理论伤害
                simulatedDamageToFoe = damageToFoeIfUnanswered;
            }

            // 斩杀线 2：与对手最大可成 ASCEND 抵消后仍能使对手归零
            if (formsAscend && !ctx.pendingThreat) {
                const foeBest = this.bestReplyAscend(forked, ctx.foeStone, ctx.foeAscendStone === STONE_ENUM.BLACK_ASCEND ? STONE_ENUM.WHITE_ASCEND : STONE_ENUM.BLACK_ASCEND);
                if (!foeBest) {
                    killsAfterBestCancel = killsByUnanswered || killsBySellBloodLine;
                    // 对手无 ASCEND 可应，只能卖血：己方拿 M-1 伤敌，己方不会被反杀
                    suicidalAscend = false;
                } else {
                    const cancel = this.cancelDamage(selfPower.powers, foeBest.powers);
                    // 吃下对方最强反击后己方掉血 >= Y → 自杀式斩杀，禁止
                    const selfDiesOnReply = cancel.damageToSelf >= ctx.Y;
                    suicidalAscend = selfDiesOnReply;
                    killsAfterBestCancel = !selfDiesOnReply && cancel.damageToFoe >= ctx.X;
                }
            } else if (formsAscend && ctx.pendingThreat) {
                killsAfterBestCancel = simulatedDamageToFoe >= ctx.X
                    || (simulatedWinner && (
                        (ctx.selfIndex === 0 && simulatedWinner === PLAYER_ENUM.BLACK)
                        || (ctx.selfIndex === 1 && simulatedWinner === PLAYER_ENUM.WHITE)
                    ));
                suicidalAscend = simulatedDamageToSelf >= ctx.Y;
            }
        }

        const winsNow = Boolean(
            simulatedWinner && (
                (ctx.selfIndex === 0 && simulatedWinner === PLAYER_ENUM.BLACK)
                || (ctx.selfIndex === 1 && simulatedWinner === PLAYER_ENUM.WHITE)
            )
        );
        const losesNow = Boolean(
            simulatedWinner && (
                (ctx.selfIndex === 0 && simulatedWinner === PLAYER_ENUM.WHITE)
                || (ctx.selfIndex === 1 && simulatedWinner === PLAYER_ENUM.BLACK)
            )
        );

        // 斩杀成立 = 非自杀(吃反击不死) && 确能做到对方归零
        const isKill = !suicidalAscend && (winsNow || killsAfterBestCancel);

        return {
            action,
            x,
            y,
            legal: result.legal,
            formsAscend,
            landsOnFoeAscend,
            blockPoint,
            selfPower,
            isNuke,
            answersThreat,
            beatsThreat,
            suicideIfNoAscend,
            suicidalAscend,
            isKill,
            winsNow,
            losesNow,
            killsBySellBloodLine,
            killsAfterBestCancel,
            simulatedDamageToFoe,
            simulatedDamageToSelf,
            score: 0,
        };
    }

    /**
     * @param {object} threat
     */
    powersFromThreat(threat) {
        return (threat.points || []).map((pos) => {
            if (pos.plant === PLANT_ENUM.ONE) return 2;
            if (pos.plant === PLANT_ENUM.TWO) return 3;
            return 1;
        });
    }

    /**
     * 在当前（己方刚打完）局面上，搜索对手能形成的最大 M+N ASCEND。
     * @param {any} gameAfterSelfAscend
     * @param {symbol} foeStone
     * @param {symbol} selfAscendStone
     */
    bestReplyAscend(gameAfterSelfAscend, foeStone, selfAscendStone) {
        const legal = this.RulesRuntime.legalMoves(gameAfterSelfAscend);
        let best = null;
        legal.forEach((action) => {
            const x = action % gameAfterSelfAscend.board.w;
            const y = Math.floor(action / gameAfterSelfAscend.board.w);
            const points = gameAfterSelfAscend.board.get_ascend(x, y, foeStone);
            if (!points) return;
            // 反击：落在己方盘旋子上时，该子归对手并参与抵消——get_ascend 已按落子后颜色计
            const power = this.powerOf(points);
            // 若点位原是 selfAscend，反击多拿一子已包含在落子后的连续判定里
            if (!best || power.MN > best.MN || (power.MN === best.MN && power.M > best.M)) {
                best = { ...power, action, x, y, onCounter: gameAfterSelfAscend.board.get_stone(x, y) === selfAscendStone || points.some(() => false) };
            }
        });
        return best;
    }

    /**
     * @param {any} game
     * @param {ReturnType<EndgameTactics['analyzeBoard']>} analysis
     */
    pickByLogic(game, analysis) {
        const moves = analysis.moves.filter((move) => move.legal);
        if (!moves.length) return null;

        const prefer = (list, compare) => {
            if (!list.length) return null;
            return [...list].sort(compare)[0];
        };
        const byMNDesc = (a, b) => {
            const mn = (b.selfPower.MN - a.selfPower.MN)
                || (b.selfPower.M - a.selfPower.M)
                || (b.simulatedDamageToFoe - a.simulatedDamageToFoe);
            if (mn) return mn;
            return a.action - b.action;
        };
        const byKillDesc = (a, b) => {
            if (a.winsNow !== b.winsNow) return a.winsNow ? -1 : 1;
            if (a.killsAfterBestCancel !== b.killsAfterBestCancel) return a.killsAfterBestCancel ? -1 : 1;
            return byMNDesc(a, b);
        };

        // —— 防自杀逻辑 ——
        // 仅当对方 M >= Y+1（或核弹）时强制 ASCEND 应手，并优先更大 M+N。
        if (analysis.pendingThreat && analysis.pendingThreat.M > 0 && analysis.mustAnswer) {
            const answers = moves.filter((move) => move.formsAscend && !move.losesNow);
            if (answers.length) {
                const stronger = answers.filter((move) => move.beatsThreat);
                const chosen = prefer(stronger.length ? stronger : answers, byMNDesc);
                return this.toResult(chosen, stronger.length ? 'anti-suicide-stronger-ascend' : 'anti-suicide-must-ascend', analysis);
            }
            // 无 ASCEND 可应时，尽量避免立刻自杀的点
            const safe = moves.filter((move) => !move.suicideIfNoAscend && !move.losesNow);
            const chosen = prefer(safe.length ? safe : moves, (a, b) => (a.simulatedDamageToSelf - b.simulatedDamageToSelf) || (b.simulatedDamageToFoe - a.simulatedDamageToFoe) || (a.action - b.action));
            return this.toResult(chosen, 'anti-suicide-fallback', analysis);
        }

        // 对方已打但允许卖血时：若本方可形成更大 ASCEND，仍优先用于抵消；
        // 但排除会被反杀的自杀式应打（此时宁可卖血生存），防自杀始终生效
        if (analysis.pendingThreat && analysis.pendingThreat.M > 0) {
            const answers = moves.filter((move) => move.formsAscend && !move.losesNow && !move.suicidalAscend);
            const stronger = answers.filter((move) => move.beatsThreat);
            if (stronger.length) {
                return this.toResult(prefer(stronger, byMNDesc), 'anti-suicide-stronger-ascend', analysis);
            }
            if (answers.length) {
                return this.toResult(prefer(answers, byMNDesc), 'answer-ascend', analysis);
            }
        }

        // —— 斩杀逻辑 ——
        // winsNow 是单步引擎模拟判胜，未必算全对方下回合反击（草反/更大打），
        // 故 winsNow 也须非自杀才允许走斩杀
        const kills = moves.filter((move) => move.isKill || (move.winsNow && !move.suicidalAscend));
        if (kills.length) {
            const chosen = prefer(kills, byKillDesc);
            return this.toResult(chosen, 'kill', analysis);
        }

        // —— 堵点逻辑已停用（2026-09-29）——
        // 用户决定改用残局专用模型，纯逻辑的"堵玩家单独打点"判断被注释，交由 MCTS/上层接管。
        // const blocks = moves.filter((move) => move.blockPoint);
        // if (blocks.length) {
        //     const chosen = prefer(blocks, (a, b) => a.action - b.action);
        //     return this.toResult(chosen, 'block-player-ascend', analysis);
        // }

        // —— 构建打逻辑已停用（2026-09-29）——
        // 用户决定改用残局专用模型，纯逻辑的"构建自己 ASCEND"判断被注释，交由 MCTS/上层接管。
        // const builds = moves.filter((move) => move.formsAscend && !move.suicidalAscend);
        // if (builds.length) {
        //     const chosen = prefer(builds, byMNDesc);
        //     return this.toResult(chosen, 'build-ascend', analysis);
        // }

        return null;
    }

    /**
     * @param {object} move
     * @param {string} reason
     * @param {object} analysis
     */
    toResult(move, reason, analysis) {
        if (!move) return null;
        return {
            action: move.action,
            x: move.x,
            y: move.y,
            reason,
            detail: {
                X: analysis.X,
                Y: analysis.Y,
                mustAnswer: analysis.mustAnswer,
                pendingThreat: analysis.pendingThreat
                    ? { M: analysis.pendingThreat.M, N: analysis.pendingThreat.N, MN: analysis.pendingThreat.MN }
                    : null,
                selfPower: move.selfPower,
                isKill: move.isKill,
                beatsThreat: move.beatsThreat,
            },
            engine: 'endgame-tactics',
        };
    }
}


export { EndgameTactics };


/* ============================================================================
 * 【已停用】2026-09-29 主动核弹对做逻辑
 * ----------------------------------------------------------------------------
 * 停用原因：实测发现纯逻辑判断在复杂对局中仍误判（例：7,5 后 AI 仍走 7,6 堵），
 * 用户决定改用残局专用模型替代。下面保留本轮实现供后续参考。
 *
 * 涉及模块：
 *   1. surveyNukes            核普查（三态分类：主动核 / 活核 / 死核）
 *   2. evaluateNukeImpact     精确引爆判定（枚举对手全部应手，含拒绝抵消）
 *   3. pickByLogic L3         核应急（双威胁对攻 / 主动核对爆 / 活核安静堵）
 *   4. pickByLogic L4         活核扩建（沿轴延长线选安静子）
 *   5. isOnNukeAxis           判断落点是否在核轴延长线上
 *   6. estimateExpansionValue 扩建估值（核威力 - 距离）
 *   7. pickBestInDespair      必败时最优着法（保留威胁 / 最大化对手需走对步数）
 *
 * 注：恢复时需同步在 analyzeBoard 调用 surveyNukes、在 pickByLogic 内插入 L3/L4
 * 分支、在 safetyNet 的 criticalReasons 中加入 nuke-* 系列 reason。
 * ============================================================================

// ---------- 1) 核普查 surveyNukes ----------
surveyNukes(game, selfStone, foeStone) {
    const board = game.board;
    const selfAscendStone = selfStone === STONE_ENUM.BLACK ? STONE_ENUM.BLACK_ASCEND : STONE_ENUM.WHITE_ASCEND;
    const foeAscendStone = foeStone === STONE_ENUM.BLACK ? STONE_ENUM.BLACK_ASCEND : STONE_ENUM.WHITE_ASCEND;
    const nukes = { self: [], foe: [] };
    for (let x = 0; x < board.w; x++) {
        for (let y = 0; y < board.h; y++) {
            const stoneAt = board.get_stone(x, y);
            const action = y * board.w + x;
            const selfCanPlay = stoneAt === STONE_ENUM.NONE || stoneAt === foeAscendStone;
            const foeCanPlay = stoneAt === STONE_ENUM.NONE || stoneAt === selfAscendStone;
            // 我方核（可落子点）
            if (selfCanPlay) {
                const asc = board.get_ascend(x, y, selfStone);
                if (asc) {
                    const p = this.powerOf(asc);
                    if (p.M >= 7) {
                        const foeAsc = board.get_ascend(x, y, foeStone);
                        nukes.self.push({
                            x, y, action,
                            M: p.M, N: p.N, MN: p.MN, powers: p.powers,
                            isProactive: Boolean(foeAsc),
                            foePower: foeAsc ? this.powerOf(foeAsc) : null,
                            blockedBy: null,
                        });
                    }
                }
            }
            // 我方死核（对方普通子堵）
            if (!selfCanPlay && stoneAt === foeStone) {
                board.set_stone(x, y, STONE_ENUM.NONE);
                const asc = board.get_ascend(x, y, selfStone);
                if (asc) {
                    const p = this.powerOf(asc);
                    if (p.M >= 7) {
                        nukes.self.push({
                            x, y, action,
                            M: p.M, N: p.N, MN: p.MN, powers: p.powers,
                            isProactive: false, foePower: null,
                            blockedBy: { x, y, action }, isDead: true,
                        });
                    }
                }
                board.set_stone(x, y, foeStone);
            }
            // 对方核
            if (foeCanPlay) {
                const asc = board.get_ascend(x, y, foeStone);
                if (asc) {
                    const p = this.powerOf(asc);
                    if (p.M >= 7) {
                        const selfAsc = board.get_ascend(x, y, selfStone);
                        nukes.foe.push({
                            x, y, action,
                            M: p.M, N: p.N, MN: p.MN, powers: p.powers,
                            isProactive: Boolean(selfAsc),
                            selfPower: selfAsc ? this.powerOf(selfAsc) : null,
                            blockedBy: null,
                        });
                    }
                }
            }
            // 对方死核
            if (!foeCanPlay && stoneAt === selfStone) {
                board.set_stone(x, y, STONE_ENUM.NONE);
                const asc = board.get_ascend(x, y, foeStone);
                if (asc) {
                    const p = this.powerOf(asc);
                    if (p.M >= 7) {
                        nukes.foe.push({
                            x, y, action,
                            M: p.M, N: p.N, MN: p.MN, powers: p.powers,
                            isProactive: false, selfPower: null,
                            blockedBy: { x, y, action }, isDead: true,
                        });
                    }
                }
                board.set_stone(x, y, selfStone);
            }
        }
    }
    return nukes;
}

// ---------- 2) 精确引爆判定 evaluateNukeImpact ----------
evaluateNukeImpact(game, action, ctx) {
    const forked = this.RulesRuntime.fork(game);
    const myResult = this.RulesRuntime.applyMove(forked, action, { collectEvents: true });
    if (!myResult.legal) return null;
    // 1. 已有 winner
    if (myResult.winner) {
        const iWin = (ctx.selfIndex === 0 && myResult.winner === PLAYER_ENUM.BLACK)
                  || (ctx.selfIndex === 1 && myResult.winner === PLAYER_ENUM.WHITE);
        return {
            kills: iWin, suicide: !iWin,
            selfHpAfter: iWin ? ctx.Y : 0,
            foeHpAfter: iWin ? 0 : ctx.X,
        };
    }
    // 2. 已有 combat（响应情况，一次 applyMove 走完 START->END）
    const combat = (myResult.events || []).find((e) => e.type === 'combat');
    if (combat) {
        const selfHpAfter = combat.hpAfter[ctx.selfIndex];
        const foeHpAfter = combat.hpAfter[ctx.foeIndex];
        return {
            kills: foeHpAfter <= 0 && selfHpAfter > 0,
            suicide: selfHpAfter <= 0,
            selfHpAfter, foeHpAfter,
        };
    }
    // 3. 非 ASCEND 着法
    const hasAscend = (myResult.events || []).some((e) => e.type === 'ascend');
    if (!hasAscend) {
        return { kills: false, suicide: false, selfHpAfter: ctx.Y, foeHpAfter: ctx.X };
    }
    // 4. START：枚举对手全部应手（含拒绝抵消），取对我方最悲观
    const foeLegal = this.RulesRuntime.legalMoves(forked);
    if (foeLegal.length === 0) {
        return { kills: true, suicide: false, selfHpAfter: ctx.Y, foeHpAfter: 0 };
    }
    let worst = null;
    foeLegal.forEach((foeAction) => {
        const ff = this.RulesRuntime.fork(forked);
        const fr = this.RulesRuntime.applyMove(ff, foeAction, { collectEvents: true });
        if (!fr.legal) return;
        let selfHpAfter, foeHpAfter;
        if (fr.winner) {
            const iWin = (ctx.selfIndex === 0 && fr.winner === PLAYER_ENUM.BLACK)
                      || (ctx.selfIndex === 1 && fr.winner === PLAYER_ENUM.WHITE);
            selfHpAfter = iWin ? ctx.Y : 0;
            foeHpAfter = iWin ? 0 : ctx.X;
        } else {
            const fc = (fr.events || []).find((e) => e.type === 'combat');
            if (fc) {
                selfHpAfter = fc.hpAfter[ctx.selfIndex];
                foeHpAfter = fc.hpAfter[ctx.foeIndex];
            } else {
                selfHpAfter = ctx.Y;
                foeHpAfter = ctx.X;
            }
        }
        if (!worst ||
            selfHpAfter < worst.selfHpAfter ||
            (selfHpAfter === worst.selfHpAfter && foeHpAfter > worst.foeHpAfter)) {
            worst = { selfHpAfter, foeHpAfter };
        }
    });
    if (!worst) {
        return { kills: true, suicide: false, selfHpAfter: ctx.Y, foeHpAfter: 0 };
    }
    return {
        kills: worst.foeHpAfter <= 0 && worst.selfHpAfter > 0,
        suicide: worst.selfHpAfter <= 0,
        selfHpAfter: worst.selfHpAfter,
        foeHpAfter: worst.foeHpAfter,
    };
}

// ---------- 3) L3 核应急（插入 pickByLogic 斩杀之后） ----------
const foeKilling = (analysis.nukes && analysis.nukes.foe || []).filter((nuke) => {
    const foeGame = this.RulesRuntime.fork(game);
    foeGame.state.turn_player = analysis.foePlayer;
    const impact = this.evaluateNukeImpact(foeGame, nuke.action, {
        selfIndex: analysis.foeIndex,
        foeIndex: analysis.selfIndex,
        X: analysis.Y,
        Y: analysis.X,
    });
    return impact && impact.kills;
});
if (foeKilling.length > 0) {
    if (foeKilling.length >= 2) {
        // 双威胁：找同点双核对爆
        const counter = ws.filter((m) =>
            m.formsAscend &&
            analysis.nukes.self.some((n) => n.x === m.x && n.y === m.y) &&
            foeKilling.some((f) => f.x === m.x && f.y === m.y)
        );
        if (counter.length) {
            return this.toResult(prefer(counter, byMNDesc), 'nuke-counter-detonate', analysis);
        }
        // 否则最强核对攻赛跑
        const myNukes = ws.filter((m) => m.formsAscend && m.isNuke);
        if (myNukes.length) {
            return this.toResult(prefer(myNukes, byMNDesc), 'nuke-race', analysis);
        }
        return this.pickBestInDespair(ws, analysis);
    }
    // 单威胁
    const threat = foeKilling[0];
    if (threat.isProactive) {
        // 主动核不可堵，同点对爆
        const counter = ws.find((m) => m.x === threat.x && m.y === threat.y && m.formsAscend);
        if (counter) return this.toResult(counter, 'nuke-counter-detonate', analysis);
    } else {
        // 活核：先试安静堵，堵子成打则升级为主动核化对爆
        const block = ws.find((m) => m.x === threat.x && m.y === threat.y && !m.formsAscend);
        if (block) return this.toResult(block, 'nuke-block', analysis);
        const counter = ws.find((m) => m.x === threat.x && m.y === threat.y && m.formsAscend);
        if (counter) return this.toResult(counter, 'nuke-counter-detonate', analysis);
    }
}

// ---------- 4) L4 活核扩建（插入 L3 之后、堵点之前） ----------
const myNukes = analysis.nukes ? analysis.nukes.self : [];
if (myNukes.length > 0) {
    const expansion = ws.filter((m) => {
        if (m.formsAscend) return false; // 必须安静子
        return myNukes.some((nuke) => this.isOnNukeAxis(m, nuke, game.board, analysis.selfStone));
    });
    if (expansion.length) {
        const scored = expansion.map((m) => ({
            move: m,
            value: this.estimateExpansionValue(m, myNukes, game.board, analysis.selfStone),
        }));
        scored.sort((a, b) => b.value - a.value);
        return this.toResult(scored[0].move, 'nuke-expand', analysis);
    }
}

// ---------- 5) isOnNukeAxis ----------
isOnNukeAxis(move, nuke, board, stone) {
    const dx = move.x - nuke.x;
    const dy = move.y - nuke.y;
    if (dx === 0 && dy === 0) return false;
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [ddx, ddy] of dirs) {
        if (dx === 0 && ddx !== 0) continue;
        if (dy === 0 && ddy !== 0) continue;
        if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) continue;
        const stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
        const stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
        if (stepX !== ddx && stepX !== -ddx) continue;
        if (stepY !== ddy && stepY !== -ddy) continue;
        let sx = nuke.x + stepX;
        let sy = nuke.y + stepY;
        while (sx !== move.x || sy !== move.y) {
            const s = board.get_stone(sx, sy);
            if (s !== stone && s !== STONE_ENUM.NONE) return false;
            sx += stepX;
            sy += stepY;
        }
        return true;
    }
    return false;
}

// ---------- 6) estimateExpansionValue ----------
estimateExpansionValue(move, nukes, board, stone) {
    let best = 0;
    for (const nuke of nukes) {
        if (!this.isOnNukeAxis(move, nuke, board, stone)) continue;
        const dist = Math.max(Math.abs(move.x - nuke.x), Math.abs(move.y - nuke.y));
        best = Math.max(best, nuke.M * 10 - dist);
    }
    return best;
}

// ---------- 7) pickBestInDespair ----------
pickBestInDespair(moves, analysis) {
    const scored = moves.map((m) => ({
        move: m,
        score: m.foeDamage * 100 - m.selfDamage * 10 + (m.isNuke ? 50 : 0),
    }));
    scored.sort((a, b) => b.score - a.score);
    return this.toResult(scored[0].move, 'desperation-best', analysis);
}

============================================================================ */
