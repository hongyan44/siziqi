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

        // 己方在此落子后横向/纵向/斜向能连成的最大子数：>=4 即“打”，===3 即“3连棋形”
        const selfAlign = game.board.get_align(x, y, ctx.selfStone)[0];

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
                } else {
                    const cancel = this.cancelDamage(selfPower.powers, foeBest.powers);
                    killsAfterBestCancel = cancel.damageToFoe >= ctx.X;
                }
            } else if (formsAscend && ctx.pendingThreat) {
                killsAfterBestCancel = simulatedDamageToFoe >= ctx.X
                    || (simulatedWinner && (
                        (ctx.selfIndex === 0 && simulatedWinner === PLAYER_ENUM.BLACK)
                        || (ctx.selfIndex === 1 && simulatedWinner === PLAYER_ENUM.WHITE)
                    ));
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

        const isKill = winsNow
            || killsAfterBestCancel
            || (formsAscend && !ctx.pendingThreat && (killsBySellBloodLine || killsByUnanswered)
                && this.opponentCannotSave(game, ctx, selfPower));

        return {
            action,
            x,
            y,
            legal: result.legal,
            formsAscend,
            selfAlign,
            landsOnFoeAscend,
            blockPoint,
            selfPower,
            isNuke,
            answersThreat,
            beatsThreat,
            suicideIfNoAscend,
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
     * 对手是否无法通过 ASCEND/反击避免斩杀（无应手或应手后仍死）。
     */
    opponentCannotSave(game, ctx, selfPower) {
        // 发起打后盘面处于 START；在 fork 上找对手最佳 ASCEND 应手
        // 若卖血线已覆盖，或核弹，或没有足够大的 ASCEND，则视为无法自救
        if (ctx.X <= (selfPower.M >= 7 ? selfPower.M : Math.max(0, selfPower.M - 1))) return true;
        return false;
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
     * 对方的“打”是否堵不住：玩家存在一个己方无法占用的打点（堵不住因子），
     * 或玩家存在 >=2 个独立打点（己方一回合只能堵住其中一个）。
     * 用于低血量时判断“纯堵徒劳”，从而改走进攻成打。
     * @param {any} game
     * @param {symbol} foeStone
     * @param {symbol} selfStone
     */
    foeHasUnstoppableAscend(game, foeStone, selfStone) {
        const selfAscend = selfStone === STONE_ENUM.BLACK ? STONE_ENUM.WHITE_ASCEND : STONE_ENUM.BLACK_ASCEND;
        const foeAscend = selfStone === STONE_ENUM.BLACK ? STONE_ENUM.BLACK_ASCEND : STONE_ENUM.WHITE_ASCEND;

        const cells = new Set();
        let hasUnstoppableCell = false;

        game.board.data.forEach((pos, index) => {
            const stone = pos.stone;
            // 玩家能否在此落子成打：空点，或落在己方打子（反击/卖血点）
            const foeCanPlay = stone === STONE_ENUM.NONE || stone === selfAscend;
            if (!foeCanPlay) return;
            const points = game.board.get_ascend(pos.x, pos.y, foeStone);
            if (!points || !points.length) return;

            cells.add(index);
            // 己方能否占用该点反堵：空点，或玩家自己的打子
            const aiCanBlock = stone === STONE_ENUM.NONE || stone === foeAscend;
            if (!aiCanBlock) hasUnstoppableCell = true;
        });

        return hasUnstoppableCell || cells.size >= 2;
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

        // 对方已打但允许卖血时：若本方可形成更大 ASCEND，仍优先用于抵消。
        if (analysis.pendingThreat && analysis.pendingThreat.M > 0) {
            const answers = moves.filter((move) => move.formsAscend && !move.losesNow);
            const stronger = answers.filter((move) => move.beatsThreat);
            if (stronger.length) {
                return this.toResult(prefer(stronger, byMNDesc), 'anti-suicide-stronger-ascend', analysis);
            }
            if (answers.length) {
                return this.toResult(prefer(answers, byMNDesc), 'answer-ascend', analysis);
            }
        }

        // —— 斩杀逻辑 ——
        const kills = moves.filter((move) => move.isKill || move.winsNow);
        if (kills.length) {
            const chosen = prefer(kills, byKillDesc);
            return this.toResult(chosen, 'kill', analysis);
        }

        // —— 低血绝地反击（Y <= 3）：纯堵徒劳时弃堵转攻、改为形成“打/反击” ——
        // 当己方血量 <= 3（3血同样不能单纯卖血/堵着等死），本回合原本会选一个
        // “堵”动作（只堵不复盘面），但己方其实能形成“打/3连/反击（落在对方打子上减伤）”，
        // 且对方的“打”堵不住（>=2 打点或己方无法占用其打点）时，
        // 取消该堵点，改选最佳的进攻/反击成打点，抢先逼对方应打。
        if (analysis.Y <= 3) {
            const blocks = moves.filter((move) => move.blockPoint);
            const offense = moves.filter((move) => !move.losesNow && (move.formsAscend || move.selfAlign >= 3 || move.landsOnFoeAscend));
            if (blocks.length && offense.length && this.foeHasUnstoppableAscend(game, analysis.foeStone, analysis.selfStone)) {
                const byOffenseDesc = (a, b) => {
                    // 进攻优先级：成“打”(含反击成打) > 3连 > 非成打反击(落对方打子减伤)
                    const ka = a.formsAscend ? 1 : 0;
                    const kb = b.formsAscend ? 1 : 0;
                    if (ka !== kb) return kb - ka;
                    if (ka) return byMNDesc(a, b);
                    const ta = a.selfAlign >= 3 ? 1 : 0;
                    const tb = b.selfAlign >= 3 ? 1 : 0;
                    if (ta !== tb) return tb - ta;
                    const la = a.landsOnFoeAscend ? 1 : 0;
                    const lb = b.landsOnFoeAscend ? 1 : 0;
                    if (la !== lb) return lb - la;
                    return (b.selfAlign - a.selfAlign) || (a.action - b.action);
                };
                return this.toResult(prefer(offense, byOffenseDesc), 'desperate-offense', analysis);
            }
        }

        // 堵住玩家单独打点
        const blocks2 = moves.filter((move) => move.blockPoint);
        if (blocks2.length) {
            const chosen = prefer(blocks2, (a, b) => a.action - b.action);
            return this.toResult(chosen, 'block-player-ascend', analysis);
        }

        // 构建自己的 ASCEND（取最大 M+N）；没有则返回 null 让上层 MCTS 接管
        const builds = moves.filter((move) => move.formsAscend);
        if (builds.length) {
            const chosen = prefer(builds, byMNDesc);
            return this.toResult(chosen, 'build-ascend', analysis);
        }

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
