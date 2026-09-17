
        const boardCanvas = document.getElementById('canvas_board');
        const params = new URLSearchParams(location.search);
        const isCodeChallenge = params.get('mode') === 'code';
        const archiveCode = params.get('code') || '';
        const { EndgameArchive } = window.EndgameExports;
        const { GameNormal, Board, State, PLAYER_ENUM, STONE_ENUM, PLANT_ENUM, ASCEND_ENUM, RandAIC, RandUnity } = window.FAscendExports;
        const GameCanvas = window.GameExports.Canvas;
        const indexOf = (x, y) => y * 9 + x;
        const initialDailyCells = Array.from({ length: 81 }, () => ({ stone: 'none', plant: 0 }));
        [[1, 1], [2, 2], [5, 4], [7, 6], [4, 7]].forEach(([x, y]) => { initialDailyCells[indexOf(x, y)].stone = 'black'; });
        [[2, 1], [3, 3], [6, 5], [5, 7]].forEach(([x, y]) => { initialDailyCells[indexOf(x, y)].stone = 'white'; initialDailyCells[indexOf(x, y)].plant = 1; });
        initialDailyCells[indexOf(4, 4)].plant = 2;
        const dailyBlackBook = [[4, 4], [5, 5], [6, 4]];
        // 预案必须使用不会被初始盘面占用的落点，否则第二手会被 valid() 正确拒绝。
        const dailyWhiteTurns = [[4, 5], [5, 3], [6, 3]];
        let challengeData = { cells: initialDailyCells, hp: { black: 6, white: 6 }, black_book: dailyBlackBook, white_turns: dailyWhiteTurns };
        let cells = [];
        let game = null;
        let state = null;
        let ui = null;
        let aiWorker = null;
        let sound = null;
        let aiReady = false;
        let branch = null;
        let moves = [];
        let blackMoveCount = 0;
        let running = false;
        let challengeOver = false;
        let challengeGeneration = 0;
        let settlementDamage = [0, 0];
        let deviated = false;
        let timerStartedAt = 0;
        let timerHandle = null;
        let challengeElapsed = 0;
        const AI_SIMULATIONS = 1600;
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const cloneCells = (items) => items.map((item) => ({ stone: item.stone || 'none', plant: Number(item.plant) || 0 }));
        const showAlert = (message, variant = 'success') => { const alert = document.getElementById('challenge_alert'); alert.variant = variant; document.getElementById('challenge_alert_text').textContent = message; alert.show(); };
        const showResult = (winner, elapsed, reason) => {
            const blackHp = state.hp[0];
            const whiteHp = state.hp[1];
            const playerWon = winner === PLAYER_ENUM.BLACK;
            const dialog = document.getElementById('challenge_result');
            dialog.classList.remove('d-none');
            dialog.classList.toggle('is-win', playerWon);
            dialog.classList.toggle('is-loss', !playerWon);
            document.getElementById('challenge_result_icon').name = playerWon ? 'trophy' : 'x-octagon';
            document.getElementById('challenge_result_title').textContent = playerWon ? '残局破解成功' : '挑战失败';
            document.getElementById('challenge_result_subtitle').textContent = `${reason} · 黑方 ${blackHp} / 白方 ${whiteHp}`;
            document.getElementById('challenge_result_winner').textContent = playerWon ? '黑方 · 我方' : '白方 · 每日挑战';
            document.getElementById('challenge_result_hp').textContent = `${blackHp} vs ${whiteHp}`;
            document.getElementById('challenge_result_time').textContent = formatElapsed(elapsed);
            dialog.show();
        };
        const setStatus = (message, variant = 'primary') => { const status = document.getElementById('challenge_status'); status.className = `alert alert-${variant} py-2 mb-0 small challenge-loading`; status.textContent = message; };
        const formatElapsed = (elapsed) => { const total = Math.max(0, Math.floor(elapsed / 1000)); return `+${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
        const updateTimer = () => { if (!timerStartedAt) return; document.getElementById('challenge_timer').textContent = formatElapsed(Date.now() - timerStartedAt); };
        const startTimer = () => { if (timerHandle) clearInterval(timerHandle); challengeElapsed = 0; timerStartedAt = Date.now(); updateTimer(); timerHandle = setInterval(updateTimer, 1000); };
        const stopTimer = () => { if (timerStartedAt) challengeElapsed = Date.now() - timerStartedAt; updateTimer(); if (timerHandle) clearInterval(timerHandle); timerHandle = null; };
        const toStone = (stone) => stone === 'black' ? STONE_ENUM.BLACK : stone === 'white' ? STONE_ENUM.WHITE : STONE_ENUM.NONE;
        const toPlant = (plant) => plant === 2 ? PLANT_ENUM.TWO : plant === 1 ? PLANT_ENUM.ONE : PLANT_ENUM.NONE;
        const fromPlayer = () => state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
        const moveLabel = (move) => `${move[0] + 1} · ${move[1] + 1}`;
        const legal = (x, y) => game && game.valid(x, y, fromPlayer());
        const firstEmpty = () => { for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (legal(x, y)) return [x, y]; return null; };
        const syncHpDisplay = (blackHp, whiteHp) => {
            const blackMax = Math.max(1, Number(challengeData.hp.black) || 6);
            const whiteMax = Math.max(1, Number(challengeData.hp.white) || 6);
            const blackHpText = `HP: ${blackHp}/${challengeData.hp.black}`;
            const whiteHpText = `HP: ${whiteHp}/${challengeData.hp.white}`;
            const blackPercent = Math.trunc(Math.max(0, Math.min(1, blackHp / blackMax)).toFixed(2) * 100);
            const whitePercent = Math.trunc(Math.max(0, Math.min(1, whiteHp / whiteMax)).toFixed(2) * 100);
            document.documentElement.style.setProperty('--hp-color-p1', String(blackPercent));
            document.documentElement.style.setProperty('--hp-color-p2', String(whitePercent));
            document.getElementById('game_p1_hp').textContent = blackHpText;
            document.getElementById('game_p2_hp').textContent = whiteHpText;
            document.getElementById('challenge_black_hp').textContent = String(blackHp);
            document.getElementById('challenge_white_hp').textContent = String(whiteHp);
            document.getElementById('game_p1_card').classList.toggle('is-defeated', blackHp <= 0);
            document.getElementById('game_p2_card').classList.toggle('is-defeated', whiteHp <= 0);
            document.getElementById('game_p1_info').classList.toggle('is-defeated', blackHp <= 0);
            document.getElementById('game_p2_info').classList.toggle('is-defeated', whiteHp <= 0);
        };

        const renderInfo = () => {
            const blackHp = state ? state.hp[0] : challengeData.hp.black;
            const whiteHp = state ? state.hp[1] : challengeData.hp.white;
            const playerTurn = state && state.turn_player === PLAYER_ENUM.BLACK;
            const blackHpText = `HP: ${blackHp}/${challengeData.hp.black}`;
            const whiteHpText = `HP: ${whiteHp}/${challengeData.hp.white}`;
            const blackHpPercent = challengeData.hp.black ? Math.trunc(Math.max(0, Math.min(1, blackHp / challengeData.hp.black)).toFixed(2) * 100) : 0;
            const whiteHpPercent = challengeData.hp.white ? Math.trunc(Math.max(0, Math.min(1, whiteHp / challengeData.hp.white)).toFixed(2) * 100) : 0;
            document.documentElement.style.setProperty('--hp-color-p1', String(blackHpPercent));
            document.documentElement.style.setProperty('--hp-color-p2', String(whiteHpPercent));
            const blackStoneCount = game ? game.board.data.filter((pos) => pos.stone === STONE_ENUM.BLACK).length : 0;
            const whiteStoneCount = game ? game.board.data.filter((pos) => pos.stone === STONE_ENUM.WHITE).length : 0;
            const blackPlants = game ? game.board.data.filter((pos) => pos.stone === STONE_ENUM.BLACK && pos.plant !== PLANT_ENUM.NONE).reduce((sum, pos) => sum + (pos.plant === PLANT_ENUM.TWO ? 2 : 1), 0) : 0;
            const whitePlants = game ? game.board.data.filter((pos) => pos.stone === STONE_ENUM.WHITE && pos.plant !== PLANT_ENUM.NONE).reduce((sum, pos) => sum + (pos.plant === PLANT_ENUM.TWO ? 2 : 1), 0) : 0;
            const normalPlants = game ? game.board.data.filter((pos) => pos.stone === STONE_ENUM.NONE && pos.plant !== PLANT_ENUM.NONE).reduce((sum, pos) => sum + (pos.plant === PLANT_ENUM.TWO ? 2 : 1), 0) : 0;
            const ascendPower = (stone) => game ? game.board.data.filter((pos) => pos.stone === stone).reduce((sum, pos) => sum + 1 + (pos.plant === PLANT_ENUM.TWO ? 2 : pos.plant === PLANT_ENUM.ONE ? 1 : 0), 0) : 0;
            const blackPower = ascendPower(STONE_ENUM.BLACK_ASCEND);
            const whitePower = ascendPower(STONE_ENUM.WHITE_ASCEND);
            const blackAscendCount = game ? game.board.data.filter((pos) => pos.stone === STONE_ENUM.BLACK_ASCEND).length : 0;
            const whiteAscendCount = game ? game.board.data.filter((pos) => pos.stone === STONE_ENUM.WHITE_ASCEND).length : 0;
            const blackAscendPlants = Math.max(0, blackPower - blackAscendCount);
            const whiteAscendPlants = Math.max(0, whitePower - whiteAscendCount);
            document.getElementById('challenge_turn').textContent = playerTurn ? '黑方 · 我方' : '白方 · 每日挑战';
            document.getElementById('challenge_moves').textContent = String(moves.length);
            syncHpDisplay(blackHp, whiteHp);
            document.getElementById('game_p1_ascend').textContent = `PR：${blackAscendCount}+${blackAscendPlants}`;
            document.getElementById('game_p2_ascend').textContent = `PR：${whiteAscendCount}+${whiteAscendPlants}`;
            document.getElementById('game_info_turn').textContent = `${state ? state.turn_count : 0} Turns`;
            document.getElementById('game_info_p1').textContent = `${blackStoneCount}+${blackPlants}`;
            document.getElementById('game_info_p2').textContent = `${whiteStoneCount}+${whitePlants}`;
            document.getElementById('game_info_plant_normal').textContent = `${normalPlants} NPlants`;
            document.getElementById('game_info_plant_cd').textContent = state && state.ascend_status !== ASCEND_ENUM.NONE ? (state.ascend_status === ASCEND_ENUM.START ? 'CD=st' : 'CD=ed') : `CD=${state ? state.grow_count : 'cd'}`;
            document.getElementById('game_p1_card').classList.toggle('is-defeated', blackHp <= 0);
            document.getElementById('game_p2_card').classList.toggle('is-defeated', whiteHp <= 0);
            document.getElementById('game_p1_info').classList.toggle('is-defeated', blackHp <= 0);
            document.getElementById('game_p2_info').classList.toggle('is-defeated', whiteHp <= 0);
            document.getElementById('game_p1_card').classList.toggle('turn-green', Boolean(playerTurn));
            document.getElementById('game_p1_info').classList.toggle('turn-green', Boolean(playerTurn));
            document.getElementById('game_p2_card').classList.toggle('turn-blue', Boolean(state && !playerTurn));
            document.getElementById('game_p2_info').classList.toggle('turn-blue', Boolean(state && !playerTurn));
            document.getElementById('game_msg').classList.toggle('text-danger', blackHp <= 0 || whiteHp <= 0);
            const list = document.getElementById('challenge_move_list');
            list.innerHTML = '';
            document.getElementById('challenge_empty').classList.toggle('d-none', moves.length > 0);
            moves.forEach((item, index) => { const row = document.createElement('div'); row.className = 'move-item d-flex align-items-center justify-content-between border rounded px-2 small'; row.innerHTML = `<span><span class='badge text-bg-danger me-1'>${index + 1}</span>${moveLabel(item.move)}</span><span class='text-secondary'>${item.side}${item.source ? ` · ${item.source}` : ''}</span>`; list.appendChild(row); });
        };

        const getBoardSize = () => {
            const wrap = boardCanvas.parentElement;
            const width = wrap ? wrap.clientWidth : 0;
            const height = wrap ? wrap.clientHeight : 0;
            return Math.max(280, Math.floor(Math.min(width || 320, height || width || 320)));
        };

        const redraw = () => {
            if (!ui || !game) return;
            ui.size = getBoardSize();
            ui.init(); ui.draw_board();
            game.board.data.forEach((pos) => {
                if (pos.stone === STONE_ENUM.BLACK) ui.draw_stone_fill(pos.x, pos.y, '#2c3e50');
                else if (pos.stone === STONE_ENUM.WHITE) ui.draw_stone_fill(pos.x, pos.y, '#ecf0f1');
                else if (pos.stone === STONE_ENUM.BLACK_ASCEND) ui.draw_stone_ascend(pos.x, pos.y, '#e74c3c');
                else if (pos.stone === STONE_ENUM.WHITE_ASCEND) ui.draw_stone_ascend(pos.x, pos.y, '#3498db');
                if (pos.plant === PLANT_ENUM.ONE) ui.draw_plant(pos.x, pos.y);
                else if (pos.plant === PLANT_ENUM.TWO) ui.draw_2plant(pos.x, pos.y);
            });
            if (state.turn_count > 0) ui.draw_stone_turn(state.turn_pos[0], state.turn_pos[1], '#FFD700', 5);
        };

        const syncArchiveToBoard = () => {
            challengeData.cells.forEach((item, index) => { const x = index % 9; const y = Math.floor(index / 9); uiBoardSet(x, y, toStone(item.stone), toPlant(item.plant)); });
        };
        const uiBoardSet = (x, y, stone, plant) => { game.board.set_pos(x, y, stone, plant); };
        const syncAiStone = async (x, y, generation = challengeGeneration) => {
            if (!aiReady || generation !== challengeGeneration) return;
            await aiWorker.ZERO_TURN(indexOf(x, y));
        };
        const syncAiBoard = async () => {
            if (!aiReady) return;
            for (const pos of game.board.data) {
                if (pos.stone === STONE_ENUM.BLACK || pos.stone === STONE_ENUM.WHITE) await aiWorker.ZERO_TURN(indexOf(pos.x, pos.y));
            }
        };

        const pendingAscend = [[], []];
        const stoneMeta = (pos) => ({
            gx: pos.x,
            gy: pos.y,
            power: pos.plant === PLANT_ENUM.ONE ? 2 : pos.plant === PLANT_ENUM.TWO ? 3 : 1,
            plant: pos.plant === PLANT_ENUM.ONE ? 1 : pos.plant === PLANT_ENUM.TWO ? 2 : 0,
            color: pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db',
            stone_color: pos.stone === STONE_ENUM.BLACK_ASCEND ? '#2c3e50' : '#ecf0f1',
            marker_color: pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db'
        });

        const renderMove = async (x, y, source, generation = challengeGeneration) => {
            const stone = fromPlayer();
            const isBlack = stone === STONE_ENUM.BLACK;
            ui.clear_view_move();
            ui.clear_view_turn();
            ui.draw_stone_turn(x, y, source === 'AI' ? '#00FFC5' : '#FFD700', 5);
            sound && sound.play_stone();
            const points = game.ed_as_1();
            renderInfo();
            if (sound && sound.context && sound.context.state === 'suspended') sound.context.resume().catch(() => {});
            if (!points) {
                ui.clear_stone_fill(x, y);
                ui.clear_stone_ascend(x, y);
                ui.draw_stone_fill(x, y, isBlack ? '#2c3e50' : '#ecf0f1');
                const pos = game.board.get_pos(x, y);
                if (pos.plant === PLANT_ENUM.ONE) ui.draw_plant(x, y);
                else if (pos.plant === PLANT_ENUM.TWO) ui.draw_2plant(x, y);
                ui.draw_effect_place(x, y, isBlack ? '#2c3e50' : '#95a5a6');
                return;
            }

            const lifted = points.filter((pos) => pos.stone === STONE_ENUM.BLACK_ASCEND || pos.stone === STONE_ENUM.WHITE_ASCEND);
            lifted.forEach((pos) => {
                ui.clear_stone_fill(pos.x, pos.y);
                ui.clear_stone_ascend(pos.x, pos.y);
                ui.draw_stone_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db');
            });
            const side = isBlack ? 'left' : 'right';
            await ui.ascend_lift(lifted.map(stoneMeta), side);
            if (generation !== challengeGeneration) return;
            lifted.forEach((pos) => ui.draw_effect_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? '#e74c3c' : '#3498db'));
            const ascendRound = game.state.ascend_status === ASCEND_ENUM.START ? 0 : 1;
            pendingAscend[ascendRound].push(...lifted);
            sound && sound.play_orbit();
        };

        const settleRound = async (generation = challengeGeneration) => {
            if (generation !== challengeGeneration) return true;

            // 与 AI 挑战一致：第一次 ASCEND 只进入 START，棋子持续盘旋；
            // 只有对手也触发 ASCEND 后，ed_as_2 才返回抵消/攻击结算数据。
            const as = game.ed_as_2(true);
            settlementDamage = game.state.pending_damage ? [...game.state.pending_damage] : [0, 0];
            if (as !== undefined) {
                const nextHp = [game.state.hp[0] - settlementDamage[0], game.state.hp[1] - settlementDamage[1]];
                document.getElementById('game_msg').textContent = `${document.getElementById('game_p1_ascend').textContent.slice(3)} VS ${document.getElementById('game_p2_ascend').textContent.slice(3)}`;
                const fxDone = ui.ascend_settle(
                    { left: document.getElementById('game_p1_hp'), right: document.getElementById('game_p2_hp') },
                    () => {
                        if (game.state.pending_damage) {
                            game.state.hp[0] -= game.state.pending_damage[0];
                            game.state.hp[1] -= game.state.pending_damage[1];
                            game.state.pending_damage = null;
                        }
                        renderInfo();
                    },
                    () => setStatus(`ASCEND 结算：黑方 ${nextHp[0]} · 白方 ${nextHp[1]}`, 'info')
                );

                // AI 挑战会让 PR 信息先保持一段时间，再等待完整飞血/抵消动画收尾。
                await sleep(900);
                document.getElementById('game_p1_ascend').textContent = 'PR：0+0';
                document.getElementById('game_p2_ascend').textContent = 'PR：0+0';
                document.getElementById('game_msg').textContent = 'ASCEND 结算完成';
                await fxDone;

                pendingAscend.flat().forEach((pos) => { ui.clear_stone_ascend(pos.x, pos.y); ui.clear_plant(pos.x, pos.y); });
                pendingAscend[0].length = 0;
                pendingAscend[1].length = 0;
            }

            // 第一次 ASCEND 时这里不会清理动画层；START 状态由游戏引擎保留。
            game.ed_tr_2();
            const win = game.ed_win();
            if (win) {
                challengeOver = true;
                stopTimer();
                renderInfo();
                const blackWin = win === PLAYER_ENUM.BLACK;
                const reason = settlementDamage[0] || settlementDamage[1] ? 'HP 归零' : '棋盘结算';
                setStatus(blackWin ? `黑方完成胜利条件（${reason}）。` : `白方 AI 完成胜利条件（${reason}）。`, blackWin ? 'success' : 'danger');
                showAlert(blackWin ? '残局破解成功！' : '本局由白方 AI 获胜。', blackWin ? 'success' : 'warning');
                showResult(win, challengeElapsed, reason);
                return true;
            }

            settlementDamage = [0, 0];
            const plants = game.ed_pl_1();
            if (plants) {
                plants.forEach((pos) => {
                    ui.clear_plant(pos.x, pos.y);
                    const count = pos.plant === PLANT_ENUM.TWO ? 2 : 1;
                    ui.draw_effect_plant(pos.x, pos.y, count);
                    count === 1 ? ui.draw_plant(pos.x, pos.y) : ui.draw_2plant(pos.x, pos.y);
                });
                sound && sound.play_plant();
                setStatus('植物已生成，AI 继续计算。', 'info');
                await sleep(488);
            }

            game.ed_as_3();
            renderInfo();
            return false;
        };

        const aiThink = async () => {
            if (aiReady) {
                try {
                    const index = await aiWorker.ZERO_THINK(AI_SIMULATIONS);
                    const move = Number.isInteger(index) && index >= 0 && index < 81 ? [index % 9, Math.floor(index / 9)] : null;
                    if (move && legal(move[0], move[1])) return move;
                } catch (error) {
                    console.warn('ZERO AI 思考失败，切换到合法落点保护模式。', error);
                }
            }
            return firstEmpty();
        };

        const playWhite = async (branchResult, generation = challengeGeneration) => {
            if (challengeOver || generation !== challengeGeneration) return;
            try {
                setStatus(!deviated && branchResult && branchResult.matched ? '白方按残局预案应手...' : '白方 AI 正在思考（1600）...', 'info');
                // 一旦黑方偏离正着，branch 会永久进入 normal-ai；后续不再读取任何残局预案。
                const isBookMove = !deviated && Boolean(branchResult && branchResult.matched);
                const move = isBookMove ? branchResult.white_move : await aiThink();
                if (!move || !legal(move[0], move[1])) {
                    setStatus('白方 AI 未找到合法落点，请重置后重试。', 'danger');
                    return;
                }
                if (ui.ascend_is_lifted(move[0], move[1])) ui.ascend_counter(move[0], move[1]);
                if (!game.ed_tr_1(move[0], move[1])) { setStatus('白方 AI 返回了非法落点，请重置后重试。', 'danger'); return; }
                if (isBookMove) await syncAiStone(move[0], move[1], generation);
                moves.push({ move, side: '白方', source: branchResult && branchResult.matched ? '正着应手' : '普通 AI · 1600' });
                await renderMove(move[0], move[1], 'AI', generation);
                const ended = await settleRound(generation);
                const solved = !deviated && Boolean(branchResult && branchResult.matched && branch.snapshot().index >= (challengeData.black_book || []).length);
                if (solved && !ended) {
                    challengeOver = true;
                    stopTimer();
                    setStatus('正着全部完成，恭喜破解残局！', 'success');
                    showAlert('残局破解成功！');
                    showResult(PLAYER_ENUM.BLACK, challengeElapsed, '正着全部完成');
                }
                if (!ended && !challengeOver) setStatus(!deviated && branchResult && branchResult.matched ? '正着命中，继续挑战。' : '已脱离正着，后续由普通 AI 接管。', !deviated && branchResult && branchResult.matched ? 'success' : 'warning');
            } catch (error) {
                console.error('残局挑战白方回合失败。', error);
                setStatus('白方回合执行失败，请重置后重试。', 'danger');
            }
        };

        const playBlack = async (x, y) => {
            if (running || challengeOver || !state || state.turn_player !== PLAYER_ENUM.BLACK) return;
            if (!legal(x, y)) { setStatus('此处不能落子，请选择空位或合法的对方升变点。', 'danger'); return; }
            running = true;
            const generation = challengeGeneration;
            try {
                setStatus('正在判断是否命中残局正着...', 'info');
                if (ui.ascend_is_lifted(x, y)) ui.ascend_counter(x, y);
                if (!game.ed_tr_1(x, y)) return;
                await syncAiStone(x, y, generation);
                const expectedIndex = blackMoveCount++;
                const expected = challengeData.black_book && challengeData.black_book[expectedIndex];
                const matched = Boolean(expected && expected[0] === x && expected[1] === y);
                const branchResult = branch && !deviated ? await branch.black_move([x, y], {}) : null;
                if (!matched || (branchResult && !branchResult.matched)) {
                    deviated = true;
                    setStatus('已偏离正着，普通 AI 已接管，后续不再校验正着。', 'warning');
                }
                moves.push({ move: [x, y], side: '黑方', source: deviated ? '普通 AI 模式' : '正着' });
                await renderMove(x, y, 'PLAYER', generation);
                const ended = await settleRound(generation);
                if (!ended && !challengeOver) await playWhite(branchResult, generation);
            } catch (error) {
                console.error('残局挑战黑方回合失败。', error);
                setStatus('黑方回合执行失败，请重置后重试。', 'danger');
            } finally {
                running = false;
            }
        };

        const pointFromEvent = (event) => {
            const rect = boardCanvas.getBoundingClientRect();
            if (!rect.width || !rect.height || !ui.spacing) return [-1, -1];
            const drawX = (event.clientX - rect.left) * ui.size / rect.width;
            const drawY = (event.clientY - rect.top) * ui.size / rect.height;
            const x = Math.round((drawX - ui.offset) / ui.spacing);
            // Canvas 与 Board 均使用左上角为 (0, 0)，不能在这里再次翻转 Y。
            const y = Math.round((drawY - ui.offset) / ui.spacing);
            return [x, y];
        };
        boardCanvas.addEventListener('pointerdown', (event) => { event.preventDefault(); const [x, y] = pointFromEvent(event); if (x >= 0 && x < 9 && y >= 0 && y < 9) playBlack(x, y); });

        const createGame = () => {
            const boardSize = getBoardSize();
            ui = new GameCanvas(boardCanvas, document.getElementById('canvas_stone_fill'), document.getElementById('canvas_stone_ascend'), document.getElementById('canvas_plant'), document.getElementById('canvas_view_turn'), document.getElementById('canvas_view_ascend'), document.getElementById('canvas_view_move'), 9, 9, .41, .12, .062, boardSize);
            state = new State(); state.hp = [Math.max(0, Number(challengeData.hp.black) || 6), Math.max(0, Number(challengeData.hp.white) || 6)]; state.turn_player = PLAYER_ENUM.BLACK;
            const randAic = new RandAIC(Date.now() >>> 0); const randUnity = new RandUnity((Date.now() ^ 0x4a534b) >>> 0);
            game = new GameNormal(new Board(9, 9), state, randAic, randUnity);
            sound = new window.GameExports.Sound(0, 0.35, 0.35, 0, 0, 0, 0.45, 0.45, 0.3, 0.35);
            ui.set_sound(sound);
            syncArchiveToBoard();
            ui.init(); ui.draw_board(); redraw(); renderInfo();
        };

        const initAi = () => {
            aiReady = false;
            setStatus('黑方先手，请落子（AI 准备中，当前使用合法落点保护模式）。', 'warning');
            if (sound) sound.init().catch(() => {});
            try {
                aiWorker = Comlink.wrap(new Worker('/js/worker/ai.min.js'));
                aiWorker.AI_INIT().then(() => aiWorker.ZERO_RESET(
                    Date.now() >>> 0,
                    (Date.now() ^ 0x4a534b) >>> 0,
                    0,
                    state.hp[1],
                    false
                )).then(() => syncAiBoard()).then(() => {
                    if (challengeOver) return;
                    aiReady = true;
                    setStatus('黑方先手，请落子。', 'primary');
                }).catch((error) => {
                    console.warn('ZERO AI 加载失败，将使用合法落点保护模式。', error);
                    aiReady = false;
                });
            } catch (error) {
                console.warn('ZERO AI Worker 创建失败，将使用合法落点保护模式。', error);
            }
        };

        const resetChallenge = async () => {
            const generation = ++challengeGeneration;
            running = true;
            challengeOver = false;
            deviated = false;
            settlementDamage = [0, 0];
            moves = [];
            blackMoveCount = 0;
            startTimer();
            pendingAscend[0].length = 0;
            pendingAscend[1].length = 0;
            aiWorker = null;
            aiReady = false;
            createGame();
            branch = window.EndgameExports.create_branch(challengeData.black_book || [], challengeData.white_turns || [], async () => {
                const move = await aiThink();
                return move;
            });
            renderInfo();
            setStatus('正在准备 ZERO AI（1600）...', 'primary');
            initAi();
            if (generation !== challengeGeneration) {
                running = false;
                return;
            }
            running = false;
            renderInfo();
        };

        if (isCodeChallenge && archiveCode) {
            try { challengeData = EndgameArchive.decode(archiveCode); document.getElementById('game_msg').textContent = '残局码破解'; document.getElementById('challenge_subtitle').textContent = '已载入指定盘面，命中正着后白方自动应手'; document.getElementById('challenge_badge').textContent = '残局码'; } catch (error) { showAlert('残局码解析失败，已回退到每日挑战。', 'warning'); }
        }
        document.getElementById('button_reset_challenge').addEventListener('click', resetChallenge);
        document.getElementById('challenge_result_restart').addEventListener('click', () => {
            document.getElementById('challenge_result').hide();
            resetChallenge();
        });
        document.getElementById('challenge_result_back').addEventListener('click', () => {
            window.location.href = '/pages/endgame/index.html';
        });
        window.addEventListener('resize', () => { if (ui && game) redraw(); });
        resetChallenge();
    