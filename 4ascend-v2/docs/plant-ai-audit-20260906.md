# Web AI 修改说明（2026-09-06）

## 改动文件

以下路径均相对于 `4ascend-v2/`。原版代码指修改前的 Web 项目代码；JS 负责页面实际棋局，C++ 编译为 WASM，负责 Zero AI 内部棋局与搜索。

| 文件 | 改动内容 |
|---|---|
| [`wasm/4ascend-zero/src/game.cpp`](../wasm/4ascend-zero/src/game.cpp) | 复制植物开关；修复双草状态及力量；历史快照前移；同步永夜 |
| [`wasm/4ascend-zero/src/game.h`](../wasm/4ascend-zero/src/game.h) | 禁止默认复制赋值，防止棋盘指针别名 |
| [`wasm/4ascend-zero/src/encoding.h`](../wasm/4ascend-zero/src/encoding.h)（新增） | 抽出模型输入编码；修复四连特征；历史回合索引使用 `int` |
| [`wasm/4ascend-zero/src/net.cpp`](../wasm/4ascend-zero/src/net.cpp) | `Net::encode()` 改为调用共享编码函数，便于独立校验 |
| [`wasm/4ascend-zero/src/state.h`](../wasm/4ascend-zero/src/state.h) | 新增永夜状态 `always_overload` |
| [`wasm/4ascend-zero/src/main.cpp`](../wasm/4ascend-zero/src/main.cpp) | 新增并导出 `set_overload()` |
| [`wasm/4ascend-zero/src/mcts.cpp`](../wasm/4ascend-zero/src/mcts.cpp) | 修正胜率输出的多余反号 |
| [`wasm/4ascend-zero/src/board.h`](../wasm/4ascend-zero/src/board.h) | 补齐 `<cstdint>`、`<algorithm>`，支持独立编译 |
| [`js/core/ai.cjs`](../js/core/ai.cjs) | 传递永夜模式；删除额外手写落点规则 |
| [`js/worker/ai.cjs`](../js/worker/ai.cjs) | 将永夜模式传给 Zero WASM |

构建与验证配套：新增 `wasm/4ascend-zero/build-linux.sh`、`tests/` 中的规则/编码/MCTS/WASM 校验工具，独立复核文件放在 `../validation/`。同步的本地发布文件包括 `root/wasm/ai/4ascend-zero.js`、`root/js/global/fascend.min.js`、`root/js/core/ai.min.js`、`root/js/worker/ai.min.js` 及相关 HTML 缓存版本；C++ 构建产物位于 `wasm/4ascend-zero/build/wasm/wasm32/release/`。

## 1. 复制棋局时遗漏植物开关

**问题与后果：** `plant` 是是否启用植物规则的开关，不是盘面有没有草。普通构造函数初始化了它，但手写拷贝构造函数没有。MCTS 复制棋局后读取未初始化的 `bool`，在项目使用的 C++20 下属于未定义行为，不能保证搜索副本沿用原规则。“随机初始化为 true/false”不是准确描述。

**错误点：** 原版 `game.h` 声明 `bool plant;`，没有默认成员初始化器；`game.cpp` 的拷贝构造函数遗漏该成员：

```cpp
Game::Game(const Game& other)
: board(other.board), state(other.state),
  rand_aic(other.rand_aic), rand_uinty(other.rand_uinty),
  history_boards(other.history_boards), history_count(other.history_count) {
    stones[0] = &board.black;
    stones[1] = &board.white;
}
```

触发路径在 `mcts.cpp`，按值传参和局部定义都会复制棋局：

```cpp
void MCTS::simulate(Game root_state, Node* root) {
    Game state = root_state;
    // 后续在副本上模拟。
```

植物刷新会读取遗漏的开关：

```cpp
void Game::create_plant() noexcept {
    if (!plant) return;
```

**修改：** 拷贝构造函数加入 `plant(other.plant)`，继续让 `stones` 指向副本自身的 `board`。另在 `game.h` 禁止默认复制赋值，防止直接复制 `stones` 指针造成别名：

```cpp
Game& operator=(const Game&) = delete;
```

## 2. Zero 内部将双草力量算成 4

**问题与后果：** 原版 C++ 升级双草时保留了单草标记，力量计算又把两级相加，导致双草棋子力量为 4，影响 AI 预测的攻防抵消和血量。网页 JS 实际结算双草为 3，这个问题不表示网页扣血也算错。

**错误点：** `Game::create_plant()` 与 `Game::clear_ascend()`：

```cpp
// 原版：第二次生成后 lvl1、lvl2 同时为 1。
if (!board.plant_lvl1.test(index)) board.plant_lvl1.set(index);
else if (!board.plant_lvl2.test(index)) board.plant_lvl2.set(index);

// 原版：1 + 1 + 2 = 4。
uint8_t power = 1 + board.plant_lvl1[i] + (board.plant_lvl2[i] << 1);
```

**修改：** 升级时清除一级标记，满级格不再新增；力量按等级择一计算：

```cpp
if (board.plant_lvl2.test(index)) continue;
if (board.plant_lvl1.test(index)) {
    board.plant_lvl1.reset(index);
    board.plant_lvl2.set(index);
} else board.plant_lvl1.set(index);

uint8_t power = 1 + (board.plant_lvl2[i] ? 2 : board.plant_lvl1[i] ? 1 : 0);
```

力量进入 `ATK::parse(power_black, power_white, plant)` 抵消，最终按剩余棋子数量扣血，并非直接扣 `power` 点血。独立结算复核中，黑方一格双草、白方两格单草，双方各四颗棋子：网页按 `3111` 对 `2211` 正常抵消；原版 C++ 内部算成 `4111` 对 `2211`，白方多扣 1 血。当前 C++ 已恢复正常抵消。详见 [结算复核](../../validation/power-settlement-recheck/README.md)。

## 3. 历史盘面记录晚了一步

**问题与后果：** 模型的 `t=0` 是当前待落子盘面，`t=-1` 应为上一次落子之前的盘面。原版 C++ 保存的是落子后、ASCEND 检查前的中间状态，历史输入错位。

**错误点：** `Game::start_turn()` 先放棋子，再存快照：

```cpp
board.set_point(*stones[state.turn_player], index);
state.turn_pos = index;
// 随后才执行 history_boards[...] = board。
```

原版编码直接读取 `history_boards[history_count - j]`，没有补偿这个时机差异。从空盘开始黑落 A、白落 B，轮到黑方时：

| 时间槽位 | 应有棋子分布 | 原版 C++ 棋子分布 |
|---|---|---|
| `t=0` | 黑 A、白 B | 黑 A、白 B |
| `t=-1` | 只有黑 A | 黑 A、白 B |
| `t=-2` | 空盘 | 只有黑 A |

此表只描述位置和颜色，不描述双方特征通道的排列。ASCEND 时，刚形成的四连还未标记，也会被错误地保存在最新历史中。

**修改：** 将完整的历史保存逻辑移到 `start_turn()` 开头，在移除对方棋子和放置己方棋子之前执行：

```cpp
if (history_count < 7) {
    history_boards[history_count++] = board;
} else {
    for (int i = 0; i < 6; ++i) history_boards[i] = history_boards[i + 1];
    history_boards[6] = board;
}
// 随后才处理落子。
```

历史仍占通道 11～24，从最近到最早取七份快照；编码时排除 `ascend/used` 标记。

## 4. 四连特征混入不足四连的方向

**问题与后果：** 通道 9/10 应只统计达到四连的轴，且该颜色已经占用的格子应为 0。原版只判断最长轴是否达标，一旦达标就写入所有方向的总连子数，使模型输入偏大。

**错误点：** 原版 `Net::encode()`：

```cpp
game.board.get_align(my_solid, i, max_align, max_total);
myascend_click_plane[i] = (max_align >= 4) ? static_cast<float>(max_total) : 0.0f;
```

例如假设在中心落子，横向可成四连、纵向只能成二连，原版输出 5，所需值为 4。

**`max_total` 的原始代码证据：** ZIP 原版 [`board.cpp`](../../validation/power-settlement-recheck/original/board.cpp) 第 231～275 行的索引重载，通过引用参数 `max_align_total` 返回总数；调用处传入的变量名是 `max_total`，两者是同一个输出。以下为关键代码节选：

```cpp
void Board::get_align(const std::bitset<81>& target, uint8_t index,
                      uint8_t& max_align, uint8_t& max_align_total) noexcept {
    // ……沿四条轴收集连续同色邻子，得到 axis1～axis4，不含中心。

    uint8_t len1 = static_cast<uint8_t>(axis1.count() + 1);
    uint8_t len2 = static_cast<uint8_t>(axis2.count() + 1);
    uint8_t len3 = static_cast<uint8_t>(axis3.count() + 1);
    uint8_t len4 = static_cast<uint8_t>(axis4.count() + 1);

    max_align = std::max({len1, len2, len3, len4});
    max_align_total = static_cast<uint8_t>(
        (axis1 | axis2 | axis3 | axis4).count() + 1);
}
```

`max_align_total` 合并四条轴时没有按 `len >= 4` 过滤。外层编码的 `max_align >= 4` 只是控制是否写入这个总数，不能排除总数中不足四连的方向。因此准确结论是：**原版有四连门槛，但门槛只作用于最长轴，没有逐轴筛选参与总数的棋子。** `get_align()` 的通用连线统计仍用于植物评分，本次修复位于模型编码调用处，没有改变该统计函数的语义。

**实际运行证据：** [独立探针](../../validation/four-feature-recheck/check.cpp) 编译链接上述未修改的原版 `board.cpp`。中心为索引 40，已有同色棋子为 41、42、43、49，即假设中心落子后横向四连、纵向二连。运行结果：

```text
max_align=4 max_total=5 original_feature=5
```

其中横向贡献 3 个邻子，纵向贡献 1 个邻子，再加中心 1，得到 5；只计达标的横向轴则为 4。探针位于独立验证目录，没有修改游戏源码。

**修改：** 在共享 `encoding.h` 中用 `get_ascend()` 获取达到四连的轴的格子并集，中心只计一次，并排除该颜色已占格。双方采用同样逻辑：

```cpp
myascend_click_plane[i] = my_solid[i] ? 0.0f
    : static_cast<float>(game.board.get_ascend(my_solid, i).count());
```

## 5. 永夜模式未传入 Zero

**问题与后果：** 网页选择永夜后强制执行超载，原版 Zero 只收到植物开关，仍按普通模式模拟。植物候选、补偿评分、名额与冷却可能因此与实际棋局不同。

**错误点：** JS `GameNight` 设置 `always_overload = true`，但原版 worker 初始化没有对应参数：

```js
ZERO_RESET(seed1, seed2, first, hp, plant) {
    ai_zero = new wasm.AI_ZERO(seed1, seed2, first, hp, plant);
}
```

原版 `Game::create_plant()` 始终按 44 子启用超载、满足血量条件后执行、低于 22 子退出。例如刷新时只有 20 子，页面永夜执行超载，AI 内部却不执行。

**修改：** `js/core/ai.cjs` 传入 `gl_cf_mode === 'night'`，worker 接收并同步：

```js
ZERO_RESET(seed1, seed2, first, hp, plant, overload = false) {
    ai_zero = new wasm.AI_ZERO(seed1, seed2, first, hp, plant);
    ai_zero.set_overload(overload);
}
```

`main.cpp` 新增并导出接口，`state.h` 新增字段，随状态复制进入模拟：

```cpp
void set_overload(bool enabled) { game.state.always_overload = enabled; }
```

`create_plant()` 到达刷新处理时强制进入执行状态，并禁止永夜因低于 22 子退出：

```cpp
if (state.always_overload) state.over_status = 2;
// 保留普通模式的启用条件。
if (!state.always_overload && state.over_status != 0 && stone_count < 22)
    state.over_status = 0;
```

刷新计时与等待防守时的提前返回仍生效，不表示开局立即刷草或每手刷草。

## 6. 删除引擎外的手写落点规则

**问题与后果：** 原版页面在某些低血量攻防局面调用 `ai_response_move()`，直接选择最长回应、草较多的回应或第一个普通空格。这条路径跳过引擎思考，实际落点不来自 MCTS。

**错误点：** `js/core/ai.cjs` 中的辅助函数及条件分支：

```js
if (response) {
    index = response.index;
    await ai_turn(index);
} else {
    index = await ai_think();
}
```

**修改：** 已彻底删除 `ai_response_move()` 和额外覆盖分支，不再只对 Zero 绕过。Zero 使用 MCTS 返回值，HCE 使用自身引擎返回值：

```js
const ai_pice = async () => {
    const index = await ai_think();
    const [x, y] = index2xy(index, 9);
    gl_game.ed_tr_1(x, y);
};
```

已同步本地发布 JS 与缓存版本。

## 7. 胜率输出多反转一次

**问题与后果：** `get_root_winrate()` 把已属于根玩家视角的 Q 当成对手视角，输出颠倒，例如 80% 变成 20%。只影响胜率接口输出，不改变搜索树 Q、落点选择或棋力。

**错误点：** 原版先算 `(平均Q + 1) / 2`，再执行 `1 - 结果`。

**修改：** `mcts.cpp` 直接返回按访问次数加权的根玩家胜率，无访问时返回 0.5：

```cpp
return total > 0.0f ? (weighted_q / total + 1.0f) * 0.5f : 0.5f;
```

## 8. 存疑：C++ 与 JS 的刷草实现不一致

这一项合并此前的同分排序、候选过滤、来源回退差异，暂不列为已确认的规则错误或棋力下降原因。

| 位置 | 实现差异 | 
|---|---|
| C++ `utils.h::CsharpSort` 与 JS `utils.cjs::CsharpSort` | 同分候选的排序细节不同 |
| JS `GameNormal.p_scan_pos()`、`p_scan_score()` 与 C++ `Game::scan_point()` 等 | 候选过滤、扫描计数与同格容量处理不同 | 
| C++ `Game::scan_point()`、`scan_score()` 与 JS 对应实现 | 来源回退条件不同 | 


## 验证与交付边界

状态复制、双草结算、模型编码、MCTS 终局/选点与胜率方向、普通/永夜 WASM 加载和选点均有对应验证。独立目录 `../validation/` 保留原版副本和复核程序。模型文件没有替换，也未进行足以证明与 Python 棋力相等的大规模对弈评估。

当前交付版本的复核结果见 [存疑项回退验证记录](../../validation/rollback-plant-suspects/README.md)。此前全量 JS/C++ 刷草一致性结果针对回退前版本，不作为当前版本的通过结论。
