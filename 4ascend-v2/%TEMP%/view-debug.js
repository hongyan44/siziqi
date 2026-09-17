(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : /* @__PURE__ */ Symbol.for("Symbol." + name);
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };
  var __forAwait = (obj, it, method) => (it = obj[__knownSymbol("asyncIterator")]) ? it.call(obj) : (obj = obj[__knownSymbol("iterator")](), it = {}, method = (key, fn) => (fn = obj[key]) && (it[key] = (arg) => new Promise((yes, no, done) => (arg = fn.call(obj, arg), done = arg.done, Promise.resolve(arg.value).then((value) => yes({ value, done }), no)))), method("next"), method("return"), it);

  // js/core/view.cjs
  var require_view = __commonJS({
    "js/core/view.cjs"(exports) {
      var game_msg = document.getElementById("game_msg");
      var canvas_board = document.getElementById("canvas_board");
      var canvas_stone_fill = document.getElementById("canvas_stone_fill");
      var canvas_stone_ascend = document.getElementById("canvas_stone_ascend");
      var canvas_plant = document.getElementById("canvas_plant");
      var canvas_view_turn = document.getElementById("canvas_view_turn");
      var canvas_view_ascend = document.getElementById("canvas_view_ascend");
      var canvas_view_move = document.getElementById("canvas_view_move");
      var game_top_card = document.getElementById("game_top_card");
      var game_buttom_card = document.getElementById("game_buttom_card");
      var game_p1_name = document.getElementById("game_p1_name");
      var game_p1_ascend = document.getElementById("game_p1_ascend");
      var game_p1_hp = document.getElementById("game_p1_hp");
      var game_p1_stone = document.getElementById("game_p1_stone");
      var game_p1_clock = document.getElementById("game_p1_clock");
      var game_p1_card = document.getElementById("game_p1_card");
      var game_p1_info = document.getElementById("game_p1_info");
      var game_p1_time = document.getElementById("game_p1_time");
      var game_p2_name = document.getElementById("game_p2_name");
      var game_p2_ascend = document.getElementById("game_p2_ascend");
      var game_p2_hp = document.getElementById("game_p2_hp");
      var game_p2_stone = document.getElementById("game_p2_stone");
      var game_p2_clock = document.getElementById("game_p2_clock");
      var game_p2_card = document.getElementById("game_p2_card");
      var game_p2_info = document.getElementById("game_p2_info");
      var game_p2_time = document.getElementById("game_p2_time");
      var game_info_turn = document.getElementById("game_info_turn");
      var game_info_p1 = document.getElementById("game_info_p1");
      var game_info_p2 = document.getElementById("game_info_p2");
      var game_info_plant_cd = document.getElementById("game_info_plant_cd");
      var game_info_plant_normal = document.getElementById("game_info_plant_normal");
      var dialog_tools = document.getElementById("dialog_tools");
      var score_tools_p1 = document.getElementById("score_tools_p1");
      var score_tools_p2 = document.getElementById("score_tools_p2");
      var winrate_tools_p1 = document.getElementById("winrate_tools_p1");
      var winrate_tools_p2 = document.getElementById("winrate_tools_p2");
      var button_tools_restart = document.getElementById("button_tools_restart");
      var button_tools_archive = document.getElementById("button_tools_archive");
      var details_tools_observers = document.getElementById("details_tools_observers");
      var dialog_tip = document.getElementById("dialog_tip");
      var dialog_end = document.getElementById("dialog_end");
      var span_end_win = document.getElementById("span_end_win");
      var span_end_hp = document.getElementById("span_end_hp");
      var span_end_time = document.getElementById("span_end_time");
      var button_end_restart = document.getElementById("button_end_restart");
      var button_end_archive = document.getElementById("button_end_archive");
      var GameMessage = window.GameExports.Message;
      var GameClient = window.GameExports.Client;
      var GameTimer = window.GameExports.Timer;
      var GameCanvas = window.GameExports.Canvas;
      var GameSound = window.GameExports.Sound;
      var ShToast = window.UiExports.ShToast;
      var BaseZalgo = window.UtilsExports.BaseZalgo;
      var { GameNormal, GameBlight, GameNight, Board, OVER_ENUM, ASCEND_ENUM, PLANT_ENUM, PLAYER_ENUM, STONE_ENUM, Pos, Rand, State, ATK, AIC, ArchiveV0, RandAIC, RandUnity, RandOther } = window.FAscendExports;
      var toast = new ShToast();
      var gl_time = 0;
      var gl_pending_sync = null;
      var gl_view_run_id = 0;
      var gl_view_started = false;
      var gl_view_end_pending = false;
      var gl_turns;
      var gl_turnc;
      var gl_gameing;
      var gl_win;
      var gl_sound;
      var gl_ui;
      var gl_archive;
      var gl_my_clock;
      var gl_foe_clock;
      var gl_my_index;
      var gl_foe_index;
      var gl_first_index;
      var gl_click_time;
      var gl_click_level;
      var gl_game;
      var gl_rand_aic;
      var gl_rand_unity;
      var gl_rand_other;
      var gl_board;
      var gl_state;
      var gl_timer;
      var gl_cf_room;
      var gl_cf_archive;
      var gl_cf_health;
      var gl_cf_initb;
      var gl_cf_balance;
      var gl_cf_mode;
      var gl_cf_first;
      var gl_cf_color;
      var gl_cf_token;
      var gl_cf_client;
      var turn_color = (my_turn) => {
        if (my_turn) {
          game_p2_card.classList.remove("turn-purple");
          game_p2_info.classList.remove("turn-purple");
          game_p2_time.classList.remove("turn-purple");
          game_p1_card.classList.add("turn-orange");
          game_p1_info.classList.add("turn-orange");
          game_p1_time.classList.add("turn-orange");
          game_msg.classList.remove("text-purple");
          game_msg.classList.add("text-orange");
        } else {
          game_p1_card.classList.remove("turn-orange");
          game_p1_info.classList.remove("turn-orange");
          game_p1_time.classList.remove("turn-orange");
          game_p2_card.classList.add("turn-purple");
          game_p2_info.classList.add("turn-purple");
          game_p2_time.classList.add("turn-purple");
          game_msg.classList.remove("text-orange");
          game_msg.classList.add("text-purple");
        }
      };
      var title_clear = () => {
        game_msg.classList.remove("text-orange");
        game_msg.classList.remove("text-purple");
      };
      var info_clear = () => {
        game_p1_card.classList.remove("turn-orange");
        game_p1_info.classList.remove("turn-orange");
        game_p1_time.classList.remove("turn-orange");
        game_p2_card.classList.remove("turn-purple");
        game_p2_info.classList.remove("turn-purple");
        game_p2_time.classList.remove("turn-purple");
        game_info_plant_cd.classList.remove("text-danger");
        game_info_plant_cd.classList.remove("text-warning");
        game_info_plant_cd.classList.remove("text-info");
      };
      var game_clear = () => {
        game_p1_name.innerText = "?";
        game_p1_hp.innerText = "HP: ?";
        game_p1_ascend.innerText = "PR: ?";
        game_p1_stone.innerText = "?";
        game_p1_clock.innerText = "CLK: ?";
        game_p2_name.innerText = "?";
        game_p2_hp.innerText = "HP: ?";
        game_p2_ascend.innerText = "PR: ?";
        game_p2_stone.innerText = "?";
        game_p2_clock.innerText = "CLK: ?";
        game_info_plant_cd.innerText = `CD=cd`;
        game_info_plant_normal.innerText = "p NPlants";
        game_info_p1.innerText = "W+w";
        game_info_p2.innerText = "B+b";
        game_info_turn.innerText = `t Turns`;
        score_tools_p1.innerText = "?";
        score_tools_p2.innerText = "?";
        document.documentElement.style.setProperty("--hp-color-p1", "-1");
        document.documentElement.style.setProperty("--hp-color-p2", "-1");
        title_clear();
        info_clear();
        gl_ui.clear();
        gl_ui.init();
        gl_ui.draw_board();
        button_tools_restart.disabled = true;
        button_tools_restart.classList.add("pe-none");
      };
      var game_redraw = () => {
        gl_ui.clear();
        const size = window.math_size(main_game, [game_top_card]);
        gl_ui.size = size;
        game_top_card.style.width = `${size}px`;
        gl_ui.init();
        gl_ui.draw_board();
        if (!gl_board) return;
        gl_board.data.forEach((pos) => {
          const stone = pos.stone;
          const plant = pos.plant;
          const x = pos.x;
          const y = pos.y;
          if (stone === STONE_ENUM.BLACK) gl_ui.draw_stone_fill(x, y, "#2c3e50");
          else if (stone === STONE_ENUM.WHITE) gl_ui.draw_stone_fill(x, y, "#ecf0f1");
          else if (stone === STONE_ENUM.BLACK_ASCEND) {
            if (!gl_ui.ascend_is_lifted(x, y)) gl_ui.draw_stone_ascend(x, y, "#e74c3c");
          } else if (stone === STONE_ENUM.WHITE_ASCEND) {
            if (!gl_ui.ascend_is_lifted(x, y)) gl_ui.draw_stone_ascend(x, y, "#3498db");
          }
          if (plant === PLANT_ENUM.ONE) gl_ui.draw_plant(x, y);
          else if (plant === PLANT_ENUM.TWO) gl_ui.draw_2plant(x, y);
        });
        if (gl_state.turn_count !== 0) {
          gl_ui.clear_view_turn();
          gl_ui.draw_stone_turn(gl_state.turn_pos[0], gl_state.turn_pos[1], "#FFD700", 5);
        }
      };
      var game_balance = () => {
        return new Promise((resolve) => __async(null, null, function* () {
          if (gl_cf_balance === "cg+") {
            const points = [
              // 水平
              [[4, 2], [4, 3], [4, 5]],
              [[4, 3], [4, 5], [4, 6]],
              // 垂直
              [[2, 4], [3, 4], [5, 4]],
              [[3, 4], [5, 4], [6, 4]],
              // 主对角 ↘
              [[2, 2], [3, 3], [5, 5]],
              [[3, 3], [5, 5], [6, 6]],
              // 副对角 ↗
              [[2, 6], [3, 5], [5, 3]],
              [[3, 5], [5, 3], [6, 2]]
            ];
            const indexf = gl_rand_other.xor(points.length);
            const turns_first = points[indexf];
            let indexb = gl_rand_other.xor(points.length);
            let turns_befor = points[indexb];
            while (indexf === indexb || Math.abs(indexf - indexb) === 1) {
              indexb = gl_rand_other.xor(points.length);
              turns_befor = points[indexb];
            }
            const turns = [];
            turns.push([4, 4]);
            for (let index = 0; index < 3; index++) {
              turns.push(turns_first[index]);
              turns.push(turns_befor[index]);
            }
            turns.push([4, 4]);
            for (let index = 0; index < turns.length; index++) {
              const point = turns[index];
              const stone = gl_state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
              gl_game.ed_tr_1(point[0], point[1], stone);
              gl_game.ed_as_1();
              gl_game.ed_as_2();
              gl_game.ed_tr_2();
              gl_game.ed_pl_1();
              gl_game.ed_as_3();
              game_redraw();
              yield window.sleep(25);
            }
          } else if (gl_cf_balance === "cg-") {
            const points = [
              [[4, 3], [4, 2], [4, 1]],
              [[4, 5], [4, 6], [4, 7]],
              [[3, 4], [2, 4], [1, 4]],
              [[5, 4], [6, 4], [7, 4]],
              [[3, 3], [2, 2], [1, 1]],
              [[5, 3], [6, 2], [7, 1]],
              [[3, 5], [2, 6], [1, 7]],
              [[5, 5], [6, 6], [7, 7]]
            ];
            const indexf = gl_rand_other.xor(points.length);
            const turns_first = points[indexf];
            let indexb = gl_rand_other.xor(points.length);
            let turns_befor = points[indexb];
            while (indexf === indexb) {
              indexb = gl_rand_other.xor(points.length);
              turns_befor = points[indexb];
            }
            const turns = [];
            turns.push([4, 4]);
            for (let index = 0; index < 3; index++) {
              turns.push(turns_first[index]);
              turns.push(turns_befor[index]);
            }
            turns.push([4, 4]);
            for (let index = 0; index < turns.length; index++) {
              const point = turns[index];
              const stone = gl_state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
              gl_game.ed_tr_1(point[0], point[1], stone);
              gl_game.ed_as_1();
              gl_game.ed_as_2();
              gl_game.ed_tr_2();
              gl_game.ed_pl_1();
              gl_game.ed_as_3();
              game_redraw();
              yield window.sleep(25);
            }
          } else if (gl_cf_balance === "ncg") {
            const turns = [[4, 3], [3, 4], [4, 2], [2, 4], [4, 5], [5, 4], [4, 6], [6, 4], [4, 4], [4, 4]];
            for (let index = 0; index < turns.length; index++) {
              const point = turns[index];
              const stone = gl_state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
              gl_game.ed_tr_1(point[0], point[1], stone);
              gl_game.ed_as_1();
              gl_game.ed_as_2();
              gl_game.ed_tr_2();
              gl_game.ed_pl_1();
              gl_game.ed_as_3();
              game_redraw();
              yield window.sleep(25);
            }
          }
          gl_turnc = gl_state.turn_count;
          resolve();
        }));
      };
      var game_archive = () => {
        return new Promise((resolve) => __async(null, null, function* () {
          const turns = gl_archive.turns;
          for (let index = 0; index < turns.length; index++) {
            const point = turns[index];
            const stone = gl_state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
            gl_game.ed_tr_1(point[0], point[1], stone);
            gl_game.ed_as_1();
            gl_game.ed_as_2();
            gl_game.ed_tr_2();
            gl_game.ed_pl_1();
            gl_game.ed_as_3();
            game_redraw();
            yield window.sleep(25);
          }
          gl_turnc = gl_state.turn_count;
          resolve();
        }));
      };
      var game_power = (stone, datas) => {
        let snum = 0;
        let pnum = 0;
        if (datas) {
          datas.forEach((pos) => {
            snum += 1;
            if (pos.plant === PLANT_ENUM.ONE) pnum += 1;
            else if (pos.plant === PLANT_ENUM.TWO) pnum += 2;
          });
        } else {
          const as = stone === STONE_ENUM.BLACK ? STONE_ENUM.BLACK_ASCEND : STONE_ENUM.WHITE_ASCEND;
          gl_board.data.forEach((pos) => {
            if (pos.stone !== as) return;
            snum += 1;
            if (pos.plant === PLANT_ENUM.ONE) pnum += 1;
            else if (pos.plant === PLANT_ENUM.TWO) pnum += 2;
          });
        }
        return `PR\uFF1A${snum}+${pnum}`;
      };
      var game_match = (my_stone, foe_stone) => {
        let plantn = 0;
        let my_stone_num = 0;
        let my_plant_num = 0;
        let foe_stone_num = 0;
        let foe_plant_num = 0;
        gl_board.data.forEach((pos) => {
          const stone = pos.stone;
          const plant = pos.plant;
          if (stone === my_stone) {
            my_stone_num++;
            if (plant === PLANT_ENUM.ONE) my_plant_num++;
            else if (plant === PLANT_ENUM.TWO) my_plant_num += 2;
          } else if (stone === foe_stone) {
            foe_stone_num++;
            if (plant === PLANT_ENUM.ONE) foe_plant_num++;
            else if (plant === PLANT_ENUM.TWO) foe_plant_num += 2;
          } else {
            if (plant === PLANT_ENUM.ONE) plantn++;
            else if (plant === PLANT_ENUM.TWO) plantn += 2;
          }
        });
        game_info_p1.innerText = `${my_stone_num}+${my_plant_num}`;
        game_info_p2.innerText = `${foe_stone_num}+${foe_plant_num}`;
        game_info_plant_normal.innerText = `${plantn} NPlants`;
        game_info_turn.innerText = `${gl_state.turn_count} Turns`;
        if (gl_state.ascend_status === ASCEND_ENUM.NONE) {
          game_info_plant_cd.innerText = `CD=${gl_state.grow_count}`;
          if (gl_state.grow_count === 1) game_info_plant_cd.classList.add("text-danger");
          else if (gl_state.grow_count === 3) game_info_plant_cd.classList.add("text-info");
        } else if (gl_state.just_unascend) {
          game_info_plant_cd.innerText = "CD=no";
          game_info_plant_cd.classList.add("text-warning");
        } else if (gl_state.ascend_status === ASCEND_ENUM.START) {
          game_info_plant_cd.innerText = "CD=st";
          game_info_plant_cd.classList.add("text-danger");
        } else if (gl_state.ascend_status === ASCEND_ENUM.END) {
          game_info_plant_cd.innerText = "CD=ed";
          game_info_plant_cd.classList.add("text-danger");
        }
        if (gl_state.grow_count > 3 && gl_state.ascend_status === ASCEND_ENUM.NONE) {
          game_info_plant_cd.classList.remove("text-info");
          game_info_plant_cd.classList.remove("text-danger");
          game_info_plant_cd.classList.remove("text-warning");
        } else if (gl_state.grow_count === 1 && gl_state.ascend_status === ASCEND_ENUM.NONE) {
          game_info_plant_cd.classList.remove("text-info");
        }
      };
      var view_instruct = () => __async(null, null, function* () {
        gl_ui.start_click2move();
        const color_s = ["#c41bd7", "#c8e096", "#f57927"];
        const color_m = {};
        const color_p = {};
        const uuid = `${Date.now()}-${window.uuidv4()}`;
        (() => __async(null, null, function* () {
          let result;
          try {
            for (var iter2 = __forAwait(gl_cf_client), more2, temp2, error2; more2 = !(temp2 = yield iter2.next()).done; more2 = false) {
              const event = temp2.value;
              if (event.type === "$") break;
              if (event.type === "message" && event.data.op === "sync_observer2observers") {
                result = event.data.result;
                if (result.type === "view_instruct") gl_ui.notify_click(result.pos.concat(result.uuid).concat(result.color));
              }
            }
          } catch (temp2) {
            error2 = [temp2];
          } finally {
            try {
              more2 && (temp2 = iter2.return) && (yield temp2.call(iter2));
            } finally {
              if (error2)
                throw error2[0];
            }
          }
        }))();
        try {
          for (var iter = __forAwait(gl_ui.iterator_click()), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
            const pos = temp.value;
            if (pos === "$") break;
            if (!pos) continue;
            if (gl_state.turn_pos[0] === pos[0] && gl_state.turn_pos[1] === pos[1]) {
              toast.error("\u975E\u6CD5\u6807\u6CE8\uFF01");
              continue;
            }
            if (color_s.length === 0 || Object.keys(color_m).length === 3) {
              const key = Object.keys(color_m)[0];
              clearTimeout(color_m[key]);
              gl_ui.clear_view_turnp(color_p[key][0], color_p[key][1]);
              delete color_m[key];
              delete color_p[key];
              color_s.push(key);
            }
            let color = pos[3] || color_s.pop();
            gl_ui.draw_stone_turn(pos[0], pos[1], color, 5);
            color_m[color] = setTimeout(() => {
              if (!pos[3]) color_s.push(color);
              gl_ui.clear_view_turnp(pos[0], pos[1]);
            }, 3e3);
            color_p[color] = pos;
            if (pos[2]) continue;
            gl_cf_client.send(GameMessage.sync_observer2observers(gl_cf_room, gl_cf_token, {
              "type": "view_instruct",
              "pos": pos,
              "uuid": uuid,
              "color": color
            }));
          }
        } catch (temp) {
          error = [temp];
        } finally {
          try {
            more && (temp = iter.return) && (yield temp.call(iter));
          } finally {
            if (error)
              throw error[0];
          }
        }
      });
      var view_pice = (my_stone, foe_stone) => {
        return new Promise((resolve, _) => {
          let settled = false;
          const finish = (value) => {
            if (settled) return;
            settled = true;
            clearInterval(pid);
            resolve(value);
          };
          const pid = setInterval(() => {
            const index = gl_state.turn_count - gl_turnc;
            const data = gl_turns && gl_turns[index];
            if (!data) {
              if (!gl_gameing && gl_view_end_pending) finish([0, 0]);
              return;
            }
            const [x, y, pass, cp] = data;
            const stone = gl_state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
            if (my_stone === stone) {
              gl_my_clock = cp;
              game_p1_clock.innerText = `CLK: ${cp}`;
            } else {
              gl_foe_clock = cp;
              game_p2_clock.innerText = `CLK: ${cp}`;
            }
            gl_game.ed_tr_1(x, y, stone);
            finish([pass, cp]);
          }, 25);
        });
      };
      var view_accept = () => __async(null, null, function* () {
        const accept_run_id = gl_view_run_id;
        gl_view_end_pending = false;
        let result = gl_pending_sync;
        gl_pending_sync = null;
        try {
          for (var iter = __forAwait(gl_cf_client), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
            const event = temp.value;
            if (event.type !== "message" || event.data.op !== "sync_player2observers") continue;
            result = event.data.result;
            if (result.type === "view_sync" && result.time > gl_time) {
              gl_pending_sync = result;
              break;
            }
            if (result.turns && result.turns.length > gl_turns.length) {
              gl_turns = result.turns;
              gl_view_end_pending = false;
            }
          }
        } catch (temp) {
          error = [temp];
        } finally {
          try {
            more && (temp = iter.return) && (yield temp.call(iter));
          } finally {
            if (error)
              throw error[0];
          }
        }
        if (accept_run_id !== gl_view_run_id) return;
        gl_view_end_pending = true;
        gl_gameing = false;
        gl_view_started = false;
        dialog_tip.classList.remove("d-none");
        dialog_tip.show();
      });
      (() => {
        let timer;
        window.addEventListener("resize", () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => gl_ui && game_redraw(gl_ui, gl_board), 150);
          gl_ui && game_redraw(gl_ui, gl_board);
        });
      })();
      (() => {
        const opt = JSON.parse(localStorage.getItem("opt"));
        if (!opt) return;
        gl_sound = new GameSound(
          parseFloat(opt.bgmv),
          parseFloat(opt.stonev),
          parseFloat(opt.plantv),
          parseFloat(opt.matchv),
          parseFloat(opt.tickv),
          parseFloat(opt.tickv),
          parseFloat(opt.annihilationv),
          parseFloat(opt.hitv),
          parseFloat(opt.orbitv),
          parseFloat(opt.flyv)
        );
        gl_click_time = opt.click_time;
        gl_click_level = opt.click_level;
      })();
      (() => {
        window.addEventListener("load", () => {
          window.addEventListener("click", () => __async(null, null, function* () {
            yield gl_sound.context.resume();
            yield gl_sound.init();
            gl_sound.play_main();
          }), { "once": true });
        }, { "once": true });
      })();
      (() => {
        button_tools_archive.addEventListener("pointerdown", (event) => {
          if (event.target !== button_tools_archive) return;
          try {
            navigator.clipboard.writeText(exportf());
            toast.success("\u6210\u529F\uFF0C\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\uFF01");
          } catch (error) {
            console.error(error);
            toast.error("\u5BF9\u5C40\u5E8F\u5217\u5316\u5931\u8D25\uFF01");
          }
        });
        button_tools_restart.addEventListener("pointerdown", (event) => {
          if (event.target !== button_tools_restart) return;
          run();
          dialog_tools.hide();
        });
        button_end_archive.addEventListener("pointerdown", (event) => {
          if (event.target !== button_end_archive) return;
          try {
            navigator.clipboard.writeText(exportf());
            toast.success("\u6210\u529F\uFF0C\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\uFF01");
          } catch (error) {
            console.error(error);
            toast.error("\u5BF9\u5C40\u5E8F\u5217\u5316\u5931\u8D25\uFF01");
          }
        });
        button_end_restart.addEventListener("pointerdown", (event) => {
          if (event.target !== button_end_restart) return;
          run();
          dialog_end.hide();
        });
      })();
      (() => {
        dialog_tools.addEventListener("sl-request-close", (event) => event.detail.source === "overlay" && event.preventDefault());
        dialog_end.addEventListener("sl-request-close", (event) => event.detail.source === "overlay" && event.preventDefault());
      })();
      (() => {
        window.addEventListener("unload", () => {
          gl_sound.main.pause();
          gl_sound.main.currentTime = 0;
          gl_sound.main.loop = true;
          gl_cf_client.close();
        });
      })();
      var setup = (client, token, room) => {
        const size = window.math_size(main_game, [game_top_card]);
        gl_ui = new GameCanvas(
          canvas_board,
          canvas_stone_fill,
          canvas_stone_ascend,
          canvas_plant,
          canvas_view_turn,
          canvas_view_ascend,
          canvas_view_move,
          9,
          9,
          0.41,
          0.12,
          0.062,
          size
        );
        game_top_card.style.width = `${size}px`;
        gl_cf_client = client;
        gl_cf_token = token;
        gl_cf_room = room;
      };
      var run = () => __async(null, null, function* () {
        if (gl_view_started) return;
        gl_view_started = true;
        ++gl_view_run_id;
        game_clear();
        game_redraw();
        gl_view_end_pending = false;
        let result, start;
        gl_gameing = true;
        game_msg.innerText = "\u{1F4CD}\u7B49\u5F85\u65B0\u7684\u5BF9\u5C40\u5F00\u59CB";
        if (gl_pending_sync && gl_pending_sync.time > gl_time) {
          result = gl_pending_sync;
          gl_pending_sync = null;
        } else {
          gl_pending_sync = null;
          try {
            for (var iter = __forAwait(gl_cf_client), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
              const event = temp.value;
              if (event.type !== "message" || event.data.op !== "sync_player2observers") continue;
              const candidate = event.data.result;
              if (candidate.type === "view_sync" && candidate.time > gl_time) {
                result = candidate;
                break;
              }
            }
          } catch (temp) {
            error = [temp];
          } finally {
            try {
              more && (temp = iter.return) && (yield temp.call(iter));
            } finally {
              if (error)
                throw error[0];
            }
          }
        }
        yield window.sleep(388);
        game_msg.innerText = "\u{1F552}\u89E3\u6790\u5BF9\u5C40\u6570\u636E\u4E2D";
        yield window.sleep(388);
        gl_cf_archive = result.archive;
        gl_cf_health = result.health;
        gl_cf_initb = result.initb;
        gl_cf_balance = result.balance;
        gl_cf_mode = result.mode;
        gl_cf_first = result.first;
        gl_cf_color = result.color;
        gl_turns = result.turns;
        console.log(result);
        let uuids = result.uuids;
        const my_uuid = [...uuids].sort()[0];
        const foe_uuid = [...uuids].sort()[1];
        const a_index = uuids.indexOf(my_uuid);
        const b_index = uuids.indexOf(foe_uuid);
        const my_name = result.names[a_index];
        const foe_name = result.names[b_index];
        const my_score = result.scores[a_index];
        const foe_score = result.scores[b_index];
        let archive;
        if (gl_cf_archive !== "") {
          archive = ArchiveV0.load(BaseZalgo.decode(gl_cf_archive));
          gl_cf_archive = "";
        }
        gl_archive = archive;
        let hp;
        let rand_aic, rand_unity, rand_other, time;
        let my_color, foe_color;
        let my_stone, my_icon, my_label, my_index;
        let foe_stone, foe_icon, foe_label, foe_index;
        let first_color, first_icon, first_index;
        let game, board, state, timer;
        time = result.time;
        gl_time = time;
        gl_win = false;
        rand_aic = new RandAIC(result.seed_aic);
        rand_unity = new RandUnity(result.seed_unity);
        rand_other = new RandOther(result.seed_other);
        gl_rand_aic = rand_aic;
        gl_rand_unity = rand_unity;
        gl_rand_other = rand_other;
        score_tools_p1.innerText = my_score;
        score_tools_p2.innerText = foe_score;
        uuids = [my_uuid, foe_uuid].sort();
        my_color = uuids[rand_other.xor(2)] === my_uuid ? PLAYER_ENUM.BLACK : PLAYER_ENUM.WHITE;
        foe_color = my_color === PLAYER_ENUM.BLACK ? PLAYER_ENUM.WHITE : PLAYER_ENUM.BLACK;
        [first_color, first_icon, first_index] = rand_other.xor(2) === 0 ? [PLAYER_ENUM.BLACK, "\u26AB", 0] : [PLAYER_ENUM.WHITE, "\u26AA", 1];
        [my_stone, my_icon, my_label, my_index] = my_color === PLAYER_ENUM.BLACK ? [STONE_ENUM.BLACK, "\u26AB", "\u9ED1\u65B9", 0] : [STONE_ENUM.WHITE, "\u26AA", "\u767D\u65B9", 1];
        [foe_stone, foe_icon, foe_label, foe_index] = foe_color === PLAYER_ENUM.BLACK ? [STONE_ENUM.BLACK, "\u26AB", "\u9ED1\u65B9", 0] : [STONE_ENUM.WHITE, "\u26AA", "\u767D\u65B9", 1];
        board = new Board(9, 9);
        state = new State();
        timer = new GameTimer();
        gl_board = board;
        gl_state = state;
        gl_timer = timer;
        if (gl_cf_mode === "normal") game = new GameNormal(board, state, rand_aic, rand_unity);
        else if (gl_cf_mode === "blight") game = new GameBlight(board, state, rand_aic, rand_unity);
        else if (gl_cf_mode === "night") game = new GameNight(board, state, rand_aic, rand_unity);
        gl_game = game;
        if (gl_cf_color !== "rand") {
          [my_color, my_stone, my_icon, my_label, my_index] = gl_cf_color === "my" ? [PLAYER_ENUM.BLACK, STONE_ENUM.BLACK, "\u26AB", "\u9ED1\u65B9", 0] : [PLAYER_ENUM.WHITE, STONE_ENUM.WHITE, "\u26AA", "\u767D\u65B9", 1];
          [foe_color, foe_stone, foe_icon, foe_label, foe_index] = gl_cf_color === "foe" ? [PLAYER_ENUM.BLACK, STONE_ENUM.BLACK, "\u26AB", "\u9ED1\u65B9", 0] : [PLAYER_ENUM.WHITE, STONE_ENUM.WHITE, "\u26AA", "\u767D\u65B9", 1];
        }
        game_msg.innerText = "\u{1F373}\u5BF9\u5C40\u52A0\u8F7D\u4E2D";
        if (!archive) {
          state.hp = [gl_cf_health, gl_cf_health];
          hp = gl_cf_health;
          if (gl_cf_first !== "rand") {
            let temp_stone;
            if (gl_cf_first === "my") temp_stone = my_stone;
            else if (gl_cf_first === "foe") temp_stone = foe_stone;
            [first_color, first_icon, first_index] = temp_stone === STONE_ENUM.BLACK ? [PLAYER_ENUM.BLACK, "\u26AB", 0] : [PLAYER_ENUM.WHITE, "\u26AA", 1];
          }
          state.turn_player = first_color;
          if (gl_cf_initb) 1;
          if (gl_cf_balance && gl_cf_initb === "") yield game_balance();
          gl_my_clock = 300;
          gl_foe_clock = 300;
        } else {
          rand_aic = new RandAIC(archive.seed_aic);
          rand_unity = new RandUnity(archive.seed_unity);
          rand_other = new RandOther(archive.seed_other);
          gl_rand_aic = rand_aic;
          gl_rand_unity = rand_unity;
          gl_rand_other = rand_other;
          if (archive.mode === 0) game = new GameNormal(board, state, rand_aic, rand_unity);
          else if (archive.mode === 1) game = new GameBlight(board, state, rand_aic, rand_unity);
          else if (archive.mode === 2) game = new GameNight(board, state, rand_aic, rand_unity);
          gl_game = game;
          [first_color, first_icon, first_index] = archive.first === 0 ? [PLAYER_ENUM.BLACK, "\u26AB", 0] : [PLAYER_ENUM.WHITE, "\u26AA", 1];
          state.turn_player = first_color;
          gl_my_clock = archive.clocks[my_index];
          gl_foe_clock = archive.clocks[foe_index];
          state.hp = [...archive.healths];
          hp = archive.healths[0];
          yield game_archive();
        }
        gl_my_index = my_index;
        gl_foe_index = foe_index;
        gl_first_index = first_index;
        state.turn_player = first_color;
        game_msg.innerText = `${my_icon}|${my_name}|\u662F${my_label}`;
        yield window.sleep(788);
        game_msg.innerText = `${foe_icon}|${foe_name}|\u662F${foe_label}`;
        yield window.sleep(788);
        game_msg.innerText = `${first_icon}|${first_color === my_color ? my_name : foe_name}|\u662F\u5148\u624B`;
        yield window.sleep(788);
        document.documentElement.style.setProperty("--hp-color-p1", Math.trunc((state.hp[my_index] / hp).toFixed(2) * 100).toString());
        document.documentElement.style.setProperty("--hp-color-p2", Math.trunc((state.hp[foe_index] / hp).toFixed(2) * 100).toString());
        game_p1_name.innerText = my_name;
        game_p1_hp.innerText = `HP: ${state.hp[my_index]}/${hp}`;
        game_p1_ascend.innerText = "PR: 0+0";
        game_p1_stone.innerText = my_icon;
        game_p1_clock.innerText = `CLK: ${gl_my_clock}`;
        game_p2_name.innerText = foe_name;
        game_p2_hp.innerText = `HP: ${state.hp[foe_index]}/${hp}`;
        game_p2_ascend.innerText = "PR: 0+0";
        game_p2_stone.innerText = foe_icon;
        game_p2_clock.innerText = `CLK: ${gl_foe_clock}`;
        game_redraw();
        view_accept();
        view_instruct();
        const ascend_points = [[], []];
        while (true) {
          const [my_turn, turn_icon, turn_label] = my_color === state.turn_player ? [true, my_icon, "\u6211\u65B9"] : [false, foe_icon, "\u5BF9\u65B9"];
          game_msg.innerText = `${turn_icon}\u8F6E\u5230|${my_turn ? my_name : foe_name}|\u843D\u5B50`;
          gl_msg = game_msg.innerText;
          turn_color(my_turn);
          game_match(my_stone, foe_stone);
          if (my_turn && start) {
            gl_cf_client.stop_resend(900);
          } else if (my_turn) start = true;
          const [pass, cp] = yield view_pice(my_stone, foe_stone);
          if (!gl_gameing) break;
          gl_ui.ascend_counter(state.turn_pos[0], state.turn_pos[1]);
          title_clear();
          gl_ui.clear_view_turn();
          gl_ui.clear_view_move();
          gl_ui.draw_stone_turn(state.turn_pos[0], state.turn_pos[1], pass ? "#FFD700" : "#00FFC5", 5);
          gl_sound.play_stone();
          const points = game.ed_as_1();
          if (!points) {
            gl_ui.clear_stone_fill(state.turn_pos[0], state.turn_pos[1]);
            gl_ui.clear_stone_ascend(state.turn_pos[0], state.turn_pos[1]);
            gl_ui.draw_stone_fill(state.turn_pos[0], state.turn_pos[1], state.turn_player === PLAYER_ENUM.BLACK ? "#2c3e50" : "#ecf0f1");
            const normal_pos = gl_board.get_pos(state.turn_pos[0], state.turn_pos[1]);
            if (normal_pos.plant === PLANT_ENUM.ONE) gl_ui.draw_plant(normal_pos.x, normal_pos.y);
            else if (normal_pos.plant === PLANT_ENUM.TWO) gl_ui.draw_2plant(normal_pos.x, normal_pos.y);
            gl_ui.draw_effect_place(state.turn_pos[0], state.turn_pos[1], state.turn_player === PLAYER_ENUM.BLACK ? "#2c3e50" : "#95a5a6");
          } else if (state.ascend_status === ASCEND_ENUM.START) {
            ascend_points[0].push(...points);
            points.forEach((pos) => {
              if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
              gl_ui.clear_stone_fill(pos.x, pos.y);
              gl_ui.clear_stone_ascend(pos.x, pos.y);
              gl_ui.draw_stone_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? "#e74c3c" : "#3498db");
            });
            yield gl_ui.ascend_lift(points.map((pos) => ({
              "gx": pos.x,
              "gy": pos.y,
              "power": pos.plant === PLANT_ENUM.ONE ? 2 : pos.plant === PLANT_ENUM.TWO ? 3 : 1,
              "plant": pos.plant === PLANT_ENUM.ONE ? 1 : pos.plant === PLANT_ENUM.TWO ? 2 : 0,
              "color": pos.stone === STONE_ENUM.BLACK_ASCEND ? "#e74c3c" : "#3498db",
              "stone_color": pos.stone === STONE_ENUM.BLACK_ASCEND ? "#2c3e50" : "#ecf0f1",
              "marker_color": pos.stone === STONE_ENUM.BLACK_ASCEND ? "#e74c3c" : "#3498db"
            })), state.turn_player === my_color ? "left" : "right");
            points.forEach((pos) => {
              if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
              gl_ui.draw_effect_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? "#e74c3c" : "#3498db");
            });
          } else if (state.ascend_status === ASCEND_ENUM.END) {
            ascend_points[1].push(...points);
            points.forEach((pos) => {
              if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
              gl_ui.clear_stone_fill(pos.x, pos.y);
              gl_ui.clear_stone_ascend(pos.x, pos.y);
              gl_ui.draw_stone_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? "#e74c3c" : "#3498db");
            });
            yield gl_ui.ascend_lift(points.map((pos) => ({
              "gx": pos.x,
              "gy": pos.y,
              "power": pos.plant === PLANT_ENUM.ONE ? 2 : pos.plant === PLANT_ENUM.TWO ? 3 : 1,
              "plant": pos.plant === PLANT_ENUM.ONE ? 1 : pos.plant === PLANT_ENUM.TWO ? 2 : 0,
              "color": pos.stone === STONE_ENUM.BLACK_ASCEND ? "#e74c3c" : "#3498db",
              "stone_color": pos.stone === STONE_ENUM.BLACK_ASCEND ? "#2c3e50" : "#ecf0f1",
              "marker_color": pos.stone === STONE_ENUM.BLACK_ASCEND ? "#e74c3c" : "#3498db"
            })), state.turn_player === my_color ? "left" : "right");
            points.forEach((pos) => {
              if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
              gl_ui.draw_effect_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? "#e74c3c" : "#3498db");
            });
          }
          ascend_points[0].forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
            if (gl_ui.ascend_is_lifted(pos.x, pos.y)) return;
            gl_ui.clear_stone_fill(pos.x, pos.y);
            gl_ui.draw_stone_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? "#e74c3c" : "#3498db");
          });
          ascend_points[1].forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_ASCEND && pos.stone !== STONE_ENUM.WHITE_ASCEND) return;
            if (gl_ui.ascend_is_lifted(pos.x, pos.y)) return;
            gl_ui.clear_stone_fill(pos.x, pos.y);
            gl_ui.draw_stone_ascend(pos.x, pos.y, pos.stone === STONE_ENUM.BLACK_ASCEND ? "#e74c3c" : "#3498db");
          });
          if (state.ascend_status !== ASCEND_ENUM.NONE) {
            game_p1_ascend.innerText = game_power(my_stone);
            game_p2_ascend.innerText = game_power(foe_stone);
            if (game_p1_ascend.innerText !== "PR\uFF1A0+0") game_p1_ascend.classList.add("text-primary");
            if (game_p2_ascend.innerText !== "PR\uFF1A0+0") game_p2_ascend.classList.add("text-primary");
          }
          const as = game.ed_as_2(true);
          game_match(my_stone, foe_stone);
          const pending_hp = [state.hp[0] - (state.pending_damage ? state.pending_damage[0] : 0), state.hp[1] - (state.pending_damage ? state.pending_damage[1] : 0)];
          const my_hp = my_color === PLAYER_ENUM.BLACK ? pending_hp[0] : pending_hp[1];
          const foe_hp = foe_color === PLAYER_ENUM.BLACK ? pending_hp[0] : pending_hp[1];
          if (as !== void 0) {
            const fx_done = gl_ui.ascend_settle(
              { "left": game_p1_hp, "right": game_p2_hp },
              () => {
                if (state.pending_damage) {
                  state.hp[0] -= state.pending_damage[0];
                  state.hp[1] -= state.pending_damage[1];
                  state.pending_damage = null;
                }
                game_p1_hp.innerText = `HP\uFF1A${my_hp}/${hp}`;
                game_p2_hp.innerText = `HP\uFF1A${foe_hp}/${hp}`;
                document.documentElement.style.setProperty("--hp-color-p1", Math.trunc((my_hp / hp).toFixed(2) * 100).toString());
                document.documentElement.style.setProperty("--hp-color-p2", Math.trunc((foe_hp / hp).toFixed(2) * 100).toString());
              },
              () => {
                game_msg.innerText = `${my_icon}|${my_name}|\u5269\u4F59${my_hp} \xB7 ${foe_icon}|${foe_name}|\u5269\u4F59${foe_hp}`;
              }
            );
            game_msg.innerText = `${game_p1_ascend.innerText.slice(3)} VS ${game_p2_ascend.innerText.slice(3)}`;
            yield window.sleep(900);
            game_p1_ascend.innerText = "PR\uFF1A0+0";
            game_p2_ascend.innerText = "PR\uFF1A0+0";
            game_p1_ascend.classList.remove("text-primary");
            game_p2_ascend.classList.remove("text-primary");
            yield fx_done;
          }
          ascend_points[0].forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_USED && pos.stone !== STONE_ENUM.WHITE_USED) return;
            gl_ui.clear_stone_ascend(pos.x, pos.y);
            gl_ui.clear_plant(pos.x, pos.y);
          });
          ascend_points[1].forEach((pos) => {
            if (pos.stone !== STONE_ENUM.BLACK_USED && pos.stone !== STONE_ENUM.WHITE_USED) return;
            gl_ui.clear_stone_ascend(pos.x, pos.y);
            gl_ui.clear_plant(pos.x, pos.y);
          });
          if (as !== void 0) {
            ascend_points[0].length = 0;
            ascend_points[1].length = 0;
          }
          game.ed_tr_2();
          game_match(my_stone, foe_stone);
          const win = game.ed_win();
          if (win) {
            span_end_time.innerText = format_ms((yield window.http_time_ms()) - time);
            span_end_hp.innerText = `${my_hp} vs ${foe_hp}`;
            span_end_win.innerText = win === my_color ? my_name : foe_name;
            game_msg.innerText = win === my_color ? `\u{1F3C6}|${my_name}|\u80DC\u5229${my_icon}` : `\u{1F480}|${foe_name}|\u80DC\u5229${foe_icon}`;
            gl_win = true;
            break;
          }
          const plants = game.ed_pl_1();
          if (plants) {
            plants.forEach((pos) => {
              gl_ui.clear_plant(pos.x, pos.y);
              const plant_count = pos.plant === PLANT_ENUM.TWO ? 2 : 1;
              gl_ui.draw_effect_plant(pos.x, pos.y, plant_count);
              plant_count === 1 ? gl_ui.draw_plant(pos.x, pos.y) : gl_ui.draw_2plant(pos.x, pos.y);
            });
            game_msg.innerText = "\u{1FAB4}\u690D\u7269\u5DF2\u751F\u6210";
            gl_sound.play_plant();
            yield window.sleep(488);
          }
          game.ed_as_3();
        }
        gl_ui.stop_click2move();
        gl_cf_client.notify("$", null);
        gl_ui.notify_click("$");
        gl_cf_client.stop_resend(900);
        button_tools_restart.disabled = false;
        button_tools_restart.classList.remove("pe-none");
        if (gl_win) {
          dialog_end.classList.remove("d-none");
          dialog_end.show();
        }
      });
      var exportf = () => {
        let mode;
        if (gl_cf_mode === "normal") mode = 0;
        else if (gl_cf_mode === "blight") mode = 1;
        else if (gl_cf_mode === "night") mode = 2;
        else throw Error("exportf error");
        const black_clock = gl_my_index === 0 ? gl_my_clock : gl_foe_clock;
        const white_clock = gl_my_index === 1 ? gl_my_clock : gl_foe_clock;
        return BaseZalgo.encode(ArchiveV0.save(
          [gl_rand_aic.seed, gl_rand_unity.seed, gl_rand_other.seed],
          [black_clock, white_clock],
          [gl_cf_health, gl_cf_health],
          gl_board.turns,
          gl_state.turn_count,
          gl_first_index,
          mode
        ));
      };
      if (!window.MainExports) window.MainExports = {};
      window.MainExports.View = { setup, run, exportf };
    }
  });
  require_view();
})();
