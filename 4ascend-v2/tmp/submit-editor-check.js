
        const canvas = document.getElementById('editor_board');
        const ctx = canvas.getContext('2d');
        const { EndgameArchive, create_branch } = window.EndgameExports;
        const toast = new window.UiExports.ShToast(2600);
        const boardSize = 9;
        const cells = Array.from({ length: boardSize * boardSize }, () => ({ stone: 'none', plant: 0 }));
        // 两组落子预案都是有序队列，同一坐标可以重复出现多次。
        // 黑方正着与白方预设互相独立，也可以叠加在已有棋子或彼此相同的坐标上。
        const blackBook = [];
        const sequence = [];
        let tool = 'black';
        let plantLevel = 0;
        // 黑方正着与白方预设按同一序号一一对应：blackBook[i] -> sequence[i]。
        const board_marks = { black: blackBook, white: sequence };
        const move_count_at = (moves, x, y) => moves.filter((pos) => pos[0] === x && pos[1] === y).length;
        const add_move = (moves, x, y) => moves.push([x, y]);
        const swapStoneColor = (stone) => {
            if (stone === 'black') return 'white';
            if (stone === 'white') return 'black';
            if (stone === 'black-ascend') return 'white-ascend';
            if (stone === 'white-ascend') return 'black-ascend';
            if (stone === 'black-used') return 'white-used';
            if (stone === 'white-used') return 'black-used';
            return stone;
        };

        const tools = {
            black: ['黑方棋子', 'tool_black'],
            white: ['白方棋子', 'tool_white'],
            plant: ['草状态', 'tool_plant'],
            erase: ['橡皮擦', 'tool_erase'],
            sequence: ['白方落子：添加序号', 'tool_sequence'],
            book: ['黑方正着：添加', 'tool_book'],
        };

        const cell = (x, y) => cells[y * boardSize + x];
        const cellByDisplayPoint = (x, y) => cell(x, boardSize - 1 - y);
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        // 复制/解析等反馈统一走右上角 ShToast。
        const showAlert = (message, variant = 'success') => {
            if (variant === 'success') toast.success(message);
            else if (variant === 'danger') toast.error(message);
            else toast.info(message);
        };

        const boardPoint = (event) => {
            const rect = canvas.getBoundingClientRect();
            const pad = rect.width * 0.062;
            const spacing = (rect.width - pad * 2) / (boardSize - 1);
            const x = clamp(Math.round((event.clientX - rect.left - pad) / spacing), 0, boardSize - 1);
            const y = clamp(Math.round((event.clientY - rect.top - pad) / spacing), 0, boardSize - 1);
            return [x, boardSize - 1 - y];
        };

        const displayPoint = (x, y) => `(${x + 1}, ${y + 1})`;
        const pointPixel = (x, y, pad, spacing) => [pad + x * spacing, pad + (boardSize - 1 - y) * spacing];

        const drawPlant = (px, py, count, spacing) => {
            if (!count) return;
            ctx.fillStyle = '#2ecc71';
            ctx.shadowColor = '#2ecc71';
            ctx.shadowBlur = 6;
            for (let i = 0; i < count; i++) {
                const x = px + (i - (count - 1) / 2) * spacing * 0.19;
                ctx.beginPath();
                ctx.arc(x, py, Math.max(3, spacing * 0.065), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        };

        const redraw = () => {
            const size = canvas.clientWidth || 320;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = size * dpr;
            canvas.height = size * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, size, size);
            const pad = size * 0.062;
            const spacing = (size - pad * 2) / (boardSize - 1);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 3;
            ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
            ctx.strokeStyle = '#d0d0d0';
            ctx.lineWidth = 1;
            for (let i = 0; i < boardSize; i++) {
                const p = pad + i * spacing;
                ctx.beginPath(); ctx.moveTo(p, pad); ctx.lineTo(p, pad + spacing * (boardSize - 1)); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(pad, p); ctx.lineTo(pad + spacing * (boardSize - 1), p); ctx.stroke();
            }
            ctx.font = `bold ${Math.max(9, Math.floor(pad * 0.8))}px sans-serif`;
            ctx.fillStyle = '#6f6f6f';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (let i = 0; i < boardSize; i++) {
                const p = pad + i * spacing;
                // 横轴从左到右 1~9，纵轴从下到上 1~9。
                ctx.fillText(String(i + 1), p, size - pad * 0.42);
                ctx.fillText(String(boardSize - i), pad * 0.42, p);
            }
            cells.forEach((item, index) => {
                const x = index % boardSize;
                const y = Math.floor(index / boardSize);
                const [px, py] = pointPixel(x, y, pad, spacing);
                if (item.stone !== 'none') {
                    ctx.beginPath();
                    ctx.arc(px, py, spacing * 0.36, 0, Math.PI * 2);
                    ctx.fillStyle = item.stone === 'black' ? '#2c3e50' : '#ecf0f1';
                    ctx.shadowColor = item.stone === 'black' ? '#2c3e50' : '#adb5bd';
                    ctx.shadowBlur = 7;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    if (item.stone === 'white') { ctx.strokeStyle = '#8b949e'; ctx.lineWidth = 1; ctx.stroke(); }
                }
            });
            // 草独立绘制在棋子之后，确保始终位于棋子上方，并保持在网格交叉点中心。
            cells.forEach((item, index) => {
                if (!item.plant) return;
                const x = index % boardSize;
                const y = Math.floor(index / boardSize);
                const [px, py] = pointPixel(x, y, pad, spacing);
                drawPlant(px, py, item.plant, spacing);
            });
            const draw_marks = (moves, direction, color, text_color) => {
                const grouped = new Map();
                moves.forEach((pos, index) => {
                    const key = `${pos[0]},${pos[1]}`;
                    if (!grouped.has(key)) grouped.set(key, []);
                    grouped.get(key).push({ pos, index });
                });
                grouped.forEach((items) => items.forEach(({ pos, index }, offset) => {
                    const [px, py] = pointPixel(pos[0], pos[1], pad, spacing);
                    const markX = px + direction * (spacing * (0.23 + offset * 0.27));
                    const markY = py - spacing * 0.23;
                    ctx.beginPath(); ctx.arc(markX, markY, spacing * 0.13, 0, Math.PI * 2);
                    ctx.fillStyle = color; ctx.fill();
                    ctx.fillStyle = text_color; ctx.font = `bold ${Math.max(10, spacing * 0.16)}px sans-serif`;
                    ctx.fillText(String(index + 1), markX, markY - spacing * 0.005);
                }));
            };
            // 黑方标记从左向外排，白方标记从右向外排，同一格多个标记不会遮挡。
            draw_marks(blackBook, -1, '#dc3545', '#fff');
            draw_marks(sequence, 1, '#f1c40f', '#5b4700');
        };

        const renderSequence = () => {
            const list = document.getElementById('sequence_list');
            const empty = document.getElementById('sequence_empty');
            list.innerHTML = '';
            empty.classList.toggle('d-none', sequence.length > 0);
            document.getElementById('sequence_count').textContent = `${sequence.length} 手`;
            sequence.forEach((pos, index) => {
                const row = document.createElement('div');
                row.className = 'sequence-item d-flex align-items-center justify-content-between border rounded px-2';
                row.innerHTML = `<span><span class='badge text-bg-warning me-1'>${index + 1}</span>白方落子 ${displayPoint(pos[0], pos[1])}</span>`;
                const remove = document.createElement('sl-button');
                remove.size = 'small'; remove.circle = true; remove.title = '移除此步'; remove.innerHTML = '<sl-icon name="x-lg"></sl-icon>';
                remove.addEventListener('click', () => { sequence.splice(index, 1); renderSequence(); redraw(); updateSummary(); });
                row.appendChild(remove); list.appendChild(row);
            });
        };

        const renderBook = () => {
            const list = document.getElementById('book_list');
            const empty = document.getElementById('book_empty');
            list.innerHTML = '';
            empty.classList.toggle('d-none', blackBook.length > 0);
            document.getElementById('book_count').textContent = `${blackBook.length} 手`;
            blackBook.forEach((pos, index) => {
                const row = document.createElement('div');
                row.className = 'sequence-item d-flex align-items-center justify-content-between border rounded px-2';
                row.innerHTML = `<span><span class='badge text-bg-danger me-1'>${index + 1}</span>黑方正着 ${displayPoint(pos[0], pos[1])}</span>`;
                const remove = document.createElement('sl-button');
                remove.size = 'small'; remove.circle = true; remove.title = '移除此步';
                remove.innerHTML = '<sl-icon name="x-lg"></sl-icon>';
                remove.addEventListener('click', () => { blackBook.splice(index, 1); renderBook(); redraw(); updateSummary(); });
                row.appendChild(remove); list.appendChild(row);
            });
        };

        const exportData = () => ({
            cells,
            player: 'black', first: 'black', natural_plant: false,
            hp: { black: Number(document.getElementById('black_hp').value) || 0, white: Number(document.getElementById('white_hp').value) || 0 },
            blackBook,
            whiteTurns: sequence,
            fallback: { level: 2 },
        });

        const updateSummary = () => {
            const black = cells.filter((item) => item.stone === 'black').length;
            const white = cells.filter((item) => item.stone === 'white').length;
            const plants = cells.reduce((total, item) => total + item.plant, 0);
            const pairCount = Math.min(blackBook.length, sequence.length);
            const pending = Math.abs(blackBook.length - sequence.length);
            const sameCell = blackBook.filter(([x, y]) => move_count_at(sequence, x, y) > 0).length;
            const repeatedBlack = blackBook.length - new Set(blackBook.map(([x, y]) => `${x},${y}`)).size;
            const repeatedWhite = sequence.length - new Set(sequence.map(([x, y]) => `${x},${y}`)).size;
            const pairing = pending ? ` · 待配对 ${pending} 手` : '';
            document.getElementById('editor_summary').textContent = `黑方 ${black} 子 · 白方 ${white} 子 · 草 ${plants} 点 · 正着 ${blackBook.length} 手 · 白方预案 ${sequence.length} 手 · 已配对 ${pairCount} 手${pairing} · 同格叠加 ${sameCell} 处 · 重复标记 ${repeatedBlack + repeatedWhite} 个 · 黑方先手 · 自然刷草关闭`;
        };

        const setTool = (nextTool) => {
            tool = nextTool;
            document.getElementById('current_tool').textContent = tools[nextTool][0];
            Object.keys(tools).forEach((key) => document.getElementById(tools[key][1]).classList.toggle('tool-active', key === nextTool));
        };

        const apply = (x, y) => {
            const item = cell(x, y);
            if (tool === 'black' || tool === 'white') item.stone = tool;
            else if (tool === 'plant') item.plant = plantLevel;
            else if (tool === 'erase') {
                item.stone = 'none'; item.plant = 0;
                for (let i = sequence.length - 1; i >= 0; i--) if (sequence[i][0] === x && sequence[i][1] === y) sequence.splice(i, 1);
                for (let i = blackBook.length - 1; i >= 0; i--) if (blackBook[i][0] === x && blackBook[i][1] === y) blackBook.splice(i, 1);
            }
            else if (tool === 'sequence') add_move(sequence, x, y);
            else if (tool === 'book') add_move(blackBook, x, y);
            renderSequence(); renderBook(); redraw(); updateSummary();
        };

        canvas.addEventListener('pointerdown', (event) => { event.preventDefault(); const [x, y] = boardPoint(event); apply(x, y); });
        document.getElementById('tool_black').addEventListener('click', () => setTool('black'));
        document.getElementById('tool_white').addEventListener('click', () => setTool('white'));
        document.getElementById('tool_erase').addEventListener('click', () => setTool('erase'));
        document.getElementById('tool_sequence').addEventListener('click', () => setTool('sequence'));
        document.getElementById('tool_book').addEventListener('click', () => setTool('book'));
        document.getElementById('tool_plant').addEventListener('click', () => { plantLevel = (plantLevel + 1) % 3; document.getElementById('tool_plant_text').textContent = plantLevel === 0 ? '无草' : `${plantLevel} 草`; setTool('plant'); });
        document.getElementById('button_clear_sequence').addEventListener('click', () => { sequence.length = 0; renderSequence(); redraw(); updateSummary(); });
        document.getElementById('button_clear_book').addEventListener('click', () => { blackBook.length = 0; renderBook(); redraw(); updateSummary(); });
        document.getElementById('button_reset_board').addEventListener('click', () => { cells.forEach((item) => { item.stone = 'none'; item.plant = 0; }); sequence.length = 0; blackBook.length = 0; renderSequence(); renderBook(); redraw(); updateSummary(); showAlert('已清空初始盘面'); });
        document.getElementById('button_sample_board').addEventListener('click', () => {
            cells.forEach((item) => { item.stone = 'none'; item.plant = 0; });
            [[2, 3], [3, 4], [5, 5]].forEach(([x, y]) => { cellByDisplayPoint(x, y).stone = 'black'; });
            [[4, 3], [4, 4]].forEach(([x, y]) => { cellByDisplayPoint(x, y).stone = 'white'; cellByDisplayPoint(x, y).plant = 1; });
            cellByDisplayPoint(3, 3).plant = 2; sequence.splice(0, sequence.length, [5, 5], [4, 5], [5, 4]);
            blackBook.splice(0, blackBook.length, [4, 4], [6, 4], [5, 6]);
            renderSequence(); renderBook(); redraw(); updateSummary(); showAlert('已填入示例盘面与黑方正着');
        });
        document.getElementById('button_swap_colors').addEventListener('click', () => {
            // 只互换黑白棋子与双方 HP；草位置、正着/预案序号保持不变，相当于仅切换占草方。
            cells.forEach((item) => { item.stone = swapStoneColor(item.stone); });
            const blackHpInput = document.getElementById('black_hp');
            const whiteHpInput = document.getElementById('white_hp');
            const blackHp = blackHpInput.value;
            blackHpInput.value = whiteHpInput.value;
            whiteHpInput.value = blackHp;
            redraw();
            updateSummary();
            showAlert('已反转黑白棋子与双方 HP');
        });
        const runBranchTest = async (deviate) => {
            if (!blackBook.length || !sequence.length || blackBook.length !== sequence.length) {
                document.getElementById('branch_test_result').textContent = '请先填入等数量的黑方正着与白方预案。';
                return;
            }
            const branch = create_branch(blackBook, sequence, async () => [0, 0]);
            const move = deviate ? [0, 0] : blackBook[0];
            const result = await branch.black_move(move, { test: true });
            document.getElementById('branch_test_result').textContent = deviate
                ? `偏离分支：${result.source}，原因 ${result.reason}，AI 返回 ${displayPoint(result.white_move[0], result.white_move[1])}`
                : `正着分支：${result.source}，匹配成功，白方预案 ${displayPoint(result.white_move[0], result.white_move[1])}`;
        };

        document.getElementById('button_test_book').addEventListener('click', () => runBranchTest(false));
        document.getElementById('button_test_deviation').addEventListener('click', () => runBranchTest(true));

        const loadArchive = (data) => {
            cells.splice(0, cells.length, ...data.cells);
            blackBook.splice(0, blackBook.length, ...data.black_book);
            sequence.splice(0, sequence.length, ...data.white_turns);
            document.getElementById('black_hp').value = data.hp.black;
            document.getElementById('white_hp').value = data.hp.white;
            renderSequence(); renderBook(); redraw(); updateSummary();
        };

        document.getElementById('button_export').addEventListener('click', async () => {
            // 允许无正着残局导出；若已填写正着，仍要求黑白手数一致。
            if (blackBook.length !== sequence.length) {
                showAlert('复制失败：黑方正着与白方预案手数必须一致', 'danger');
                return;
            }
            try {
                const text = EndgameArchive.encode(exportData());
                await navigator.clipboard.writeText(text);
                showAlert(blackBook.length ? '压缩残局码已复制' : '压缩残局码已复制（无正着）');
            } catch (error) {
                showAlert(`复制失败：${error.message || '未知错误'}`, 'danger');
            }
        });

        document.getElementById('button_import').addEventListener('click', () => {
            const input = document.getElementById('input_endgame_archive');
            try {
                const data = EndgameArchive.decode(input.value.trim());
                loadArchive(data);
                input.value = '';
                showAlert('残局码解析成功，已载入编辑器');
            } catch (error) {
                showAlert(`残局码解析失败：${error.message || '未知错误'}`, 'danger');
            }
        });
        window.addEventListener('resize', redraw);
        setTool('black'); renderSequence(); redraw(); updateSummary();
    