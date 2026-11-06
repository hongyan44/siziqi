/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 成就系统（成就目录 / 解锁记录 / 进度统计 / 全屏右上角提示）
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */

// ===== 成就美术资源（每个成就一套独立 SVG） =====
const achievement_art_kindred = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <circle cx='36' cy='50' r='21' stroke='#2f6fdf' stroke-width='6'/>
    <circle cx='60' cy='50' r='21' stroke='#0f172a' stroke-width='6' opacity='.85'/>
    <circle cx='29' cy='44' r='4' fill='#0f172a'/>
    <circle cx='67' cy='56' r='4' fill='#e2e8f0' stroke='#0f172a' stroke-width='1.5'/>
    <path d='M48 20v9M43.5 24.5h9' stroke='#d4a853' stroke-width='3' stroke-linecap='round'/>
</svg>`;

const achievement_art_craftsman = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <rect x='22' y='30' width='48' height='38' rx='12' fill='#e8eef7' stroke='#334155' stroke-width='4'/>
    <circle cx='38' cy='47' r='4.5' fill='#1d4ed8'/>
    <circle cx='56' cy='47' r='4.5' fill='#1d4ed8'/>
    <path d='M39 58h16' stroke='#334155' stroke-width='3.5' stroke-linecap='round'/>
    <path d='M46 30V21' stroke='#334155' stroke-width='4' stroke-linecap='round'/>
    <circle cx='46' cy='18' r='4' fill='#d4a853' stroke='#334155' stroke-width='2'/>
    <circle cx='73' cy='69' r='9' fill='#fff7ed' stroke='#c27803' stroke-width='3'/>
    <path d='M73 57v4M73 77v4M61 69h4M81 69h4M65 61l3 3M78 74l3 3M81 61l-3 3M68 74l-3 3' stroke='#c27803' stroke-width='2.5' stroke-linecap='round'/>
</svg>`;

const achievement_art_first = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='40' cy='78' rx='26' ry='7' fill='#0f172a' opacity='.12'/>
    <ellipse cx='38' cy='68' rx='21' ry='12' fill='#f8fafc' stroke='#0f172a' stroke-width='4'/>
    <path d='M38 60V24' stroke='#0f172a' stroke-width='4' stroke-linecap='round'/>
    <path d='M40 26l27 8-27 9z' fill='#ef4444'/>
    <path d='M62 66l2 5M69 61l4 3M55 72l1 4' stroke='#d4a853' stroke-width='3' stroke-linecap='round'/>
</svg>`;

const achievement_art_endgame = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <rect x='16' y='26' width='46' height='46' rx='8' fill='#ffffff' stroke='#334155' stroke-width='4'/>
    <path d='M31 26v46M46 26v46M16 41h46M16 56h46' stroke='#94a3b8' stroke-width='3'/>
    <rect x='31' y='41' width='15' height='15' fill='#93c5fd'/>
    <path d='M31 41l15 15M46 41L31 56' stroke='#1d4ed8' stroke-width='2.5'/>
    <rect x='57' y='43' width='23' height='23' rx='6' fill='#bfdbfe' stroke='#1d4ed8' stroke-width='3'/>
    <circle cx='57' cy='54' r='5' fill='#bfdbfe' stroke='#1d4ed8' stroke-width='3'/>
    <path d='M68 43v-4M78 50h4' stroke='#1d4ed8' stroke-width='2.5' stroke-linecap='round'/>
</svg>`;

const achievement_art_ten = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <circle cx='48' cy='22' r='3.6' fill='#475569'/>
    <circle cx='63.3' cy='27' r='3.6' fill='#475569'/>
    <circle cx='72.7' cy='40' r='3.6' fill='#475569'/>
    <circle cx='72.7' cy='56' r='3.6' fill='#475569'/>
    <circle cx='63.3' cy='69' r='3.6' fill='#475569'/>
    <circle cx='48' cy='74' r='3.6' fill='#475569'/>
    <circle cx='32.7' cy='69' r='3.6' fill='#475569'/>
    <circle cx='23.3' cy='56' r='3.6' fill='#475569'/>
    <circle cx='23.3' cy='40' r='3.6' fill='#475569'/>
    <circle cx='32.7' cy='27' r='3.6' fill='#475569'/>
    <path d='M48 36l3.6 8.2 8.9.8-6.7 5.9 2 8.7-7.8-4.5-7.8 4.5 2-8.7-6.7-5.9 8.9-.8z' fill='#d4a853'/>
</svg>`;

const achievement_art_hundred = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <path d='M48 15l26 8v23c0 16-11 27-26 34-15-7-26-18-26-34V23z' fill='#f8fafc' stroke='#334155' stroke-width='4' stroke-linejoin='round'/>
    <path d='M30 34l18-9 18 9M30 44l18-9 18 9M30 54l18-9 18 9' stroke='#94a3b8' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>
    <circle cx='42' cy='60' r='2.6' fill='#64748b'/>
    <circle cx='52' cy='60' r='2.6' fill='#64748b'/>
    <circle cx='42' cy='68' r='2.6' fill='#64748b'/>
    <circle cx='52' cy='68' r='2.6' fill='#64748b'/>
    <path d='M48 48l2.4 5.4 5.9.5-4.5 3.9 1.4 5.8-5.2-3-5.2 3 1.4-5.8-4.5-3.9 5.9-.5z' fill='#d4a853'/>
</svg>`;

const achievement_art_master = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <path d='M27 70c-8-14-4-32 6-42' stroke='#16a34a' stroke-width='3.5' stroke-linecap='round'/>
    <path d='M69 70c8-14 4-32-6-42' stroke='#16a34a' stroke-width='3.5' stroke-linecap='round'/>
    <path d='M22 62c-1 4 0 8 3 11M21 52c-1 4-1 7 0 10M74 62c1 4 0 8-3 11M75 52c1 4 1 7 0 10' stroke='#4ade80' stroke-width='2.5' stroke-linecap='round'/>
    <rect x='34' y='70' width='28' height='9' rx='4.5' fill='#0f172a'/>
    <path d='M40 70c0-11 3-16 8-22 5 6 8 11 8 22z' fill='#0f172a'/>
    <circle cx='48' cy='45' r='6' fill='#0f172a'/>
    <path d='M37 38l4-11 7 6 7-6 4 11z' fill='#d4a853' stroke='#b45309' stroke-width='1.5' stroke-linejoin='round'/>
</svg>`;

const achievement_art_ai = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <path d='M48 22l22 12v23L48 69 26 57V34z' fill='#eef2ff' stroke='#4338ca' stroke-width='4' stroke-linejoin='round'/>
    <path d='M39 39v9h9v10M57 35v9l-9 9M33 52h6M58 52h6' stroke='#6366f1' stroke-width='3' stroke-linecap='round'/>
    <circle cx='39' cy='39' r='3' fill='#4338ca'/>
    <circle cx='57' cy='35' r='3' fill='#4338ca'/>
    <circle cx='48' cy='58' r='3' fill='#4338ca'/>
    <circle cx='33' cy='52' r='2.6' fill='#4338ca'/>
    <circle cx='64' cy='52' r='2.6' fill='#4338ca'/>
    <path d='M37 17l4-9 7 6 7-6 4 9z' fill='#d4a853' stroke='#b45309' stroke-width='1.5' stroke-linejoin='round'/>
</svg>`;

// 残局高手：白银材质的三阶残局盘，一条已连成的四连 + 右上角银色徽章
const achievement_art_endgame_expert = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='84' rx='23' ry='4' fill='#0f172a' opacity='.1'/>
    <rect x='18' y='26' width='52' height='52' rx='9' fill='#f8fafc' stroke='#475569' stroke-width='4'/>
    <path d='M31 26v52M44 26v52M57 26v52M18 39h52M18 52h52M18 65h52' stroke='#cbd5e1' stroke-width='2.4'/>
    <circle cx='31' cy='39' r='5.2' fill='#94a3b8'/>
    <circle cx='44' cy='52' r='5.2' fill='#94a3b8'/>
    <circle cx='57' cy='65' r='5.2' fill='#94a3b8'/>
    <circle cx='44' cy='39' r='5.2' fill='#64748b'/>
    <circle cx='57' cy='39' r='5.2' fill='#64748b'/>
    <path d='M31 39l13 13 13 13' stroke='#e2e8f0' stroke-width='2' stroke-linecap='round' opacity='.9'/>
    <circle cx='74' cy='24' r='12' fill='#e2e8f0' stroke='#64748b' stroke-width='3'/>
    <path d='M74 16l2.6 5.4 5.9.7-4.4 4.1 1.2 5.8-5.3-2.9-5.3 2.9 1.2-5.8-4.4-4.1 5.9-.7z' fill='#d4a853'/>
</svg>`;

// 残局大师：黄金桂冠环绕的满盘棋局，中央金色星芒
const achievement_art_endgame_master = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='84' rx='24' ry='4' fill='#0f172a' opacity='.1'/>
    <path d='M20 62c-4-15 2-29 13-36' stroke='#b45309' stroke-width='3.4' stroke-linecap='round'/>
    <path d='M76 62c4-15-2-29-13-36' stroke='#b45309' stroke-width='3.4' stroke-linecap='round'/>
    <path d='M17 56c-1 4 0 8 3 11M17 47c-1 4-1 7 0 10M79 56c1 4 0 8-3 11M79 47c1 4 1 7 0 10' stroke='#f6d365' stroke-width='2.6' stroke-linecap='round'/>
    <rect x='27' y='31' width='42' height='42' rx='8' fill='#fffdf3' stroke='#b45309' stroke-width='3.4'/>
    <path d='M41 31v42M55 31v42M27 45h42M27 59h42' stroke='#f3d38a' stroke-width='2.2'/>
    <circle cx='34' cy='38' r='4' fill='#e0a83a'/>
    <circle cx='48' cy='38' r='4' fill='#e0a83a'/>
    <circle cx='34' cy='52' r='4' fill='#e0a83a'/>
    <circle cx='62' cy='52' r='4' fill='#e0a83a'/>
    <circle cx='48' cy='66' r='4' fill='#e0a83a'/>
    <path d='M48 43l3 6.6 7.2.8-5.4 5 1.5 7.1-6.3-3.6-6.3 3.6 1.5-7.1-5.4-5 7.2-.8z' fill='#d4a853' stroke='#b45309' stroke-width='1.4' stroke-linejoin='round'/>
</svg>`;

// 赛事冠军：金色奖杯，杯身正中是四子棋网页图标（白底网格 + 红色四连 + 白色空心子）
const achievement_art_champion = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='86' rx='23' ry='4.5' fill='#0f172a' opacity='.12'/>
    <path d='M74 22h9a2 2 0 0 1 2 2c0 8-4.5 13.5-11 15.5' stroke='#b45309' stroke-width='3.4' stroke-linecap='round'/>
    <path d='M22 22h-9a2 2 0 0 0-2 2c0 8 4.5 13.5 11 15.5' stroke='#b45309' stroke-width='3.4' stroke-linecap='round'/>
    <path d='M24 14h48v16c0 12.5-9.5 22-24 22S24 42.5 24 30z' fill='#fcd97a' stroke='#b45309' stroke-width='3.4'/>
    <path d='M31 18h34' stroke='#fff4cf' stroke-width='2.2' opacity='.9'/>
    <path d='M48 52v9' stroke='#b45309' stroke-width='3.6' stroke-linecap='round'/>
    <rect x='37' y='61' width='22' height='7' rx='3.5' fill='#f5d382' stroke='#b45309' stroke-width='2.6'/>
    <rect x='29' y='68' width='38' height='10' rx='4.5' fill='#fcd97a' stroke='#b45309' stroke-width='2.6'/>
    <g transform='translate(48 33) scale(.9) translate(-48 -36)'>
        <rect x='31' y='21' width='34' height='30' rx='4' fill='#ffffff' stroke='#cbd5e1' stroke-width='2'/>
        <path d='M31 28.5h34M31 36h34M31 43.5h34M39.5 21v30M48 21v30M56.5 21v30' stroke='#e2e8f0' stroke-width='1.4'/>
        <circle cx='35.25' cy='24.75' r='3.1' fill='#dc2626'/>
        <circle cx='43.75' cy='32.25' r='3.1' fill='#dc2626'/>
        <circle cx='52.25' cy='39.75' r='3.1' fill='#dc2626'/>
        <circle cx='60.75' cy='47.25' r='3.1' fill='#dc2626'/>
        <circle cx='43.75' cy='24.75' r='2.7' fill='#ffffff' stroke='#cbd5e1' stroke-width='1.4'/>
        <circle cx='52.25' cy='32.25' r='2.7' fill='#ffffff' stroke='#cbd5e1' stroke-width='1.4'/>
        <circle cx='35.25' cy='39.75' r='2.7' fill='#ffffff' stroke='#cbd5e1' stroke-width='1.4'/>
    </g>
</svg>`;

// 快棋手：金色闪电贯穿三阶棋盘，象征极短时间内完成击溃
const achievement_art_fast_win = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='84' rx='22' ry='4' fill='#0f172a' opacity='.1'/>
    <rect x='26' y='31' width='44' height='44' rx='8' fill='#fffdf3' stroke='#b45309' stroke-width='3.4'/>
    <path d='M44.7 31v44M55.3 31v44M26 45.7h44M26 60.3h44' stroke='#f3d38a' stroke-width='2'/>
    <path d='M50 18l-11 25h9l-5 21 18-28h-10z' fill='#fcd97a' stroke='#b45309' stroke-width='2.4' stroke-linejoin='round'/>
</svg>`;

// 快棋苦手：破裂的秒表，指针无力下垂，底部一道苦相嘴
const achievement_art_fast_loss = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='84' rx='21' ry='4' fill='#0f172a' opacity='.1'/>
    <rect x='38' y='19' width='20' height='6' rx='3' fill='#475569'/>
    <circle cx='48' cy='53' r='25' fill='#e2e8f0' stroke='#475569' stroke-width='4'/>
    <path d='M48 53V36M48 53l-10 8' stroke='#334155' stroke-width='3.4' stroke-linecap='round'/>
    <path d='M56 29l6 12-9 3 8 14' stroke='#94a3b8' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/>
    <circle cx='48' cy='53' r='3' fill='#475569'/>
    <path d='M34 73c3-4 7-4 10 0M52 73c3-4 7-4 10 0' stroke='#64748b' stroke-width='2.4' stroke-linecap='round'/>
</svg>`;

// 黑派：黑色盾旗内嵌一支沙漏，象征填堵一切、以慢取胜
const achievement_art_black_school = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='84' rx='22' ry='4' fill='#0f172a' opacity='.12'/>
    <path d='M48 14l24 8v21c0 15-10 25-24 33-14-8-24-18-24-33V22z' fill='#1e293b' stroke='#0f172a' stroke-width='3.4' stroke-linejoin='round'/>
    <path d='M35 31h26M35 39h26' stroke='#64748b' stroke-width='2.8' stroke-linecap='round'/>
    <circle cx='40' cy='31' r='3.2' fill='#f8fafc'/>
    <circle cx='48' cy='31' r='3.2' fill='#f8fafc'/>
    <circle cx='56' cy='31' r='3.2' fill='#f8fafc'/>
    <circle cx='44' cy='39' r='3.2' fill='#f8fafc'/>
    <circle cx='52' cy='39' r='3.2' fill='#f8fafc'/>
    <path d='M40 52h16M40 68h16' stroke='#d4a853' stroke-width='2.6' stroke-linecap='round'/>
    <path d='M41 52c0 6 7 6 7 8s-7 2-7 8M55 52c0 6-7 6-7 8s7 2 7 8' stroke='#d4a853' stroke-width='2.4' stroke-linejoin='round'/>
</svg>`;

// 保存的信念：被卡榫锁紧的一排棋子，象征将棋局凝聚、固定
const achievement_art_saved_faith = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='82' rx='22' ry='4' fill='#0f172a' opacity='.1'/>
    <rect x='18' y='38' width='60' height='28' rx='8' fill='#fffdf5' stroke='#475569' stroke-width='3.6'/>
    <circle cx='31' cy='52' r='6' fill='#1e293b'/>
    <circle cx='44' cy='52' r='6' fill='#1e293b'/>
    <circle cx='57' cy='52' r='6' fill='#1e293b'/>
    <path d='M66 52h10M20 52h10' stroke='#475569' stroke-width='3' stroke-linecap='round'/>
    <rect x='40' y='18' width='16' height='13' rx='4' fill='#fcd97a' stroke='#b45309' stroke-width='2.6'/>
    <path d='M45 18v-4a3 3 0 0 1 6 0v4' stroke='#b45309' stroke-width='2.4'/>
    <path d='M48 24v4' stroke='#b45309' stroke-width='2.4' stroke-linecap='round'/>
    <path d='M34 72h28M40 78h16' stroke='#94a3b8' stroke-width='2.4' stroke-linecap='round'/>
</svg>`;

// 红派：红色战旗上并排两道急进的箭头，象征热爱快攻
const achievement_art_red_school = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='84' rx='22' ry='4' fill='#0f172a' opacity='.12'/>
    <path d='M29 17h38v43c0 9-9 13-19 17-10-4-19-8-19-17z' fill='#ef4444' stroke='#991b1b' stroke-width='3.2' stroke-linejoin='round'/>
    <path d='M37 31l14 8-14 8' stroke='#fff5f5' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'/>
    <path d='M52 31l14 8-14 8' stroke='#ffe4e6' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' opacity='.75'/>
    <path d='M13 44h9M11 54h7M15 64h8' stroke='#f87171' stroke-width='3' stroke-linecap='round'/>
</svg>`;

// 终结的渴望：荆棘缠绕的黑色立柱，象征那份焦躁的裹缠与簇拥
const achievement_art_terminal_desire = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='84' rx='21' ry='4' fill='#0f172a' opacity='.12'/>
    <rect x='38' y='24' width='20' height='48' rx='10' fill='#1e293b' stroke='#0f172a' stroke-width='3'/>
    <circle cx='48' cy='48' r='5' fill='#fca5a5' opacity='.9'/>
    <path d='M27 32c11 6 11 15 0 21s-9 17 3 21 14-5 24-3 12 11 20 5' stroke='#dc2626' stroke-width='3.2' stroke-linecap='round'/>
    <path d='M65 28c-9 4-11 11-3 17s11 13 3 19-9 11-1 15' stroke='#ef4444' stroke-width='2.6' stroke-linecap='round'/>
    <path d='M31 38l-6-2M29 50l-7 2M36 64l-4 6M61 38l6-2M63 50l7 2M56 64l4 6' stroke='#b91c1c' stroke-width='2.4' stroke-linecap='round'/>
</svg>`;

// 精准且优雅：帷幕拉开后空空如也的棋盘，象征一子不剩的干净收场
const achievement_art_precise_elegant = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='84' rx='23' ry='4' fill='#0f172a' opacity='.1'/>
    <path d='M20 14c6 6 8 14 6 22-2 6-2 11 0 17' stroke='#b91c1c' stroke-width='3.4' stroke-linecap='round'/>
    <path d='M76 14c-6 6-8 14-6 22 2 6 2 11 0 17' stroke='#b91c1c' stroke-width='3.4' stroke-linecap='round'/>
    <rect x='25' y='33' width='46' height='46' rx='8' fill='#fffdf7' stroke='#475569' stroke-width='3.6'/>
    <path d='M40.3 33v46M55.7 33v46M25 48.3h46M25 63.7h46' stroke='#e2d9c2' stroke-width='2.2'/>
    <path d='M48 21l2.6 5.5 6 .7-4.4 4.2 1.1 5.9-5.3-3-5.3 3 1.1-5.9-4.4-4.2 6-.7z' fill='#d4a853'/>
    <path d='M34 85h28' stroke='#94a3b8' stroke-width='2.4' stroke-linecap='round'/>
</svg>`;

// 投影：投影仪把棋子影像打到幕布上，象征第一次换上装扮
const achievement_art_projection = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='86' rx='24' ry='4' fill='#0f172a' opacity='.12'/>
    <rect x='13' y='32' width='21' height='15' rx='5' fill='#e2e8f0' stroke='#475569' stroke-width='3'/>
    <circle cx='31' cy='39.5' r='3.2' fill='#d4a853'/>
    <path d='M34 36l36-15v35L34 44z' fill='#bfdbfe' opacity='.55'/>
    <rect x='64' y='25' width='24' height='33' rx='4' fill='#f8fafc' stroke='#475569' stroke-width='3'/>
    <circle cx='76' cy='41.5' r='6.2' fill='#1e293b'/>
    <path d='M13 57h21' stroke='#94a3b8' stroke-width='2.4' stroke-linecap='round'/>
    <path d='M40 24l2 4.4 4.8.5-3.6 3.4 1 4.8-4.2-2.5-4.2 2.5 1-4.8-3.6-3.4 4.8-.5z' fill='#d4a853'/>
</svg>`;

// 交织的投影：多台投影仪的光束相互交错，象征收藏多种装扮
const achievement_art_woven_projection = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='86' rx='26' ry='4' fill='#0f172a' opacity='.12'/>
    <rect x='10' y='27' width='16' height='12' rx='4' fill='#e2e8f0' stroke='#475569' stroke-width='2.6'/>
    <path d='M24 30l30-7v18l-30 5z' fill='#93c5fd' opacity='.55'/>
    <rect x='10' y='55' width='16' height='12' rx='4' fill='#f8fafc' stroke='#475569' stroke-width='2.6'/>
    <path d='M24 58l30 6v18l-30-7z' fill='#f9a8d4' opacity='.45'/>
    <rect x='58' y='23' width='28' height='48' rx='5' fill='#fffdf5' stroke='#b45309' stroke-width='3'/>
    <path d='M68 33l2.2 5 5.5.6-4.1 3.9 1.1 5.5-4.7-2.8-4.7 2.8 1.1-5.5-4.1-3.9 5.5-.6z' fill='#d4a853'/>
    <path d='M64 58h16M68 64h8' stroke='#cbd5e1' stroke-width='2.4' stroke-linecap='round'/>
    <path d='M44 26c8 7 8 37 0 44M51 22c10 9 10 45 0 53' stroke='#60a5fa' stroke-width='2.2' stroke-linecap='round' opacity='.8'/>
</svg>`;

// 填棋盘的胜利：被黑白棋子彻底填满的九宫棋盘，右上角一枚金色徽章
const achievement_art_board_full = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='86' rx='24' ry='4' fill='#0f172a' opacity='.1'/>
    <rect x='18' y='18' width='60' height='60' rx='8' fill='#fffdf3' stroke='#b45309' stroke-width='3.6'/>
    <rect x='21' y='21' width='54' height='54' fill='#dbe3ee'/>
    <circle cx='24' cy='24' r='2.5' fill='#334155'/><circle cx='36' cy='24' r='2.5' fill='#334155'/><circle cx='48' cy='24' r='2.5' fill='#334155'/><circle cx='60' cy='24' r='2.5' fill='#334155'/><circle cx='72' cy='24' r='2.5' fill='#334155'/>
    <circle cx='30' cy='30' r='2.5' fill='#334155'/><circle cx='42' cy='30' r='2.5' fill='#334155'/><circle cx='54' cy='30' r='2.5' fill='#334155'/><circle cx='66' cy='30' r='2.5' fill='#334155'/>
    <circle cx='24' cy='36' r='2.5' fill='#334155'/><circle cx='36' cy='36' r='2.5' fill='#334155'/><circle cx='48' cy='36' r='2.5' fill='#334155'/><circle cx='60' cy='36' r='2.5' fill='#334155'/><circle cx='72' cy='36' r='2.5' fill='#334155'/>
    <circle cx='30' cy='42' r='2.5' fill='#334155'/><circle cx='42' cy='42' r='2.5' fill='#334155'/><circle cx='54' cy='42' r='2.5' fill='#334155'/><circle cx='66' cy='42' r='2.5' fill='#334155'/>
    <circle cx='24' cy='48' r='2.5' fill='#334155'/><circle cx='36' cy='48' r='2.5' fill='#334155'/><circle cx='48' cy='48' r='2.5' fill='#334155'/><circle cx='60' cy='48' r='2.5' fill='#334155'/><circle cx='72' cy='48' r='2.5' fill='#334155'/>
    <circle cx='30' cy='54' r='2.5' fill='#334155'/><circle cx='42' cy='54' r='2.5' fill='#334155'/><circle cx='54' cy='54' r='2.5' fill='#334155'/><circle cx='66' cy='54' r='2.5' fill='#334155'/>
    <circle cx='24' cy='60' r='2.5' fill='#334155'/><circle cx='36' cy='60' r='2.5' fill='#334155'/><circle cx='48' cy='60' r='2.5' fill='#334155'/><circle cx='60' cy='60' r='2.5' fill='#334155'/><circle cx='72' cy='60' r='2.5' fill='#334155'/>
    <circle cx='30' cy='66' r='2.5' fill='#334155'/><circle cx='42' cy='66' r='2.5' fill='#334155'/><circle cx='54' cy='66' r='2.5' fill='#334155'/><circle cx='66' cy='66' r='2.5' fill='#334155'/>
    <circle cx='24' cy='72' r='2.5' fill='#334155'/><circle cx='36' cy='72' r='2.5' fill='#334155'/><circle cx='48' cy='72' r='2.5' fill='#334155'/><circle cx='60' cy='72' r='2.5' fill='#334155'/><circle cx='72' cy='72' r='2.5' fill='#334155'/>
    <path d='M27 21v54M33 21v54M39 21v54M45 21v54M51 21v54M57 21v54M63 21v54M69 21v54M21 27h54M21 33h54M21 39h54M21 45h54M21 51h54M21 57h54M21 63h54M21 69h54' stroke='#ffffff' stroke-width='1.1' opacity='.85'/>
    <circle cx='75' cy='19' r='11' fill='#fcd97a' stroke='#b45309' stroke-width='3'/>
    <path d='M75 10.6l2.5 5.1 5.6.7-4.1 3.9 1.1 5.5-5.1-2.8-5.1 2.8 1.1-5.5-4.1-3.9 5.6-.7z' fill='#b45309'/>
</svg>`;

// 必胜的速度：银色秒表配上速度线，表盘指针已冲过顶点
const achievement_art_speed_win = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='84' rx='21' ry='4' fill='#0f172a' opacity='.1'/>
    <rect x='38' y='22' width='20' height='6' rx='3' fill='#475569'/>
    <circle cx='48' cy='52' r='24' fill='#eef2f7' stroke='#475569' stroke-width='3.4'/>
    <path d='M48 52V35M48 52l11 7' stroke='#334155' stroke-width='3.2' stroke-linecap='round'/>
    <circle cx='48' cy='52' r='3' fill='#334155'/>
    <path d='M29 42l-9-5M27 52H15M28 62l-8 5' stroke='#94a3b8' stroke-width='2.8' stroke-linecap='round'/>
    <path d='M60 36c6 3 9 8 10 13' stroke='#cbd5e1' stroke-width='2.6' stroke-linecap='round'/>
    <path d='M70 19l2.4 5 5.5.6-4.1 3.8 1.1 5.5-4.9-2.9-4.9 2.9 1.1-5.5-4.1-3.8 5.5-.6z' fill='#94a3b8'/>
</svg>`;

// 必胜的神速：金色秒表，指针化作闪电，两侧速度线拉满
const achievement_art_speed_blitz = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='84' rx='21' ry='4' fill='#0f172a' opacity='.1'/>
    <rect x='38' y='22' width='20' height='6' rx='3' fill='#b45309'/>
    <circle cx='48' cy='52' r='24' fill='#fffdf3' stroke='#b45309' stroke-width='3.4'/>
    <path d='M26 42l-11-7M23 53H11M25 63l-10 8' stroke='#f6c453' stroke-width='2.8' stroke-linecap='round'/>
    <path d='M48 51l9-15 2 8 6-4-9 16-2-8z' fill='#fcd97a' stroke='#b45309' stroke-width='2' stroke-linejoin='round'/>
    <circle cx='48' cy='52' r='3' fill='#b45309'/>
    <path d='M60 36c6 3 9 8 10 13' stroke='#f0c36a' stroke-width='2.6' stroke-linecap='round'/>
    <path d='M73 20l2.4 5 5.5.6-4.1 3.8 1.1 5.5-4.9-2.9-4.9 2.9 1.1-5.5-4.1-3.8 5.5-.6z' fill='#d4a853'/>
</svg>`;

// 你还欠我管血：输血管被抽空，右上角金币刻着负号，象征血量被打成负数
const achievement_art_owed_blood = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='86' rx='21' ry='4' fill='#0f172a' opacity='.12'/>
    <rect x='30' y='13' width='36' height='34' rx='7' fill='#ef4444' stroke='#991b1b' stroke-width='3'/>
    <path d='M38 21h20M38 28h20' stroke='#fecaca' stroke-width='2' opacity='.55'/>
    <path d='M48 47v13' stroke='#991b1b' stroke-width='3'/>
    <rect x='42' y='60' width='12' height='21' rx='6' fill='#fee2e2' stroke='#991b1b' stroke-width='2.6'/>
    <path d='M42 70h12' stroke='#991b1b' stroke-width='2'/>
    <circle cx='48' cy='76' r='3.2' fill='#ef4444'/>
    <circle cx='76' cy='21' r='11' fill='#fcd97a' stroke='#b45309' stroke-width='2.6'/>
    <path d='M71 21h10' stroke='#b45309' stroke-width='3' stroke-linecap='round'/>
</svg>`;

// 命悬一线：细丝吊着一颗将坠的心，心旁只剩最后一格血光
const achievement_art_one_hp_win = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='87' rx='22' ry='4' fill='#0f172a' opacity='.12'/>
    <path d='M48 12v19' stroke='#94a3b8' stroke-width='2' stroke-linecap='round' stroke-dasharray='4 3'/>
    <path d='M48 31c-9 0-17 7-17 17 0 12 12 20 17 26 5-6 17-14 17-26 0-10-8-17-17-17z' fill='#fee2e2' stroke='#b91c1c' stroke-width='3' stroke-linejoin='round'/>
    <path d='M48 38c-4 3-6 7-6 12 0 6 4 10 6 13 2-3 6-7 6-13 0-5-2-9-6-12z' fill='#ef4444' opacity='.85'/>
    <path d='M36 66h24' stroke='#f87171' stroke-width='2.4' stroke-linecap='round' opacity='.7'/>
    <circle cx='77' cy='26' r='11' fill='#fff7ed' stroke='#b45309' stroke-width='2.6'/>
    <path d='M74 20v12M70 22l4-2' stroke='#b45309' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round'/>
    <path d='M26 32l-5-4M21 46l-6-1M30 68l-4 5M66 70l4 5' stroke='#f87171' stroke-width='2.4' stroke-linecap='round'/>
</svg>`;

// 草神的膨胀：一排双草棋子向外膨胀，草叶成双成对
const achievement_art_grass_expansion = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='88' rx='27' ry='4' fill='#0f172a' opacity='.1'/>
    <circle cx='48' cy='60' r='27' stroke='#86efac' stroke-width='2.4' stroke-dasharray='5 4' opacity='.8'/>
    <rect x='9' y='60' width='78' height='24' rx='8' fill='#f0fdf4' stroke='#166534' stroke-width='3'/>
    <path d='M28.5 60v24M47.5 60v24M66.5 60v24' stroke='#bbf7d0' stroke-width='2'/>
    <g fill='#1e293b'>
        <circle cx='28.5' cy='72' r='6.5'/>
        <circle cx='47.5' cy='72' r='6.5'/>
        <circle cx='66.5' cy='72' r='6.5'/>
        <circle cx='85' cy='72' r='6.5'/>
    </g>
    <g stroke='#15803d' stroke-width='1.8' fill='#4ade80' stroke-linejoin='round'>
        <path d='M28.5 64c-5-4-7-9-6-14 5 1 8 5 8 10z'/><path d='M28.5 64c5-4 7-9 6-14-5 1-8 5-8 10z'/>
        <path d='M47.5 64c-5-4-7-9-6-14 5 1 8 5 8 10z'/><path d='M47.5 64c5-4 7-9 6-14-5 1-8 5-8 10z'/>
        <path d='M66.5 64c-5-4-7-9-6-14 5 1 8 5 8 10z'/><path d='M66.5 64c5-4 7-9 6-14-5 1-8 5-8 10z'/>
        <path d='M85 64c-5-4-7-9-6-14 5 1 8 5 8 10z'/><path d='M85 64c5-4 7-9 6-14-5 1-8 5-8 10z'/>
    </g>
    <path d='M13 38l-4 6M83 38l4 6M48 24v8' stroke='#22c55e' stroke-width='2.6' stroke-linecap='round'/>
</svg>`;

// 草神的过载：十片草叶从过载核心炸开，底部能量条压进红区
const achievement_art_grass_overload = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='88' rx='25' ry='4' fill='#0f172a' opacity='.12'/>
    <circle cx='48' cy='42' r='17' fill='#fef3c7' stroke='#b45309' stroke-width='3'/>
    <path d='M31 42c5-7 10-10 17-10s12 3 17 10c-5 7-10 10-17 10s-12-3-17-10z' fill='#fcd97a' opacity='.5'/>
    <g stroke='#166534' stroke-width='1.6' fill='#4ade80' stroke-linejoin='round'>
        <path d='M48 42c-2-7 0-14 4-19 3 5 3 12 0 18z'/>
        <path d='M48 42c-2-7 0-14 4-19 3 5 3 12 0 18z' transform='rotate(36 48 42)'/>
        <path d='M48 42c-2-7 0-14 4-19 3 5 3 12 0 18z' transform='rotate(72 48 42)' fill='#22c55e'/>
        <path d='M48 42c-2-7 0-14 4-19 3 5 3 12 0 18z' transform='rotate(108 48 42)'/>
        <path d='M48 42c-2-7 0-14 4-19 3 5 3 12 0 18z' transform='rotate(144 48 42)' fill='#22c55e'/>
        <path d='M48 42c-2-7 0-14 4-19 3 5 3 12 0 18z' transform='rotate(180 48 42)'/>
        <path d='M48 42c-2-7 0-14 4-19 3 5 3 12 0 18z' transform='rotate(216 48 42)' fill='#22c55e'/>
        <path d='M48 42c-2-7 0-14 4-19 3 5 3 12 0 18z' transform='rotate(252 48 42)'/>
        <path d='M48 42c-2-7 0-14 4-19 3 5 3 12 0 18z' transform='rotate(288 48 42)' fill='#22c55e'/>
        <path d='M48 42c-2-7 0-14 4-19 3 5 3 12 0 18z' transform='rotate(324 48 42)'/>
    </g>
    <circle cx='48' cy='42' r='5' fill='#ef4444' stroke='#991b1b' stroke-width='2'/>
    <rect x='16' y='70' width='64' height='13' rx='6.5' fill='#fee2e2' stroke='#991b1b' stroke-width='2.4'/>
    <rect x='53' y='72.5' width='25' height='8' rx='4' fill='#ef4444'/>
    <path d='M72 66l7 7M62 26l-5-6M78 30l5-7' stroke='#dc2626' stroke-width='2.6' stroke-linecap='round'/>
</svg>`;

// 爆破新手：引信点燃的小型炸弹，火星四溅（铜）
const achievement_art_nuke_rookie = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='44' cy='84' rx='19' ry='4' fill='#0f172a' opacity='.1'/>
    <circle cx='42' cy='60' r='20' fill='#78350f' stroke='#92400e' stroke-width='3.4'/>
    <path d='M35 56c4-3 10-4 14-2' stroke='#b45309' stroke-width='2.4' stroke-linecap='round'/>
    <path d='M55 46c5-7 10-9 14-6' stroke='#64748b' stroke-width='3' stroke-linecap='round'/>
    <circle cx='70' cy='38' r='3.4' fill='#fcd34d'/>
    <path d='M70 32l2-6M75 42l6-2M67 41l-4 4' stroke='#f59e0b' stroke-width='2.4' stroke-linecap='round'/>
</svg>`;

// 爆破高手：带冲击波环的中型炸弹，银灰配色
const achievement_art_nuke_adept = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='42' cy='86' rx='20' ry='4' fill='#0f172a' opacity='.1'/>
    <circle cx='40' cy='60' r='22' fill='#334155' stroke='#475569' stroke-width='3.4'/>
    <circle cx='33' cy='52' r='6' fill='#94a3b8' opacity='.35'/>
    <path d='M55 46c5-7 10-9 14-6' stroke='#64748b' stroke-width='3' stroke-linecap='round'/>
    <circle cx='69' cy='38' r='3.2' fill='#e2e8f0' stroke='#94a3b8' stroke-width='1.6'/>
    <path d='M66 51c5 4 7 10 5 16M72 47c7 5 10 13 7 21' stroke='#94a3b8' stroke-width='2.4' stroke-linecap='round'/>
    <path d='M74 22l2.4 5 5.5.6-4.1 3.8 1.1 5.5-4.9-2.9-4.9 2.9 1.1-5.5-4.1-3.8 5.5-.6z' fill='#94a3b8'/>
</svg>`;

// 爆破大师：金色蘑菇云与地面冲击波（金）
const achievement_art_nuke_master = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <path d='M38 50h20l7 28H31z' fill='#f6c453' stroke='#b45309' stroke-width='2.6'/>
    <circle cx='33' cy='38' r='12' fill='#fcd97a' stroke='#b45309' stroke-width='2.6'/>
    <circle cx='48' cy='30' r='14' fill='#fde68a' stroke='#b45309' stroke-width='2.6'/>
    <circle cx='63' cy='38' r='12' fill='#fcd97a' stroke='#b45309' stroke-width='2.6'/>
    <path d='M20 82c9-4 47-4 56 0' stroke='#eab308' stroke-width='2.8' stroke-linecap='round'/>
    <path d='M24 88c8-3 40-3 48 0' stroke='#f6c453' stroke-width='2.4' stroke-linecap='round' opacity='.8'/>
    <path d='M73 20l2.4 5 5.5.6-4.1 3.8 1.1 5.5-4.9-2.9-4.9 2.9 1.1-5.5-4.1-3.8 5.5-.6z' fill='#d4a853'/>
</svg>`;

// 击坠「神明」：金色神眼被雷矢贯穿，眼环碎裂、金屑坠落（隐藏成就）
const achievement_art_slay_deity = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='88' rx='24' ry='4' fill='#0f172a' opacity='.12'/>
    <circle cx='48' cy='38' r='21' fill='#fffdf3' stroke='#b45309' stroke-width='3.2'/>
    <path d='M27 38c6-9 13-13 21-13s15 4 21 13c-6 9-13 13-21 13s-15-4-21-13z' fill='#f6c453' stroke='#b45309' stroke-width='2.2' stroke-linejoin='round'/>
    <circle cx='48' cy='38' r='7' fill='#0f172a'/>
    <circle cx='51' cy='35' r='2.4' fill='#fffdf3'/>
    <path d='M48 15l-3 9 5 3-4 9' stroke='#0f172a' stroke-width='2.4' stroke-linejoin='round' stroke-linecap='round'/>
    <path d='M72 6l-8 16h6l-5 14 14-20h-7l7-10z' fill='#fcd97a' stroke='#b45309' stroke-width='2' stroke-linejoin='round'/>
    <path d='M30 66l-6 10M44 70l-3 11M60 66l7 9M72 58l6 5' stroke='#f6c453' stroke-width='2.8' stroke-linecap='round'/>
    <circle cx='21' cy='60' r='2.4' fill='#fcd97a'/>
    <circle cx='63' cy='80' r='2' fill='#fcd97a'/>
    <circle cx='78' cy='50' r='2.2' fill='#fcd97a'/>
</svg>`;

// 焚毁「文明」：金色神殿在烈焰中崩塌，火星四溅（隐藏成就）
const achievement_art_burn_civilization = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='88' rx='27' ry='4' fill='#0f172a' opacity='.12'/>
    <path d='M18 42L48 20l30 22z' fill='#f6c453' stroke='#b45309' stroke-width='2.8' stroke-linejoin='round'/>
    <path d='M26 33l22-14 22 14' stroke='#b45309' stroke-width='2' stroke-linejoin='round' opacity='.65'/>
    <path d='M31 42l6-9M52 33l7 9M40 26l5 7' stroke='#b45309' stroke-width='2' stroke-linecap='round' opacity='.55'/>
    <rect x='20' y='43' width='56' height='6' rx='2.4' fill='#fcd97a' stroke='#b45309' stroke-width='2'/>
    <rect x='25' y='49' width='9' height='30' rx='2.6' fill='#fcd97a' stroke='#b45309' stroke-width='2'/>
    <rect x='43' y='49' width='9' height='30' rx='2.6' fill='#fcd97a' stroke='#b45309' stroke-width='2'/>
    <rect x='61' y='49' width='9' height='30' rx='2.6' fill='#fcd97a' stroke='#b45309' stroke-width='2'/>
    <path d='M18 80h60' stroke='#b45309' stroke-width='3' stroke-linecap='round'/>
    <path d='M29 76c-5-7-5-13-1-19 2 6 5 6 6 1 3 6 3 12 2 18z' fill='#f59e0b' stroke='#b45309' stroke-width='1.8' stroke-linejoin='round'/>
    <path d='M50 78c-6-9-4-18 2-25 2 8 6 9 7 3 4 9 3 16 1 22z' fill='#ea580c' stroke='#92400e' stroke-width='1.8' stroke-linejoin='round'/>
    <path d='M68 78c-4-6-4-12 0-17 1 5 4 6 5 2 3 6 2 10 0 15z' fill='#fbbf24' stroke='#b45309' stroke-width='1.6' stroke-linejoin='round'/>
    <circle cx='22' cy='30' r='2.2' fill='#fcd34d'/>
    <circle cx='74' cy='26' r='2.6' fill='#fcd34d'/>
    <circle cx='80' cy='40' r='1.8' fill='#fcd34d'/>
    <circle cx='16' cy='46' r='1.8' fill='#fcd34d'/>
</svg>`;

// 湮没「光明」：金色烈阳被黑暗天体吞没，只剩一圈日冕与余烬（隐藏成就）
const achievement_art_erase_light = `<svg viewBox='0 0 96 96' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='48' cy='88' rx='22' ry='4' fill='#0f172a' opacity='.12'/>
    <circle cx='48' cy='46' r='30' stroke='#f6c453' stroke-width='2' opacity='.35'/>
    <path d='M48 6v10M48 76v10M8 46h10M78 46h10M20 18l7 7M69 67l7 7M76 18l-7 7M27 67l-7 7' stroke='#fcd97a' stroke-width='2.6' stroke-linecap='round' opacity='.75'/>
    <circle cx='48' cy='46' r='22' fill='#fcd97a' stroke='#b45309' stroke-width='2.4'/>
    <path d='M48 24a22 22 0 0 0 0 44 22 22 0 0 1 0-44z' fill='#0f172a' opacity='.94'/>
    <path d='M35 29a22 22 0 0 1 26 3' stroke='#fff7d6' stroke-width='3.6' stroke-linecap='round'/>
    <path d='M60 62a22 22 0 0 1-14 7' stroke='#f6c453' stroke-width='2.6' stroke-linecap='round' opacity='.85'/>
    <circle cx='63' cy='55' r='2.4' fill='#fffdf3'/>
    <circle cx='28' cy='62' r='2' fill='#f6c453'/>
    <circle cx='70' cy='35' r='1.8' fill='#f6c453'/>
</svg>`;

// 成就目录（按登记顺序展示）
// rarity 只用于卡片边框与纹理配色：bronze / silver / gold / diamond（隐藏成就专属），不在界面显示文字
const achievement_catalog = [
    {
        'id': 'kindred',
        'name': '志同道合',
        'desc': '首次进入一次真人对局',
        'rarity': 'bronze',
        'icon': 'people',
        'art': achievement_art_kindred,
    },
    {
        'id': 'craftsman',
        'name': '能工智人',
        'desc': '赢过任意难度的 AI（仅登录玩家可获取）',
        'rarity': 'bronze',
        'icon': 'robot',
        'art': achievement_art_craftsman,
    },
    {
        'id': 'first_win',
        'name': '首次',
        'desc': '首次赢下真人对局',
        'rarity': 'bronze',
        'icon': 'flag',
        'art': achievement_art_first,
    },
    {
        'id': 'endgame_rookie',
        'name': '残局新手',
        'desc': '首次赢下 1 场残局',
        'rarity': 'bronze',
        'icon': 'puzzle',
        'art': achievement_art_endgame,
    },
    {
        'id': 'endgame_expert',
        'name': '残局高手',
        'desc': '完成 10 个不同残局的破解',
        'rarity': 'silver',
        'icon': 'puzzle',
        'art': achievement_art_endgame_expert,
        'goal': 10,
        'stat': 'endgame_unique',
    },
    {
        'id': 'endgame_master',
        'name': '残局大师',
        'desc': '完成 100 个不同残局的破解',
        'rarity': 'gold',
        'icon': 'crown',
        'art': achievement_art_endgame_master,
        'goal': 100,
        'stat': 'endgame_unique',
    },
    {
        'id': 'ten_wins',
        'name': '十次',
        'desc': '赢下 10 次真人对局',
        'rarity': 'silver',
        'icon': '10-circle',
        'art': achievement_art_ten,
        'goal': 10,
        'stat': 'online_wins',
    },
    {
        'id': 'hundred_wins',
        'name': '百次',
        'desc': '赢下 100 次真人对局',
        'rarity': 'gold',
        'icon': 'shield',
        'art': achievement_art_hundred,
        'goal': 100,
        'stat': 'online_wins',
    },
    {
        'id': 'master',
        'name': '大师',
        'desc': '赢下 500 次真人对局',
        'rarity': 'gold',
        'icon': 'crown',
        'art': achievement_art_master,
        'goal': 500,
        'stat': 'online_wins',
    },
    {
        'id': 'ai_master',
        'name': 'AI掌控者',
        'desc': '赢下 100 次简单及以上难度 AI',
        'rarity': 'gold',
        'icon': 'cpu',
        'art': achievement_art_ai,
        'goal': 100,
        'stat': 'ai_easy_wins',
    },
    {
        'id': 'fast_win',
        'name': '快棋手',
        'desc': '在 1 分钟内赢下对局（人机 / 在线 / 排位 / 赛事对战）',
        'rarity': 'silver',
        'icon': 'lightning',
        'art': achievement_art_fast_win,
    },
    {
        'id': 'fast_loss',
        'name': '快棋苦手',
        'desc': '在 1 分钟内输掉对局（人机 / 在线 / 排位 / 赛事对战）',
        'rarity': 'bronze',
        'icon': 'stopwatch',
        'art': achievement_art_fast_loss,
    },
    {
        'id': 'black_school',
        'name': '黑派',
        'desc': '在100回合后赢得胜利1次。“那些填堵一切、以慢取胜的棋手用这个名号自称。哪怕这名号并不起源于此。”',
        'rarity': 'silver',
        'icon': 'shield',
        'art': achievement_art_black_school,
        'style': 'slow',
        'style_turns': 100,
    },
    {
        'id': 'saved_faith',
        'name': '保存的信念',
        'desc': '在120回合后赢得胜利1次。“将棋局凝聚、集中，并加以固定。有时不进攻比进攻需要更多的意志与毅力。”',
        'rarity': 'gold',
        'icon': 'lock',
        'art': achievement_art_saved_faith,
        'style': 'slow',
        'style_turns': 120,
    },
    {
        'id': 'red_school',
        'name': '红派',
        'desc': '连续进攻两手棋，并获得胜利。“那些热爱快攻、以快取胜的选手会使用这个名号。哪怕并没有这名号原意中的疯狂。”',
        'rarity': 'silver',
        'icon': 'lightning',
        'art': achievement_art_red_school,
        'style': 'rush',
        'style_streak': 2,
    },
    {
        'id': 'terminal_desire',
        'name': '终结的渴望',
        'desc': '连续进攻三手棋，并获得胜利。“那份欲望焦躁的裹缠、拥簇上来。哪怕要付出代价，也要尽快结束一切。”',
        'rarity': 'gold',
        'icon': 'fire',
        'art': achievement_art_terminal_desire,
        'style': 'rush',
        'style_streak': 3,
    },
    {
        'id': 'precise_elegant',
        'name': '精准且优雅',
        'desc': '获胜时场上没有剩下己方棋子。“到此完场，感谢观看”',
        'rarity': 'gold',
        'icon': 'sparkles',
        'art': achievement_art_precise_elegant,
        'own_board_empty': true,
    },
    {
        'id': 'board_full',
        'name': '填棋盘的胜利',
        'desc': '填满棋盘并获得胜利',
        'rarity': 'gold',
        'icon': 'grid-3x3-gap-fill',
        'art': achievement_art_board_full,
        'board_full': true,
    },
    {
        'id': 'speed_win',
        'name': '必胜的速度',
        'desc': '在 50 回合内获得胜利（人机 / 在线 / 排位 / 赛事对战）',
        'rarity': 'silver',
        'icon': 'stopwatch',
        'art': achievement_art_speed_win,
        'style': 'speed',
        'style_turns': 50,
    },
    {
        'id': 'speed_blitz',
        'name': '必胜的神速',
        'desc': '在 30 回合内获得胜利（人机 / 在线 / 排位 / 赛事对战）',
        'rarity': 'gold',
        'icon': 'lightning',
        'art': achievement_art_speed_blitz,
        'style': 'speed',
        'style_turns': 30,
    },
    {
        'id': 'owed_blood',
        'name': '你还欠我管血',
        'desc': '结算后使对手血量不高于 -6。“这一管血，先记在账上。”',
        'rarity': 'gold',
        'icon': 'droplet-half',
        'art': achievement_art_owed_blood,
    },
    {
        'id': 'nuke_rookie',
        'name': '爆破新手',
        'desc': '打出 7 子以上的核弹（人机 / 在线 / 排位 / 赛事对战）',
        'rarity': 'bronze',
        'icon': 'fire',
        'art': achievement_art_nuke_rookie,
    },
    {
        'id': 'nuke_adept',
        'name': '爆破高手',
        'desc': '打出 12 子以上的核弹（人机 / 在线 / 排位 / 赛事对战）',
        'rarity': 'silver',
        'icon': 'fire',
        'art': achievement_art_nuke_adept,
    },
    {
        'id': 'nuke_master',
        'name': '爆破大师',
        'desc': '打出 18 子以上的核弹（人机 / 在线 / 排位 / 赛事对战）',
        'rarity': 'gold',
        'icon': 'fire',
        'art': achievement_art_nuke_master,
    },
    {
        'id': 'one_hp_win',
        'name': '命悬一线',
        'desc': '获胜时己方血量为 1。“好险好险”',
        'rarity': 'silver',
        'icon': 'droplet-half',
        'art': achievement_art_one_hp_win,
    },
    {
        'id': 'grass_expansion',
        'name': '草神的膨胀',
        'desc': '打出一个全是双草的打。',
        'rarity': 'gold',
        'icon': 'flower',
        'art': achievement_art_grass_expansion,
    },
    {
        'id': 'grass_overload',
        'name': '草神的过载',
        'desc': '在一次攻击中使用至少 10 颗草。',
        'rarity': 'gold',
        'icon': 'fire',
        'art': achievement_art_grass_overload,
    },
    {
        'id': 'projection',
        'name': '投影',
        'desc': '首次购买装扮。“这样的表象不一定能帮到你……但至少，也许你会喜欢？”',
        'rarity': 'bronze',
        'icon': 'easel',
        'art': achievement_art_projection,
    },
    {
        'id': 'woven_projection',
        'name': '交织的投影',
        'desc': '购买 3 种装扮。“你还真的很热衷于它们呢。看来负责设计、纺织与缝制的工作人员们又要忙好一阵子了……”',
        'rarity': 'silver',
        'icon': 'palette',
        'art': achievement_art_woven_projection,
        'goal': 3,
        'stat': 'skins_owned',
    },
    // 隐藏成就：击败玩家社区公认的强手（不在「所有成就」中展示，仅获得后出现在我的成就里）
    {
        'id': 'slay_deity',
        'name': '击坠“神明”',
        'desc': '击败真人选手苏瑾 1 次。此人是玩家社区公认的水平较强的选手，战胜TA实属不易。',
        'rarity': 'diamond',
        'icon': 'lightning',
        'art': achievement_art_slay_deity,
        'hidden': true,
        'foe_uuids': [
            '019dc068-42a6-7000-8c75-5da387765b80', // 苏瑾大魔王
            '019dc908-946c-7000-9bf3-8b1a60879da1', // 尛萌新苏瑾
        ],
    },
    {
        'id': 'burn_civilization',
        'name': '焚毁“文明”',
        'desc': '击败真人选手红颜 1 次。此人是玩家社区公认的水平较强的选手，战胜TA实属不易。',
        'rarity': 'diamond',
        'icon': 'fire',
        'art': achievement_art_burn_civilization,
        'hidden': true,
        'foe_uuids': [
            '019dc06d-cd5f-7000-a68c-8d19a4a133fe', // hongyan
            '019dd831-5f71-7000-876b-7aa22250fb50', // hongyandada
        ],
    },
    {
        'id': 'erase_light',
        'name': '湮没“光明”',
        'desc': '击败真人选手决心 1 次。此人是玩家社区公认的水平较强的选手，战胜TA实属不易。',
        'rarity': 'diamond',
        'icon': 'circle-half',
        'art': achievement_art_erase_light,
        'hidden': true,
        'foe_uuids': [
            '019dc083-209c-7000-b9c1-74e63a305dd6', // 决心
        ],
    },
];

const achievement_default_stats = {
    'online_entered': 0,
    'online_wins': 0,
    'ai_games': 0,
    'ai_wins': 0,
    'ai_easy_wins': 0,
    'endgame_wins': 0,
    // 已破解的不同残局数量（按盘面身份去重）
    'endgame_unique': 0,
    // 已拥有的装扮（皮肤）种类数量
    'skins_owned': 0,
};

const achievement_guest_identity = 'guest';
let achievement_identity_task = null;

// 动态成就（赛事冠军等）：定义随获得记录一起落在本地，不进入固定成就目录
let achievement_custom_defs = {};

/**
 * @description: 生成赛事冠军成就 id（服务端展示柜仅接受小写字母/数字/下划线且 ≤24 位）
 *   同一赛事同一决赛方块 id 稳定不变，天然去重；不同赛事/决赛互不冲突。
 * @param {string} event 赛事名
 * @param {string} node 决赛方块 id
 * @return {string}
 */
const achievement_champion_id = (event, node) => {
    const text = `${event}|${node}`;
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return `champion_${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

/**
 * @description: 从原始记录里刷新动态成就定义缓存（供 achievement_find 同步查询）
 * @param {Object<string, number | Object>} records
 * @return {void}
 */
const achievement_refresh_custom = (records) => {
    achievement_custom_defs = {};
    Object.keys(records || {}).forEach((id) => {
        const value = records[id];
        if (!value || typeof value !== 'object' || !value.name) return;
        achievement_custom_defs[id] = Object.assign({ 'id': id }, value);
    });
};

/**
 * @description: 当前账号标识（登录后为账号 uuid，未登录用 guest）
 * @return {Promise<string>}
 */
const achievement_identity = () => {
    if (achievement_identity_task) return achievement_identity_task;
    const token = typeof window.get_token === 'function' ? window.get_token() : null;
    if (!token) {
        achievement_identity_task = Promise.resolve(achievement_guest_identity);
        return achievement_identity_task;
    }
    achievement_identity_task = Promise.resolve()
        .then(() => window.http_user_info(token))
        .then((info) => (info && info.uuid) ? String(info.uuid) : achievement_guest_identity)
        .catch(() => achievement_guest_identity);
    return achievement_identity_task;
};

const achievement_storage_read = async (prefix, fallback) => {
    try {
        const raw = localStorage.getItem(`${prefix}:${await achievement_identity()}`);
        const data = raw ? JSON.parse(raw) : null;
        return data && typeof data === 'object' ? data : { ...fallback };
    } catch (_) {
        return { ...fallback };
    }
};

const achievement_storage_write = async (prefix, data) => {
    try {
        localStorage.setItem(`${prefix}:${await achievement_identity()}`, JSON.stringify(data));
    } catch (_) {
        // 本地存储不可用时静默失败，不影响主流程
    }
};

/**
 * @description: 是否为动态赛事冠军成就 id
 * @param {string} id
 * @return {boolean}
 */
const achievement_is_champion_id = (id) => String(id || '').indexOf('champion_') === 0;

/**
 * @description: 统一历史冠军记录：稀有度改为钻石、奖杯沿用当前发放样式，其余字段（含获得时间）原样保留
 * @param {Object<string, number | Object>} records
 * @return {boolean} 是否有记录被修正
 */
const achievement_normalize_champions = (records) => {
    let changed = false;
    Object.keys(records || {}).forEach((id) => {
        if (!achievement_is_champion_id(id)) return;
        const value = records[id];
        if (!value || typeof value !== 'object') return;
        if (value.rarity !== 'diamond') { value.rarity = 'diamond'; changed = true; }
        if (!value.champion) { value.champion = true; changed = true; }
        if (value.art !== achievement_art_champion) { value.art = achievement_art_champion; changed = true; }
    });
    return changed;
};

const achievement_records_read = async () => {
    const records = await achievement_storage_read('achievement', {});
    // 旧冠军记录可能残留金色稀有度与旧奖杯美术，读取时静默同步并回写，获得时间不变
    if (achievement_normalize_champions(records)) {
        await achievement_storage_write('achievement', records);
    }
    achievement_refresh_custom(records);
    return records;
};
const achievement_stats_read = () => achievement_storage_read('achievement_stats', achievement_default_stats);

/**
 * @description: 成就目录
 * @return {Array<Object>}
 */
window.achievement_catalog = () => achievement_catalog.slice();

/**
 * @description: 按 id 查询成就定义（含动态赛事冠军；未知冠军 id 返回通用冠军定义）
 * @param {string} id
 * @return {Object | null}
 */
window.achievement_find = (id) => {
    if (!id) return null;
    const builtin = achievement_catalog.find((item) => item && item.id === id);
    if (builtin) return builtin;
    // 冠军成就统一为钻石稀有度，奖杯始终取当前发放样式（旧记录的名称/描述/时间保留）
    if (String(id).indexOf('champion_') === 0) {
        const custom = achievement_custom_defs[id] || {};
        return Object.assign(
            { 'name': '赛事冠军', 'desc': '在赛事中夺得冠军', 'icon': 'trophy' },
            custom,
            { 'id': id, 'rarity': 'diamond', 'art': achievement_art_champion, 'champion': true }
        );
    }
    if (achievement_custom_defs[id]) return Object.assign({}, achievement_custom_defs[id]);
    return null;
};

// ===== 对局风格成就判定 =====

/**
 * @description: 黑派 / 保存的信念 / 红派 / 终结的渴望 的解锁判定
 *   阈值全部取自成就目录的 style 字段，避免规则与文案分散。
 * @param {number} turn_count 对局总回合数（含决胜手）
 * @param {number[]} attack_turns 本方主动发起攻击的回合序号
 * @return {string[]} 本次达成的风格成就 id
 */
const achievement_style_unlocks = (turn_count, attack_turns) => {
    const turns = Math.max(0, Number(turn_count) || 0);
    const attacks = Array.isArray(attack_turns) ? attack_turns : [];
    return achievement_catalog
        .filter((def) => def.style)
        .filter((def) => {
            // 慢棋：对局回合数达到阈值后取胜
            if (def.style === 'slow') return turns >= Number(def.style_turns || 0);
            // 速胜：在阈值回合数内取胜（缺少回合明细时 turns 为 0，不判定）
            if (def.style === 'speed') return turns > 0 && turns <= Number(def.style_turns || 0);
            // 快攻：连续 style_streak 个本方回合都发起进攻
            if (def.style === 'rush') {
                // 连续进攻：同一方相邻两次进攻须落在连续的本方回合上（回合序号相差不超过 2）
                const need = Math.max(2, Number(def.style_streak) || 2);
                let streak = 1;
                for (let index = 1; index < attacks.length; index++) {
                    const prev = Number(attacks[index - 1]);
                    const cur = Number(attacks[index]);
                    if (!Number.isFinite(prev) || !Number.isFinite(cur)) {
                        streak = 1;
                        continue;
                    }
                    const gap = cur - prev;
                    streak = (gap > 0 && gap <= 2) ? streak + 1 : 1;
                    if (streak >= need) return true;
                }
                return false;
            }
            return false;
        })
        .map((def) => def.id);
};

/**
 * @description: 隐藏成就「击败指定选手」判定：按对手 uuid 匹配目录中的 foe_uuids
 *   同一选手的多个身份（如苏瑾 / 红颜的大小号）都登记在 foe_uuids 中。
 * @param {string} foe_uuid 对手账号 uuid
 * @return {string[]} 本次达成的隐藏成就 id
 */
const achievement_foe_unlocks = (foe_uuid) => {
    const uuid = String(foe_uuid || '').trim();
    if (!uuid) return [];
    return achievement_catalog
        .filter((def) => Array.isArray(def.foe_uuids) && def.foe_uuids.includes(uuid))
        .map((def) => def.id);
};

/**
 * @description: 是否已登录
 * @return {boolean}
 */
window.achievement_is_logged_in = () => Boolean(typeof window.get_token === 'function' && window.get_token());

/**
 * @description: 当前账号的原始成就记录（id → 获得时间）
 * @return {Promise<Object<string, number>>}
 */
window.achievement_records = () => achievement_records_read();

/**
 * @description: 当前账号的成就进度统计
 * @return {Promise<Object<string, number>>}
 */
window.achievement_stats = async () => ({ ...achievement_default_stats, ...(await achievement_stats_read()) });

/**
 * @description: 指定成就的进度
 * @param {string} id
 * @return {Promise<{current: number, goal: number} | null>}
 */
window.achievement_progress = async (id) => {
    const def = window.achievement_find(id);
    if (!def || !def.goal || !def.stat) return null;
    const stats = await achievement_stats_read();
    // 达成后不封顶：继续展示达成该条件的实际次数
    return { 'current': Number(stats[def.stat]) || 0, 'goal': def.goal };
};

/**
 * @description: 当前账号已获得的成就（按获得时间倒序）
 * @return {Promise<Array<Object>>}
 */
window.achievement_list = async () => {
    const records = await achievement_records_read();
    const stats = await achievement_stats_read();
    return Object.keys(records)
        .map((id) => {
            const value = records[id];
            // 固定成就记录为毫秒时间戳；动态成就（赛事冠军）记录为对象，可重复获得
            const time = typeof value === 'number' ? value : Number(value && value.time);
            if (!Number.isFinite(time) || time <= 0) return null;

            const def = window.achievement_find(id) || {};
            const dynamic = value && typeof value === 'object' ? value : {};
            const champion = Boolean(dynamic.champion || def.champion || achievement_is_champion_id(id));
            const goal = Number(def.goal) || 0;
            return {
                'id': id,
                'name': dynamic.name || def.name || id,
                'desc': dynamic.desc || def.desc || '',
                'icon': dynamic.icon || def.icon || 'trophy',
                'art': champion ? achievement_art_champion : (dynamic.art || def.art || ''),
                'rarity': champion ? 'diamond' : (dynamic.rarity || def.rarity || 'bronze'),
                'champion': champion,
                'goal': goal,
                'progress': goal ? { 'current': Number(stats[def.stat]) || 0, 'goal': goal } : null,
                'time': time,
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.time - a.time);
};

// ===== 右上角全局提示 =====

/**
 * @description: 注入成就提示样式（同一页面只注入一次）
 * @return {void}
 */
const achievement_ensure_style = () => {
    if (document.getElementById('style_achievement_toast')) return;
    const style = document.createElement('style');
    style.id = 'style_achievement_toast';
    style.textContent = `
.achievement-toasts{position:fixed;top:.75rem;right:.75rem;z-index:1200;display:flex;flex-direction:column;gap:.6rem;width:min(20rem,calc(100vw - 1.5rem));pointer-events:none}
.achievement-toast{pointer-events:auto;cursor:pointer;display:flex;align-items:flex-start;gap:.7rem;padding:.7rem .8rem;background:linear-gradient(135deg,#fffdf5,#fff 45%,#eef4ff);border:1px solid rgba(212,168,83,.55);border-radius:.85rem;box-shadow:0 .6rem 1.6rem rgba(15,23,42,.18),inset 0 1px 0 #fff;opacity:0;transform:translateX(1.2rem) scale(.98);transition:opacity .32s ease,transform .32s ease}
.achievement-toast.show{opacity:1;transform:translateX(0) scale(1)}
.achievement-toast.hide{opacity:0;transform:translateX(1.2rem) scale(.98)}
.achievement-toast-medal{flex:0 0 auto;width:2.6rem;height:2.6rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.35rem;color:#a16207;background:radial-gradient(circle at 30% 25%,#fff3c4,#f6d365 60%,#e0a83a);box-shadow:0 0 0 2px rgba(255,255,255,.9),0 .3rem .8rem rgba(224,168,58,.45);overflow:hidden}
.achievement-toast-medal svg{width:78%;height:78%;display:block}
.achievement-toast-body{min-width:0}
.achievement-toast-label{font-size:.68rem;letter-spacing:.14em;color:#a16207;font-weight:700}
.achievement-toast-name{font-size:.92rem;font-weight:700;color:var(--sl-color-neutral-900);word-break:break-word}
.achievement-toast-desc{margin-top:.1rem;font-size:.74rem;color:var(--sl-color-neutral-600);line-height:1.35;word-break:break-word}
@media (prefers-reduced-motion: reduce){.achievement-toast{transition:none}}
`;
    document.head.appendChild(style);
};

/**
 * @description: 获取（必要时创建）提示容器
 * @return {HTMLElement}
 */
const achievement_toast_container = () => {
    let container = document.getElementById('achievement_toasts');
    if (container) return container;
    container = document.createElement('div');
    container.id = 'achievement_toasts';
    container.className = 'achievement-toasts';
    document.body.appendChild(container);
    return container;
};

/**
 * @description: 右上角弹出获得成就提示
 * @param {{name: string, desc?: string, icon?: string, art?: string}} achievement
 * @return {void}
 */
window.achievement_toast = (achievement) => {
    if (!achievement || !document.body) return;
    achievement_ensure_style();

    const card = document.createElement('div');
    card.className = 'achievement-toast';

    const medal = document.createElement('div');
    medal.className = 'achievement-toast-medal';
    if (achievement.art) medal.innerHTML = achievement.art;
    else {
        const icon = document.createElement('sl-icon');
        icon.name = achievement.icon || 'trophy';
        medal.append(icon);
    }

    const body = document.createElement('div');
    body.className = 'achievement-toast-body';
    const label = document.createElement('div');
    label.className = 'achievement-toast-label';
    label.textContent = '获得成就';
    const name = document.createElement('div');
    name.className = 'achievement-toast-name';
    name.textContent = achievement.name || achievement.id || '未知成就';
    body.append(label, name);

    if (achievement.desc) {
        const desc = document.createElement('div');
        desc.className = 'achievement-toast-desc';
        desc.textContent = achievement.desc;
        body.append(desc);
    }

    card.append(medal, body);
    achievement_toast_container().appendChild(card);

    requestAnimationFrame(() => card.classList.add('show'));

    let removed = false;
    const remove = () => {
        if (removed) return;
        removed = true;
        card.classList.add('hide');
        setTimeout(() => card.remove(), 320);
    };

    card.addEventListener('click', remove);
    setTimeout(remove, 5200);
};

/**
 * @description: 批量解锁成就（已解锁的忽略）
 * @param {Array<string>} ids
 * @return {Promise<Array<string>>} 本次新解锁的成就 id
 */
const achievement_unlock_many = async (ids) => {
    if (!ids || !ids.length) return [];
    const records = await achievement_records_read();
    const unlocked = [];
    ids.forEach((id) => {
        if (!id || records[id]) return;
        records[id] = Date.now();
        unlocked.push(id);
    });
    if (!unlocked.length) return [];

    await achievement_storage_write('achievement', records);
    unlocked.forEach((id) => {
        const def = window.achievement_find(id) || {};
        window.achievement_toast({
            'id': id,
            'name': def.name || id,
            'desc': def.desc || '',
            'icon': def.icon || 'trophy',
            'art': def.art || '',
        });
    });
    return unlocked;
};

/**
 * @description: 解锁成就（首次解锁才记录并弹出全局提示）
 * @param {string} id
 * @return {Promise<boolean>}
 */
window.achievement_unlock = async (id) => {
    const unlocked = await achievement_unlock_many([id]);
    return unlocked.length > 0;
};

/**
 * @description: 授予动态成就（可带自定义名称/描述/美术，可重复获得，不进入固定成就目录）
 * @param {{id: string, name?: string, desc?: string, icon?: string, art?: string, rarity?: string, champion?: boolean, event?: string, node?: string}} item
 * @return {Promise<boolean>} 是否新获得
 */
window.achievement_grant = async (item) => {
    if (!window.achievement_is_logged_in()) return false;
    if (!item || !item.id) return false;

    const records = await achievement_records_read();
    if (records[item.id]) return false;

    const def = window.achievement_find(item.id) || {};
    const record = {
        'time': Date.now(),
        'name': item.name || def.name || item.id,
        'desc': item.desc || def.desc || '',
        'rarity': item.rarity || def.rarity || 'gold',
        'icon': item.icon || def.icon || 'trophy',
        'art': item.art || def.art || achievement_art_champion,
        'champion': Boolean(item.champion || def.champion),
    };
    if (item.event) record.event = String(item.event);
    if (item.node) record.node = String(item.node);

    records[item.id] = record;
    await achievement_storage_write('achievement', records);
    achievement_refresh_custom(records);

    window.achievement_toast({
        'id': item.id,
        'name': record.name,
        'desc': record.desc,
        'icon': record.icon,
        'art': record.art,
    });
    return true;
};

/**
 * @description: 赛事冠军成就（决赛获胜后由对局页调用）
 *   成就名为「赛事名：冠军」，钻石稀有度；同一决赛方块只记一次，不同赛事/不同决赛可累计多个。
 * @param {{event_name?: string, node_id?: string}} args
 * @return {Promise<boolean>}
 */
window.achievement_champion_grant = async ({ event_name, node_id } = {}) => {
    if (!window.achievement_is_logged_in()) return false;

    const event = String(event_name == null ? '' : event_name).trim() || '赛事';
    const node = String(node_id == null ? '' : node_id).trim();
    const id = achievement_champion_id(event, node);

    return window.achievement_grant({
        'id': id,
        'name': `${event}：冠军`,
        'desc': `赢得「${event}」决赛，夺得冠军`,
        'rarity': 'diamond',
        'icon': 'trophy',
        'art': achievement_art_champion,
        'champion': true,
        'event': event,
        'node': node,
    });
};

// ===== 历史赛事冠军奖杯补发 =====
// 数据来源：赛事冠军总表（正赛 / 节日赛 / 周赛）。只补冠军，不补亚军及以后名次。
// 按账号 uuid 精确匹配，node 使用稳定的历史标识，保证同一冠军重复打开页面不会重复发放。
const achievement_champion_history = [
    {
        'uuid': '019dc083-209c-7000-b9c1-74e63a305dd6', // 决心
        'titles': [
            ['红颜杯——第一届正赛', 'history-zhensai-1'],
            ['红颜杯——国庆友谊赛', 'history-festival-1'],
            ['红颜杯——第一届周赛', 'history-week-1'],
            ['红颜杯——第五届周赛', 'history-week-5'],
        ],
    },
    {
        'uuid': '019dc068-42a6-7000-8c75-5da387765b80', // 苏瑾大魔王
        'titles': [
            ['红颜杯——第二届正赛', 'history-zhensai-2'],
            ['红颜杯——第三届正赛', 'history-zhensai-3'],
            ['红颜杯——冠军表演赛', 'history-showcase-1'],
            ['红颜杯——第十二届周赛', 'history-week-12'],
        ],
    },
    {
        'uuid': '019dca10-2de0-7000-b972-c2c8fcc3202b', // mouse potato
        'titles': [
            ['红颜杯——第三届周赛', 'history-week-3'],
        ],
    },
    {
        'uuid': '019dc21f-0e5c-7000-9831-3e23a46995e3', // 歌灯行
        'titles': [
            ['红颜杯——第九届周赛', 'history-week-9'],
        ],
    },
    {
        'uuid': '019f7542-f46a-7ff3-921a-4e61a9beaf91', // 折刀x
        'titles': [
            ['红颜杯——第十五届周赛', 'history-week-15'],
        ],
    },
    {
        'uuid': '019dc295-5916-7000-a7fd-589595e68e31', // 斯莱米·斯洛提尔
        'titles': [
            ['红颜杯——第十六届周赛', 'history-week-16'],
        ],
    },
    {
        'uuid': '019f28b8-2501-71e0-b2b5-3ad541c938ca', // 天牛
        'titles': [
            ['红颜杯——第十七届周赛', 'history-week-17'],
            ['红颜杯——第十九届周赛', 'history-week-19'],
            ['红颜杯——第二十一届周赛', 'history-week-21'],
        ],
    },
    {
        'uuid': '019de16f-f482-7000-905b-40aead478125', // Longx
        'titles': [
            ['红颜杯——第十八届周赛', 'history-week-18'],
        ],
    },
    {
        'uuid': '01a0944b-b9d0-7b0b-9358-ceb860a00941', // 歌于途
        'titles': [
            ['红颜杯——第二十届周赛', 'history-week-20'],
        ],
    },
    {
        'uuid': '019dee60-736d-7000-ba34-8c1e7db5a11e', // 红羽
        'titles': [
            ['红颜杯——第二十二届周赛', 'history-week-22'],
        ],
    },
    {
        'uuid': '019dc067-f29c-7000-9ad3-90a341d740ee', // 吃饱的下棋猫（下棋猫）
        'titles': [
            ['红颜杯——五一假期赛', 'history-festival-2'],
            ['红颜杯——第六届周赛', 'history-week-6'],
        ],
    },
    {
        'uuid': '019dc098-cc46-7000-9fe1-0da37000032c', // 吃饱的下棋猫（下棋猫）
        'titles': [
            ['红颜杯——五一假期赛', 'history-festival-2'],
            ['红颜杯——第六届周赛', 'history-week-6'],
        ],
    },
    {
        'uuid': '019e54dd-a861-7de2-8069-60c73cb33453', // 吃饱的下棋猫（下棋猫）
        'titles': [
            ['红颜杯——五一假期赛', 'history-festival-2'],
            ['红颜杯——第六届周赛', 'history-week-6'],
        ],
    },
    {
        'uuid': '019dc082-da11-7000-958f-8e638372d11e', // 好想对羽毛笔发电（洛影）
        'titles': [
            ['红颜杯——第二届周赛', 'history-week-2'],
            ['红颜杯——第四届周赛', 'history-week-4'],
        ],
    },
    {
        'uuid': '019de415-c704-7000-9619-f0ee4e5fe5fc', // 泠（愚歌）
        'titles': [
            ['红颜杯——第七届周赛', 'history-week-7'],
            ['红颜杯——第二十三届周赛', 'history-week-23'],
        ],
    },
    {
        'uuid': '019dc9ac-5499-7000-b5e6-ee72455029b7', // 下不过阿尔玛（劳斯）
        'titles': [
            ['红颜杯——第八届周赛', 'history-week-8'],
        ],
    },
    {
        'uuid': '019dc219-b5d1-7000-b7b1-88713986f2b2', // 5heng_10ve_H0ngY4n（生蚝）
        'titles': [
            ['红颜杯——第十届周赛', 'history-week-10'],
            ['红颜杯——第十三届周赛', 'history-week-13'],
            ['红颜杯——第十四届周赛', 'history-week-14'],
        ],
    },
    {
        'uuid': '019dc9bb-7ba0-7000-a92d-275c1d927fb8', // 可爱的蕾酱（reto）
        'titles': [
            ['红颜杯——国庆赛', 'history-festival-3'],
            ['红颜杯——第十一届周赛', 'history-week-11'],
        ],
    },
];

/**
 * @description: 补齐当前登录账号的历史赛事冠军奖杯（只补该账号名下的冠军）
 * @return {Promise<number>} 本次新补发的奖杯数量
 */
window.achievement_champion_history_sync = async () => {
    if (!window.achievement_is_logged_in()) return 0;

    const uuid = String(await achievement_identity() || '');
    const history = achievement_champion_history.find((item) => item.uuid === uuid);
    if (!history) return 0;

    let count = 0;
    for (const [event, node] of history.titles) {
        if (await window.achievement_champion_grant({ 'event_name': event, 'node_id': node })) count += 1;
    }
    return count;
};

/**
 * @description: 装扮拥有数量（支持外观 id 列表或数量）
 * @param {string[] | number} skins
 * @return {number}
 */
const achievement_skins_count = (skins) => {
    if (Array.isArray(skins)) return new Set(skins.filter((id) => typeof id === 'string' && id)).size;
    return Math.max(0, Math.trunc(Number(skins) || 0));
};

/**
 * @description: 上报成就事件（所有成就均只对登录玩家生效）
 * @param {'online_enter' | 'online_win' | 'ai_game' | 'ai_win' | 'fast_win' | 'fast_loss' | 'endgame_win' | 'skin_owned' | 'nuke_launch' | 'grass_attack'} event
 * @param {{easy_or_above?: boolean, endgame_id?: string, turn_count?: number, attack_turns?: number[], own_board_empty?: boolean, board_full?: boolean, own_hp?: number, foe_hp?: number, foe_uuid?: string, size?: number, grass?: number, all_double?: boolean, skins?: string[] | number}} [detail]
 * @return {Promise<void>}
 */
window.achievement_event = async (event, detail = {}) => {
    if (!window.achievement_is_logged_in()) return;

    const stats = { ...achievement_default_stats, ...(await achievement_stats_read()) };
    const unlock_ids = [];

    if (event === 'online_enter') {
        stats.online_entered += 1;
        unlock_ids.push('kindred');
    } else if (event === 'online_win') {
        stats.online_wins += 1;
        unlock_ids.push('first_win');
        if (stats.online_wins >= 10) unlock_ids.push('ten_wins');
        if (stats.online_wins >= 100) unlock_ids.push('hundred_wins');
        if (stats.online_wins >= 500) unlock_ids.push('master');
        // 对局风格成就：需要本局回合数与进攻回合序列，缺失时自然不满足
        unlock_ids.push(...achievement_style_unlocks(detail.turn_count, detail.attack_turns));
        // 精准且优雅：获胜时棋盘上已无己方棋子
        if (detail.own_board_empty) unlock_ids.push('precise_elegant');
        // 填棋盘的胜利：获胜时棋盘已被棋子填满
        if (detail.board_full) unlock_ids.push('board_full');
        // 命悬一线：获胜时己方血量恰好为 1
        if (Number(detail.own_hp) === 1) unlock_ids.push('one_hp_win');
        // 你还欠我管血：结算后对手血量不高于 -6
        if (Number.isFinite(Number(detail.foe_hp)) && Number(detail.foe_hp) <= -6) unlock_ids.push('owed_blood');
        // 隐藏成就：击败指定选手（房间 / 排位 / 赛事三种真人对局都会带对手 uuid）
        unlock_ids.push(...achievement_foe_unlocks(detail.foe_uuid));
    } else if (event === 'nuke_launch') {
        // 爆破成就：按本次升变涉及的棋子数（核弹规模）判定，与胜负无关
        const size = Math.trunc(Number(detail.size) || 0);
        if (size >= 7) unlock_ids.push('nuke_rookie');
        if (size >= 12) unlock_ids.push('nuke_adept');
        if (size >= 18) unlock_ids.push('nuke_master');
    } else if (event === 'grass_attack') {
        // 草神系列：按本方单次升变（一次攻击）中棋子的草量与是否全部双草判定
        const size = Math.trunc(Number(detail.size) || 0);
        const grass = Math.trunc(Number(detail.grass) || 0);
        if (size > 0 && detail.all_double) unlock_ids.push('grass_expansion');
        if (grass >= 10) unlock_ids.push('grass_overload');
    } else if (event === 'ai_game') {
        stats.ai_games += 1;
        window.http_user_stats_update(window.get_token(), stats.ai_games);
    } else if (event === 'ai_win') {
        stats.ai_wins += 1;
        stats.ai_games += 1;
        window.http_user_stats_update(window.get_token(), stats.ai_games);
        unlock_ids.push('craftsman');
        if (detail.easy_or_above) {
            stats.ai_easy_wins += 1;
            if (stats.ai_easy_wins >= 100) unlock_ids.push('ai_master');
        }
        unlock_ids.push(...achievement_style_unlocks(detail.turn_count, detail.attack_turns));
        // 精准且优雅：获胜时棋盘上已无己方棋子（人机同样计入）
        if (detail.own_board_empty) unlock_ids.push('precise_elegant');
        // 填棋盘的胜利：获胜时棋盘已被棋子填满（人机同样计入）
        if (detail.board_full) unlock_ids.push('board_full');
        // 命悬一线：获胜时己方血量恰好为 1（人机同样计入）
        if (Number(detail.own_hp) === 1) unlock_ids.push('one_hp_win');
        // 你还欠我管血：结算后对手血量不高于 -6（人机同样计入）
        if (Number.isFinite(Number(detail.foe_hp)) && Number(detail.foe_hp) <= -6) unlock_ids.push('owed_blood');
    } else if (event === 'fast_win') {
        // 快棋手：仅在 1 分钟内赢下对局时调用（由人机 / 在线 / 排位 / 赛事对局页触发）
        unlock_ids.push('fast_win');
    } else if (event === 'fast_loss') {
        // 快棋苦手：仅在 1 分钟内输掉对局时调用
        unlock_ids.push('fast_loss');
    } else if (event === 'endgame_win') {
        stats.endgame_wins += 1;
        // 不同残局按盘面身份去重：同一残局重复破解只计一次
        const endgame_id = String(detail.endgame_id || '').trim();
        if (endgame_id) {
            const clears = await achievement_storage_read('achievement_endgame_clears', {});
            if (!clears[endgame_id]) {
                clears[endgame_id] = Date.now();
                await achievement_storage_write('achievement_endgame_clears', clears);
            }
            stats.endgame_unique = Object.keys(clears).length;
        }
        unlock_ids.push('endgame_rookie');
        if (stats.endgame_unique >= 10) unlock_ids.push('endgame_expert');
        if (stats.endgame_unique >= 100) unlock_ids.push('endgame_master');
        // 命悬一线：残局破解成功时己方（黑方）血量恰好为 1
        if (Number(detail.own_hp) === 1) unlock_ids.push('one_hp_win');
    } else if (event === 'skin_owned') {
        // 装扮成就：以账号实际拥有的外观种类为准（列表或数量），不依赖购买动作；统计取最大值避免换设备后回退
        const owned = achievement_skins_count(detail.skins);
        stats.skins_owned = Math.max(Number(stats.skins_owned) || 0, owned);
        if (stats.skins_owned >= 1) unlock_ids.push('projection');
        if (stats.skins_owned >= 3) unlock_ids.push('woven_projection');
    } else {
        return;
    }

    await achievement_storage_write('achievement_stats', stats);
    await achievement_unlock_many(unlock_ids);
};

/**
 * @description: 按账号实际拥有的外观同步装扮成就（以服务端拥有的外观列表为准，不依赖购买动作）
 * @return {Promise<void>}
 */
window.achievement_owned_skins_check = async () => {
    if (!window.achievement_is_logged_in()) return;
    const token = typeof window.get_token === 'function' ? window.get_token() : null;
    if (!token || typeof window.http_user_info !== 'function') return;

    let info = null;
    try {
        info = await window.http_user_info(token);
    } catch (_) {
        return;
    }
    const skins = info && Array.isArray(info.skins) ? info.skins : [];
    await window.achievement_event('skin_owned', { 'skins': skins });
};

/**
 * @description: 读取当前账号展示的成就 id（最多 3 个，未登录返回空数组）
 * @return {Promise<Array<string>>}
 */
window.achievement_showcase = async () => {
    const token = typeof window.get_token === 'function' ? window.get_token() : null;
    if (!token) return [];
    try {
        const info = await window.http_user_info(token);
        return Array.isArray(info && info.showcase) ? info.showcase.slice(0, 3) : [];
    } catch (_) {
        return [];
    }
};

/**
 * @description: 保存当前账号展示的成就 id（最多 3 个，空数组表示清空）
 * @param {Array<string>} ids
 * @return {Promise<boolean>}
 */
window.achievement_showcase_set = async (ids) => {
    const token = typeof window.get_token === 'function' ? window.get_token() : null;
    if (!token) return false;
    const result = await window.http_user_stats_update(token, null, Array.isArray(ids) ? ids.slice(0, 3) : []);
    return Boolean(result);
};
