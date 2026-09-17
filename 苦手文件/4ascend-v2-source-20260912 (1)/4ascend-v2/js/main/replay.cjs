/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 存档回放
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const game_msg = document.getElementById('game_msg');
const game_icon = document.getElementById('game_icon');


const main_app = document.getElementById('main_app');
const main_opt = document.getElementById('main_opt');
const main_game = document.getElementById('main_game');


const game_p1_name = document.getElementById('game_p1_name');


const button_archive_play = document.getElementById('button_archive_play');
const input_archive_text = document.getElementById('input_archive_text');


const dialog_tools = document.getElementById('dialog_tools');


// const dialog_records = document.getElementById('dialog_records');

// const records_list = document.getElementById('records_list');
// const records_loading = document.getElementById('records_loading');
// const records_count_text = document.getElementById('records_count_text');

// const page_indicator = document.getElementById('page_indicator');
// const btn_next_page = document.getElementById('btn_next_page');
// const btn_prev_page = document.getElementById('btn_prev_page');


const button_home = document.getElementById('button_home');


const ArchiveV0 = window.FAscendExports.ArchiveV0;

const GameMessage = window.GameExports.Message;
const GameClient = window.GameExports.Client;
const GameTimer = window.GameExports.Timer;
const GameCanvas = window.GameExports.Canvas;
const GameSound = window.GameExports.Sound;

const Replay = window.MainExports.Replay;
const ShToast = window.UiExports.ShToast;
const BaseZalgo = window.UtilsExports.BaseZalgo;

const toast = new ShToast();




let is_main = true;




// 播放回放
button_archive_play.addEventListener('click', async (event) => {
    if (event.target !== button_archive_play) return;

    let archive = input_archive_text.value;
    const params = new URLSearchParams(location.search);
    const legacyCode = params.get('replayCode') || params.get('code');
    const id = params.get('id') || params.get('replayId');
    if (!archive && !id && legacyCode) {
        archive = legacyCode;
        input_archive_text.value = archive;
    }
    if (!archive && id && typeof window.http_replay_get === 'function') {
        const data = await window.http_replay_get(id, window.get_token());
        if (data) {
            archive = BaseZalgo.encode(data);
            input_archive_text.value = archive;
        }
    }

    if (archive === '') return toast.error('回放数据为空或已失效！');
    if (!ArchiveV0.load(BaseZalgo.decode(archive))) return toast.error('非法对局存档！');

    is_main = false;

    Replay.setup(archive);
    Replay.run();

    button_home.classList.add('d-none');
    window.switch_wection(main_game, main_opt);

    game_msg.innerText = '等待操作';
});

(async () => {
    const params = new URLSearchParams(location.search);
    if (!params.get('id') && !params.get('replayId') && !params.get('replayCode') && !params.get('code')) return;
    button_archive_play.click();
})();


// 功能面板
game_msg.addEventListener('pointerdown', (event) => {
    if (event.target !== game_msg || is_main) return;

    dialog_tools.classList.remove('d-none');
    dialog_tools.show();
});


// // 记录
// (() => {
//     // -----------------------------------------------------------------
//     // 1. 假数据生成函数
//     // -----------------------------------------------------------------
//     function generateMockRecords(count = 1) {
//         const playerPool = [
//             'CsVeryLoveXieWenLi', '橋野みずは', 'Kuroko', 'Aki_Mizuki',
//             'Mizuno_Rin', 'SilverBlade', 'NightCat', '星野爱',
//             '折木奉太郎', '千反田爱瑠', 'AI-Bot (Hard)', 'AI-Bot (Normal)'
//         ];
//         const modes = ['昇华模式', '标准模式', '残局挑战', '极限排位'];
//         const hpOptions = ['1/6', '2/6', '3/6', '4/6', '5/6', '6/6'];

//         const records = [];
//         let currentTime = Date.now();

//         for (let i = 0; i < count; i++) {
//             currentTime -= Math.floor(Math.random() * (24 * 3600 * 1000 / 2)) + (1000 * 60 * 15);
//             const dateObj = new Date(currentTime);
//             const timeStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

//             const p1Idx = Math.floor(Math.random() * playerPool.length);
//             let p2Idx = Math.floor(Math.random() * playerPool.length);
//             while (p2Idx === p1Idx) p2Idx = Math.floor(Math.random() * playerPool.length);

//             const p1IsFirst = Math.random() > 0.5;
//             const p1Wins = Math.random() > 0.45;

//             const p1Hp = p1Wins ? hpOptions[Math.floor(Math.random() * hpOptions.length)] : '0/6';
//             const p2Hp = p1Wins ? '0/6' : hpOptions[Math.floor(Math.random() * hpOptions.length)];

//             records.push({
//                 id: `REC-${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
//                 mode: modes[Math.floor(Math.random() * modes.length)],
//                 startTime: timeStr,
//                 p1: { name: playerPool[p1Idx], hp: p1Hp, stone: '⚪ 白棋', isFirst: p1IsFirst },
//                 p2: { name: playerPool[p2Idx], hp: p2Hp, stone: '⚫ 黑棋', isFirst: !p1IsFirst },
//                 archiveCode: `ASC4_SAV_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
//             });
//         }
//         return records;
//     }

//     // -----------------------------------------------------------------
//     // 2. 状态与 DOM 元素
//     // -----------------------------------------------------------------
//     let allRecordsData = [];
//     let currentPage = 1;
//     const pageSize = 3; // 固定每页 3 条

//     const gameIcon = document.getElementById('game_icon');
//     const dialogRecords = document.getElementById('dialog_records');
//     const recordsList = document.getElementById('records_list');
//     const recordsLoading = document.getElementById('records_loading');
//     const recordsCountText = document.getElementById('records_count_text');
//     const pageIndicator = document.getElementById('page_indicator');
//     const btnPrevPage = document.getElementById('btn_prev_page');
//     const btnNextPage = document.getElementById('btn_next_page');

//     if (!gameIcon || !dialogRecords) return;

//     gameIcon.style.cursor = 'pointer';

//     dialogRecords.addEventListener('sl-request-close', (event) => {
//         if (event.detail.source === 'overlay') event.preventDefault();
//     });

//     // -----------------------------------------------------------------
//     // 3. 数据切片与渲染 (使用 visibility: hidden 严格保证高度一致)
//     // -----------------------------------------------------------------
//     function getPagedData(offset, length) {
//         return {
//             total: allRecordsData.length,
//             list: allRecordsData.slice(offset, offset + length)
//         };
//     }

//     function renderCurrentPage() {
//         const offset = (currentPage - 1) * pageSize;
//         const { total, list } = getPagedData(offset, pageSize);
//         const totalPages = Math.max(1, Math.ceil(total / pageSize));

//         recordsCountText.textContent = `第 ${currentPage}/${totalPages} 页 (共 ${total} 条)`;
//         pageIndicator.textContent = `${currentPage} / ${totalPages}`;

//         btnPrevPage.disabled = currentPage <= 1;
//         btnNextPage.disabled = currentPage >= totalPages;

//         if (list.length === 0) {
//             recordsList.innerHTML = `<div class="d-flex align-items-center justify-content-center h-100 text-muted small">暂无对局记录</div>`;
//             return;
//         }

//         recordsList.innerHTML = list.map(item => {
//             return `
//                 <div class='card bg-white border rounded-3 p-3 shadow-sm'>
//                     <!-- 顶栏：模式与时间 -->
//                     <div class='d-flex justify-content-between align-items-center pb-2 border-bottom'>
//                         <div class='d-flex align-items-center gap-2'>
//                             <span class='badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-2' style='font-size: 0.72rem;'>
//                                 ${item.mode}
//                             </span>
//                             <span class='text-muted small' style='font-size: 0.75rem;'>${item.startTime}</span>
//                         </div>
//                         <sl-button size='small' variant='primary' pill class='btn-load-archive' data-archive='${item.archiveCode}'>
//                             <sl-icon name='play-fill' slot='prefix'></sl-icon>载入回放
//                         </sl-button>
//                     </div>

//                     <!-- 对战面板 -->
//                     <div class='row g-2 align-items-center text-center mt-2'>
//                         <!-- P1 区域 -->
//                         <div class='col-5 d-flex flex-column align-items-center p-2 rounded-2 bg-light border border-light-subtle'>
//                             <div class='fw-bold text-truncate w-100 text-dark' style='font-size: 0.85rem;' title='${item.p1.name}'>
//                                 ${item.p1.name}
//                             </div>
//                             <div class='d-flex align-items-center justify-content-center gap-1 text-muted mt-1' style='font-size: 0.72rem;'>
//                                 <span class='d-inline-flex align-items-center'>${item.p1.stone}</span>
//                                 <span class='badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-1' style='font-size: 0.58rem; padding: 1.5px 4px; line-height: 1; font-weight: normal; visibility: ${item.p1.isFirst ? 'visible' : 'hidden'};'>先手</span>
//                             </div>
//                             <div class='hp-color-p1 fw-bold mt-1.5' style='font-size: 0.78rem;'>
//                                 HP: ${item.p1.hp}
//                             </div>
//                         </div>

//                         <!-- VS 标记 -->
//                         <div class='col-2 d-flex justify-content-center'>
//                             <span class='badge rounded-pill bg-body-tertiary text-muted border px-2 py-1' style='font-size: 0.65rem;'>VS</span>
//                         </div>

//                         <!-- P2 区域 -->
//                         <div class='col-5 d-flex flex-column align-items-center p-2 rounded-2 bg-light border border-light-subtle'>
//                             <div class='fw-bold text-truncate w-100 text-dark' style='font-size: 0.85rem;' title='${item.p2.name}'>
//                                 ${item.p2.name}
//                             </div>
//                             <div class='d-flex align-items-center justify-content-center gap-1 text-muted mt-1' style='font-size: 0.72rem;'>
//                                 <span class='d-inline-flex align-items-center'>${item.p2.stone}</span>
//                                 <span class='badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-1' style='font-size: 0.58rem; padding: 1.5px 4px; line-height: 1; font-weight: normal; visibility: ${item.p2.isFirst ? 'visible' : 'hidden'};'>先手</span>
//                             </div>
//                             <div class='hp-color-p2 fw-bold mt-1.5' style='font-size: 0.78rem;'>
//                                 HP: ${item.p2.hp}
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//             `;
//         }).join('');

//         // 绑定按钮事件
//         recordsList.querySelectorAll('.btn-load-archive').forEach(btn => {
//             btn.addEventListener('click', (e) => {
//                 const archive = e.currentTarget.getAttribute('data-archive');
//                 const inputArchive = document.getElementById('input_archive_text');
//                 if (inputArchive) inputArchive.value = archive;
//                 dialogRecords.hide();
//             });
//         });
//     }

//     // -----------------------------------------------------------------
//     // 4. 浮层假加载（绝不隐藏/改变下方 DOM 结构）
//     // -----------------------------------------------------------------
//     function applyFakeLoading(callback) {
//         recordsLoading.classList.remove('d-none');
//         recordsLoading.classList.add('d-flex');

//         setTimeout(() => {
//             if (callback) callback();
//             recordsLoading.classList.add('d-none');
//             recordsLoading.classList.remove('d-flex');
//         }, 200);
//     }

//     // -----------------------------------------------------------------
//     // 5. 事件绑定
//     // -----------------------------------------------------------------
//     gameIcon.addEventListener('click', async () => {
//         if (allRecordsData.length === 0) {
//             allRecordsData = generateMockRecords(0);
//         }

//         dialogRecords.classList.remove('d-none');
//         dialogRecords.show();

//         currentPage = 1;
//         applyFakeLoading(renderCurrentPage);
//     });

//     btnPrevPage.addEventListener('click', () => {
//         if (currentPage > 1) {
//             currentPage--;
//             applyFakeLoading(renderCurrentPage);
//         }
//     });

//     btnNextPage.addEventListener('click', () => {
//         const totalPages = Math.ceil(allRecordsData.length / pageSize);
//         if (currentPage < totalPages) {
//             currentPage++;
//             applyFakeLoading(renderCurrentPage);
//         }
//     });
// })();