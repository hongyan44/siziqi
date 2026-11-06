/*
 * 剧情角色图片系统：后端角色/表情存储与接口、角色管理页、剧情播放页表情框、管理员行式编辑器。
 * 静态回归：校验关键实现片段仍存在（改动被误删时立即失败）。
 * 运行： bun tmp/story-role-image.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const web = path.resolve(__dirname, '..');
const server = path.resolve(__dirname, '../../4ascend-online');

const readWeb = (relative) => fs.readFileSync(path.resolve(web, relative), 'utf8');
const readServer = (relative) => fs.readFileSync(path.resolve(server, relative), 'utf8');
const has = (text, needle, label) => assert.ok(text.includes(needle), `${label} 应包含：${needle}`);

// 1) 后端存储模块：角色表 + 表情表（支持新增 / 更换代表图 / 删除角色），单图上限 8MB
{
    const header = readServer('src/manager/Story.h');
    ['query_characters', 'add_character', 'add_expression', 'exist_character_name', 'exist_character_id', 'exist_expression_name',
        'update_character_rep', 'update_expression_image', 'delete_character', 'delete_expression']
        .forEach((name) => has(header, name, 'Manager::Story 头文件'));
    has(header, '8 * 1024 * 1024', 'Manager::Story 头文件');

    const impl = readServer('src/manager/Story.cpp');
    ['db/story.db', 'story_character', 'story_expression', 'UNIQUE(character_id, name)', 'sqlite3_last_insert_rowid',
        'UPDATE story_character SET rep', 'DELETE FROM story_expression WHERE character_id', 'DELETE FROM story_character WHERE id',
        'DELETE FROM story_expression WHERE id = ?1 AND character_id = ?2', 'sqlite3_changes',
        'rep_original', 'image_original', 'query_character_rep', 'query_expression_image', 'query_character_originals']
        .forEach((needle) => has(impl, needle, 'Manager::Story 实现'));
    console.log('PASS: 后端角色存储模块（新增 / 更换代表图 / 删除角色 / 删除表情 + 8MB 上限）');
}

// 2) 后端接口：公开读 + 仅 level=4 管理员写，图片限定 data URL；支持更换代表图与删除角色
{
    const api = readServer('src/api/http/Story.cpp');
    ['"/story/character_query"', '"/story/character_update"', '"/story/image_download"', '"/story/image_source"', 'void image_source(', 'level == 4', 'data:image/', ';base64,', 'Manager::Story::IMAGE_LIMIT',
        "action == \"update_rep\"", "action == \"update_expression_image\"", "action == \"delete\"", "action == \"delete_expression\"", 'update_character_rep', 'update_expression_image', 'delete_character', 'delete_expression',
        'ORIGINAL_DIR', 'db/story_images', 'save_original', 'original_data_url', 'Libs::Coder::Base64::decode']
        .forEach((needle) => has(api, needle, 'Api::Http::Story'));

    const init = readServer('src/Init.h');
    ['Manager::Story::init();', 'Manager::Story::close();', 'Api::Http::Story::load(server);']
        .forEach((needle) => has(init, needle, 'Init.h 接线'));
    console.log('PASS: 后端接口接线（公开读 / 管理员写）');
}

// 3) 前端接口封装：角色查询 / 新增角色 / 更换代表图 / 删除角色 / 新增表情（大图上传放宽超时）
{
    const http = readWeb('js/ref/http.cjs');
    ['http_story_character_query', 'http_story_character_add', 'http_story_character_update_rep', 'http_story_character_delete',
        'http_story_expression_add', 'http_story_expression_delete', "action: 'delete_expression'", '60000',
        'http_story_image_download', 'http_story_image_source', 'http_story_expression_image_update', 'image_download', '/story/image_source', 'original =', 'token, kind']
        .forEach((needle) => has(http, needle, 'http.cjs'));

    const must = readWeb('js/ref/must.cjs');
    has(must, 'timeout = 5000', 'fetch_task 默认超时');
    has(must, 'controller.abort(), timeout', 'fetch_task 可配置超时');
    console.log('PASS: 前端剧情角色接口');
}

// 4) 剧情播放页：左侧表情框随对话框缩放（高度 2/5、1:1.5、黑边、上下居中），压缩图不足时取原图按框像素重压填满
{
    const play = readWeb('html/docs/story-play.html');
    assert.ok(!play.includes('dialogue-avatar'), '对话框不应再保留圆形头像');
    assert.ok(!play.includes('dialogue-head'), '对话框不应再保留旧的头像行');
    ['dialogue_face_frame', 'dialogue_face_img', 'object-fit: cover', 'FACE_RATIO = 1.5', 'FACE_HEIGHT_RATIO = 0.4',
        'FACE_MAX_WIDTH = 512', 'renderFace', 'layoutFaceFrame', 'runtime.step_cond(node)', 'http_story_character_query',
        'http_story_image_source', 'resizeToFrame', 'prepareFace', 'primeFaceThumbs', 'pruneFaceCache', 'faceOriginals',
        "border: 2px solid #000"]
        .forEach((needle) => has(play, needle, 'story-play.html'));
    assert.ok(!play.includes('object-fit: fill'), '表情图不应被直接拉伸变形（应裁切后填满）');

    // 表情图绝对定位：图片固有尺寸（512×768）不得参与表情框的尺寸计算
    const imgRule = play.slice(play.indexOf('.dialogue-face-frame img'), play.indexOf('.dialogue-face-frame sl-icon'));
    assert.ok(imgRule.includes('position: absolute'), '表情图应绝对定位，避免固有尺寸撑大表情框');

    // 角色框大小按对话框实际高度计算（2/5），并换算成设备像素作为压缩目标
    const layout = play.slice(play.indexOf('const layoutFaceFrame = ()'), play.indexOf('const loadCharacters = async'));
    assert.ok(layout.includes('inner.clientHeight') && layout.includes('FACE_HEIGHT_RATIO'), '表情框高度应按对话框实际高度计算');
    assert.ok(layout.includes('window.devicePixelRatio'), '压缩目标应换算设备像素');
    assert.ok(layout.includes('FACE_MAX_WIDTH') && layout.includes('FACE_MAX_HEIGHT'), '目标像素应以原图上限封顶');

    // 压缩图够大直接用；不够时必须取服务端原图按框像素重新压缩填满
    const prepare = play.slice(play.indexOf('const prepareFace = async'), play.indexOf('const preloadFaces = async'));
    assert.ok(prepare.includes('size.w >= faceTarget.w && size.h >= faceTarget.h'), '压缩图足够时应直接使用');
    assert.ok(prepare.includes('fetchFaceOriginal') && prepare.includes('resizeToFrame(original'), '压缩图不足时应取原图重压');

    // 拖动窗口时：角色框立即跟随，并立刻用缓存的压缩图填充；随后异步按新框像素升级
    const resizeStart = play.indexOf("window.addEventListener('resize'");
    const resize = play.slice(resizeStart, play.indexOf('\n        (async () => {', resizeStart));
    assert.ok(resize.includes('layoutFaceFrame()'), 'resize 时角色框应立即跟随对话框高度');
    assert.ok(resize.includes('primeFaceThumbs(levelFaces)') && resize.includes('renderFace(lastFace'), 'resize 时应立即用缓存的压缩图填充');
    assert.ok(resize.includes('preloadFaces(levelFaces)'), 'resize 后应按新框像素异步升级原图压缩结果');

    console.log('PASS: 对话框表情框（2/5 高 / 1:1.5 / 黑边 / 按框像素压缩填满 / 拖动即时填充）');
}

// 5) 角色管理页：管理员门禁 + 1:1.5 固定比例裁剪框（可拖动位置，仅可调整大小）
{
    const page = readWeb('html/docs/story-characters.html');
    ['CROP_RATIO = 1.5', 'OUTPUT_WIDTH = 512', 'OUTPUT_HEIGHT = 768', 'const width = crop.box_h / CROP_RATIO',
        'crop.box_x = (crop.disp_w - crop.box_h / CROP_RATIO) / 2', 'crop.box_x * scale', 'crop.move',
        "cropBox.addEventListener('pointerdown'", "cropBox.addEventListener('pointermove'", 'cropHandle',
        'box_x: 0', 'box_y: 0', 'Number(admin.level) === 4',
        'http_story_character_add', 'http_story_expression_add', 'data-role=save-expression',
        'data-role=replace-rep', 'data-role=delete-char', 'data-role=char-status',
        'http_story_character_update_rep', 'http_story_character_delete', 'confirm_dialog',
        'http_story_expression_delete', 'data-role=delete-expression', 'deleteExpression']
        .forEach((needle) => has(page, needle, 'story-characters.html'));
    assert.ok(Math.abs(512 / 768 - 1 / 1.5) < 1e-9, '输出宽高比应为 1:1.5');

    // 拖动只改 left/top，缩放只改高度（宽度恒由高度 / 1.5 推导），比例不会被改掉
    const layout = page.slice(page.indexOf('const layoutCropBox = ()'), page.indexOf('const centerCropBox = ()'));
    assert.ok(layout.includes('crop.box_x') && layout.includes('crop.box_y'), '拖动位置应写入 box_x / box_y');
    assert.ok(layout.includes('crop.box_h / CROP_RATIO') && !layout.includes('crop.box_w'), '宽度必须由高度推导，保持 1:1.5');

    // 裁切源区域跟随选框位置，而不是固定居中
    const cut = page.slice(page.indexOf('const cropToDataUrl = ('), page.indexOf("$('button_crop_cancel')"));
    assert.ok(cut.includes('crop.box_x * scale') && cut.includes('crop.box_y * scale'), '裁切源区域应取选框当前位置');
    assert.ok(!cut.includes('(crop.disp_w - boxW) / 2'), '裁切不应再假设居中');
    console.log('PASS: 角色管理页（可拖动 + 1:1.5 固定比例 / 仅管理员）');
}

// 5.1) 压缩图 200×300 + 原图落盘下载：剧情页只加载压缩图，管理员可下载原图
{
    const page = readWeb('html/docs/story-characters.html');
    ['THUMB_WIDTH = 200', 'THUMB_HEIGHT = 300', 'cropToDataUrl(THUMB_WIDTH, THUMB_HEIGHT', "'original': cropToDataUrl()",
        'http_story_character_add(window.get_token(), name, repImage.image, repImage.original)',
        'http_story_expression_add(window.get_token(), Number(charId), name, draft.image, draft.original)',
        'http_story_character_update_rep(window.get_token(), Number(charId), picked.image, picked.original)',
        'download-rep', 'download-expression', 'http_story_image_download', 'downloadDataUrl',
        'button_compress', 'shrinkImage', 'compressExisting', 'http_story_expression_image_update',
        'has_original', 'Boolean(character.has_original)', 'Boolean(expression.has_original)']
        .forEach((needle) => has(page, needle, 'story-characters.html 压缩图/原图下载'));

    // 迁移压缩必须以服务端原图为源，再覆盖现有压缩图
    const migration = page.slice(page.indexOf('const loadSourceImage = async'), page.indexOf('// ==================== 列表渲染'));
    assert.ok(migration.includes("loadSourceImage('rep', character.id, 0, character.rep)"), '代表图压缩应优先读取服务端原图');
    assert.ok(migration.includes("loadSourceImage('expression', character.id, expression.id, expression.image)"), '表情压缩应优先读取服务端原图');
    assert.ok(migration.includes('http_story_image_download'), '应通过 image_download 读取服务端原图');
    assert.ok(migration.includes('http_story_character_update_rep') && migration.includes('http_story_expression_image_update'), '压缩结果应覆盖现有压缩图');

    // 进入关卡只下发压缩图：查询响应不含原图本体，原图仅由 image_download 读取
    const api = readServer('src/api/http/Story.cpp');
    assert.ok(!api.includes('value["original"]'), '角色查询不应下发原图字段');
    ['has_original', 'resolve_original', 'bool* provided', 'old_original', 'if (!replaced) original_path = old_original']
        .forEach((needle) => has(api, needle, 'Api::Http::Story 原图保留'));

    // 未携带 original 时省略该字段，避免服务端清空已落盘原图
    const http = readWeb('js/ref/http.cjs');
    const update = http.slice(http.indexOf('window.http_story_character_update_rep'), http.indexOf('window.http_story_character_delete'));
    assert.ok(update.includes('if (original) payload.original = original'), '更换代表图未携带原图时应省略 original 字段');
    const exprUpdate = http.slice(http.indexOf('window.http_story_expression_image_update'), http.indexOf('window.http_story_image_download'));
    assert.ok(exprUpdate.includes('if (original) payload.original = original'), '覆盖表情图未携带原图时应省略 original 字段');
    console.log('PASS: 压缩图 200×300 + 原图下载入口 + 旧图压缩迁移（以服务端原图为源覆盖压缩图）');
}

// 6) 管理员编辑器：行式模型 + 命令栏 + 拖动排序 + rows↔DSL 编译 + 对局框
{
    const page = readWeb('html/docs/story.html');
    ['rowsFromScript', 'rowsToScript', 'editor_rows', 'command_bar', 'button_characters',
        '选择角色和对应的表情', '添加台词', '添加选择', '对局设置', '结束对局条件',
        '步数触发对话', '继续对局', '结束', 'IF', 'ELSE',
        "'dragstart'", "'drop'", 'StoryScript.validate']
        .forEach((needle) => has(page, needle, 'story.html'));
    assert.ok(!page.includes("'label': '添加对局码'"), '命令栏不应再提供「添加对局码」');
    assert.ok(!page.includes("'label': '添加残局码'"), '命令栏不应再提供「添加残局码」');
    assert.ok(!page.includes("'label': '结束残局条件'"), '命令栏不应再提供「结束残局条件」');
    // 对局框：* 对局 到 结束此对局 之间的行包进同一个蓝色圆角框（按嵌套栈回收容器）
    ['editor-game-box', "'block': true", "'game_end'", '结束此对局', "row.kind === 'box_end' || row.kind === 'game_end'",
        'stack[closeIndex].node.append(buildRowEl(row, index))']
        .forEach((needle) => has(page, needle, 'story.html 对局框'));
    console.log('PASS: 管理员行式编辑器（命令栏 / 拖动排序 / rows↔DSL / 对局框）');
}

// 7) 残局开始与结束条件：编辑器命令 + 播放页步数/胜负判定
{
    const editor = readWeb('html/docs/story.html');
    ["'残局码', '结束对局'", '对局设置', '结束对局条件', "data-role='endmode'",
        "data-role='endsteps'", 'endStepsValue', 'endValue', '结束对局=']
        .forEach((needle) => has(editor, needle, 'story.html 结束对局命令'));

    const play = readWeb('html/docs/story-play.html');
    ['let endLimit = 0', "config.end_kind === 'steps'", 'moves.length >= endLimit', 'concludeGame(null)',
        "? 'draw' : winner === selfPlayer ? 'win' : 'lose'", '按平局处理', '.result-overlay.is-draw']
        .forEach((needle) => has(play, needle, 'story-play.html 结束条件'));
    // 胜负优先：结算出胜负时先行返回，步数判定不会覆盖胜负
    const apply = play.slice(play.indexOf('const applyMove = async'), play.indexOf('const runAiTurns ='));
    assert.ok(apply.indexOf('if (ended || gameOver) return true;') < apply.indexOf('moves.length >= endLimit'), '胜负必须先于步数判定');
    console.log('PASS: 残局开始与结束条件');
}

// 8) 构建产物：三个页面与三个 JS 包均已产出
{
    ['root/pages/docs/story.html', 'root/pages/docs/story-play.html', 'root/pages/docs/story-characters.html',
        'root/js/global/story.min.js', 'root/js/ref/http.min.js', 'root/js/ref/must.min.js']
        .forEach((relative) => assert.ok(fs.existsSync(path.resolve(web, relative)), `构建产物应存在：${relative}`));
    const built = readWeb('root/pages/docs/story-play.html');
    assert.ok(!built.includes('?v=replace'), '构建产物不应残留版本占位符');
    console.log('PASS: 构建产物齐备');
}

// 9) 步数对话：编辑器命令/字段 + 播放页触发与返回 + 刷草点下线
{
    const editor = readWeb('html/docs/story.html');
    assert.ok(!editor.includes("'label': '添加长草点'"), '命令栏不应再提供「添加刷草点」');
    assert.ok(!editor.includes("'残局码', '结束对局', '刷草点'"), '对局配置下拉不应再含「刷草点」');
    ['步数触发对话', "'key': '步数对话'", "'label': '继续对局'", "'value': 'resume'",
        'CONFIG_KEYS.concat(selected)', '步数对话=', "'trigtype'", "'add-trigger'"]
        .forEach((needle) => has(editor, needle, 'story.html 步数对话'));

    const play = readWeb('html/docs/story-play.html');
    assert.ok(!play.includes('playerMoveCount'), '步数对话不应再使用「仅玩家落子」计数变量');
    ['triggeredEvents', 'lastMovePicked', 'pendingResume', 'gameNodeIndex', 'runStepDialogues',
        "node.type === 'resume'", 'runtime.index = gameNodeIndex', 'const step = moves.length',
        'runStepDialogues(source, move)', "item.type === 'cell'", "item.type === 'pick'", "item.type === 'ai_pick'"]
        .forEach((needle) => has(play, needle, 'story-play.html 步数对话'));
    console.log('PASS: 步数对话（编辑器命令 + 播放页触发/返回 + 刷草点下线）');
}

// 10) 引导落子：编辑器下线 + 播放页按残局码 guide_moves 显示（与残局挑战同款红圈）
{
    const editor = readWeb('html/docs/story.html');
    assert.ok(!editor.includes("'label': '引导落子点'"), '命令栏不应再提供「引导落子点」');
    has(editor, "'kind': 'mark'", 'story.html 标注行/DSL 底层解析保留（兼容旧剧本）');

    const play = readWeb('html/docs/story-play.html');
    ['canvas_guide', 'create_guide', 'archiveData.guide_moves', 'drawGuide', 'guideTick', 'refreshGuide',
        'advanceGuide', 'resetGuide', 'resetGuide(archiveData)', 'hasActiveGuide', 'requestAnimationFrame(guideTick)']
        .forEach((needle) => has(play, needle, 'story-play.html 引导落子'));
    // 玩家落子后按序推进引导；未命中即取消后续引导
    assert.ok(play.includes('if (source === \'player\') advanceGuide(move[0], move[1]);'), '玩家落子应推进引导落子点');
    console.log('PASS: 引导落子（编辑器下线 + 播放页显示残局码引导点）');
}

console.log('story-role-image: ALL PASS');
