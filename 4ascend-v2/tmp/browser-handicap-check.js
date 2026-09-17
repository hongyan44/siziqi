(() => {
  const { AiHandicap, RulesRuntime, Board, State, GameNormal, RandAIC, RandUnity, STONE_ENUM: S, PLAYER_ENUM: R, PLANT_ENUM: P } = window.FAscendExports;
  const h = AiHandicap.create({ RulesRuntime });
  const xy = (x, y) => y * 9 + x;
  const out = [];
  const check = (name, cond, extra) => out.push({ name, pass: !!cond, extra: extra === undefined ? null : extra });

  const makeGame = (turn) => {
    const board = new Board(9, 9);
    const state = new State();
    state.hp = [6, 6];
    state.turn_player = turn;
    const game = new GameNormal(board, state, new RandAIC(1), new RandUnity(2));
    game.natural_plant = false;
    RulesRuntime.initialize(game, R.BLACK);
    return game;
  };
  const put = (g, color, cells, plant) => cells.forEach(([x, y]) => {
    g.board.set_stone(x, y, color);
    if (plant) g.board.set_plant(x, y, plant);
  });

  check('levelOf(1)=easy', AiHandicap.levelOf('1') === 'easy');
  check('levelOf(2)=normal', AiHandicap.levelOf('2') === 'normal');
  check('levelOf(3..6)=null', ['3','4','5','6'].every((o) => AiHandicap.levelOf(o) === null));

  // 简单：占草 → 堵玩家打点
  {
    const g = makeGame(R.BLACK);
    put(g, S.WHITE, [[1, 4], [2, 4], [3, 4]]);
    put(g, S.BLACK, [[0, 4]]);
    g.board.set_plant(7, 7, P.ONE);
    const r = h.adjust(g, xy(7, 7), '1');
    check('简单: 占草改堵点', r && r.reason === 'easy-block-player-ascend' && r.action === xy(4, 4), r && r.reason);
    check('简单: 非占草不改', h.adjust(g, xy(0, 0), '1') === null);
  }

  // 普通：卖血 → 自身打点
  {
    const g = makeGame(R.BLACK);
    put(g, S.WHITE_ASCEND, [[3, 4], [4, 4], [5, 4], [6, 4]]);
    put(g, S.BLACK, [[6, 6], [6, 7], [6, 8]]);
    const r = h.adjust(g, xy(4, 4), '2');
    const chosen = r && h.describe(g, r.action);
    check('普通: 卖血改自身打点', r && r.reason === 'normal-no-sell-blood' && chosen && chosen.formsAscend, r && `(${chosen.x},${chosen.y})`);
    check('普通: 无打点才卖血', (() => {
      const g2 = makeGame(R.BLACK);
      put(g2, S.WHITE_ASCEND, [[3, 4], [4, 4], [5, 4], [6, 4]]);
      put(g2, S.BLACK, [[0, 0], [8, 8]]);
      return h.adjust(g2, xy(4, 4), '2') === null;
    })());
    check('普通: 非卖血不改', h.adjust(g, xy(6, 5), '2') === null);
    check('高级+: 完全不变', ['3','4','5','6'].every((o) => h.adjust(g, xy(4, 4), o) === null));
  }

  return JSON.stringify({ results: out, failed: out.filter((r) => !r.pass).length }, null, 2);
})()
