(() => {
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

  // js/global/game/sound.cjs
  var Sound = class {
    /**
     * @description: 初始化
     * @param {number} mainv
     * @param {number} stonev
     * @param {number} plantv
     * @param {number} matchv
     * @param {number} timer_tickv
     * @param {number} timer_endv
     * @return {Sound}
     */
    constructor(mainv, stonev, plantv, matchv, timer_tickv, timer_endv) {
      this.main = new Audio("/audio/game/main.opus?v=1");
      this.stone = new Audio("/audio/game/stone.opus?v=1");
      this.plant = new Audio("/audio/game/plant.opus?v=1");
      this.match = new Audio("/audio/game/match.opus?v=1");
      this.timer_tick = new Audio("/audio/game/timer_tick.opus?v=1");
      this.timer_end = new Audio("/audio/game/timer_end.opus?v=1");
      this.mainv = mainv;
      this.stonev = stonev;
      this.plantv = plantv;
      this.matchv = matchv;
      this.timer_tickv = timer_tickv;
      this.timer_endv = timer_endv;
      this.custom_tracks = [];
      this.custom_index = -1;
      this.custom_mode = localStorage.getItem("music_mode") === "random" ? "random" : "order";
      this.default_main_src = "/audio/game/main.opus?v=1";
      this.main.preload = "auto";
      this.context = null;
      this.init_context();
    }
    /**
     * @description: 等待资源加载完毕
     * @return {Promise<void>}
     */
    init() {
      return __async(this, null, function* () {
        const load = (audio) => {
          return new Promise((resolve, reject) => {
            if (audio.readyState >= 4) return resolve();
            audio.addEventListener("canplaythrough", () => resolve(), { "once": true });
            audio.addEventListener("error", (e) => reject(e), { "once": true });
            audio.load();
          });
        };
        yield Promise.all([
          load(this.main),
          load(this.stone),
          load(this.plant),
          load(this.match),
          load(this.timer_tick),
          load(this.timer_end)
        ]);
        this.init_context();
        this.gain.main_gain.value = 0;
        this.gain.stone_gain.value = 0;
        this.gain.plant_gain.value = 0;
        this.gain.match_gain.value = 0;
        this.gain.tick_gain.value = 0;
        this.gain.end_gain.value = 0;
        const reset = (audio) => {
          audio.play();
          audio.pause();
          audio.currentTime = 0;
        };
        reset(this.main);
        reset(this.plant);
        reset(this.stone);
        reset(this.match);
        reset(this.timer_tick);
        reset(this.timer_end);
        this.gain.main_gain.value = this.mainv;
        this.gain.stone_gain.value = this.stonev;
        this.gain.plant_gain.value = this.plantv;
        this.gain.match_gain.value = this.matchv;
        this.gain.tick_gain.value = this.timer_tickv;
        this.gain.end_gain.value = this.timer_endv;
      });
    }
    /**
     * @description: 初始化 Web Audio Context
     * @return {void}
     */
    init_context() {
      if (this.context) return;
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      const main_source = this.context.createMediaElementSource(this.main);
      const stone_source = this.context.createMediaElementSource(this.stone);
      const plant_source = this.context.createMediaElementSource(this.plant);
      const match_source = this.context.createMediaElementSource(this.match);
      const tick_source = this.context.createMediaElementSource(this.timer_tick);
      const end_source = this.context.createMediaElementSource(this.timer_end);
      const main_gain = this.context.createGain();
      const stone_gain = this.context.createGain();
      const plant_gain = this.context.createGain();
      const match_gain = this.context.createGain();
      const tick_gain = this.context.createGain();
      const end_gain = this.context.createGain();
      main_gain.gain.value = this.mainv;
      stone_gain.gain.value = this.stonev;
      plant_gain.gain.value = this.plantv;
      match_gain.gain.value = this.matchv;
      tick_gain.gain.value = this.timer_tickv;
      end_gain.gain.value = this.timer_endv;
      this.gain = { main_gain, stone_gain, plant_gain, match_gain, tick_gain, end_gain };
      main_source.connect(main_gain);
      main_gain.connect(this.context.destination);
      stone_source.connect(stone_gain);
      stone_gain.connect(this.context.destination);
      plant_source.connect(plant_gain);
      plant_gain.connect(this.context.destination);
      match_source.connect(match_gain);
      match_gain.connect(this.context.destination);
      tick_source.connect(tick_gain);
      tick_gain.connect(this.context.destination);
      end_source.connect(end_gain);
      end_gain.connect(this.context.destination);
    }
    /**
     * @description: 主界面音效
     */
    play_main() {
      return __async(this, null, function* () {
        if (this.mainv <= 0) return;
        this.init_context();
        if (this.context.state === "suspended") yield this.context.resume();
        yield this.load_custom_playlist();
        if (this.custom_tracks.length) return this.play_custom();
        this.main.pause();
        this.main.src = this.default_main_src;
        this.main.currentTime = 0;
        this.main.loop = true;
        this.main.onended = null;
        this.main.play();
      });
    }
    /**
     * @description: 载入本地歌单
     * @return {Promise<number>}
     */
    load_custom_playlist() {
      return __async(this, null, function* () {
        if (!window.MusicPlaylist) return 0;
        const tracks = yield window.MusicPlaylist.urls();
        this.custom_tracks.forEach((track) => track.url && URL.revokeObjectURL(track.url));
        this.custom_tracks = tracks;
        this.custom_mode = window.MusicPlaylist.get_mode();
        if (this.custom_index >= tracks.length) this.custom_index = -1;
        return tracks.length;
      });
    }
    /**
     * @description: 播放指定或下一首自定义音乐
     * @param {number} index
     * @return {Promise<boolean>}
     */
    play_custom(index = -1) {
      return __async(this, null, function* () {
        if (this.mainv <= 0) return false;
        if (!this.custom_tracks.length) yield this.load_custom_playlist();
        if (!this.custom_tracks.length) return false;
        if (index >= 0 && index < this.custom_tracks.length) {
          this.custom_index = index;
        } else if (this.custom_mode === "random") {
          const candidates = this.custom_tracks.map((_, i) => i).filter((i) => i !== this.custom_index);
          this.custom_index = candidates[Math.floor(Math.random() * candidates.length)];
        } else {
          this.custom_index = (this.custom_index + 1) % this.custom_tracks.length;
        }
        const track = this.custom_tracks[this.custom_index];
        this.main.pause();
        this.main.src = track.url;
        this.main.loop = false;
        this.main.onended = () => this.play_next_custom();
        this.main.currentTime = 0;
        this.main.load();
        try {
          yield this.main.play();
          return true;
        } catch (_) {
          return false;
        }
      });
    }
    play_next_custom() {
      return this.play_custom();
    }
    stop_main() {
      this.main.pause();
      this.main.currentTime = 0;
    }
    refresh_custom_playlist() {
      return __async(this, null, function* () {
        const was_playing = !this.main.paused;
        yield this.load_custom_playlist();
        if (!this.custom_tracks.length) {
          this.main.src = this.default_main_src;
          this.main.loop = true;
          this.main.onended = null;
          if (was_playing) this.main.play();
          return;
        }
        if (was_playing) yield this.play_custom(Math.min(this.custom_index, this.custom_tracks.length - 1));
      });
    }
    /**
     * @description: 落子音效
     */
    play_stone() {
      if (this.stonev <= 0) return;
      this.init_context();
      if (this.context.state === "suspended") this.context.resume();
      this.stone.pause();
      this.stone.currentTime = 0;
      this.stone.play();
    }
    /**
     * @description: 植物生成音效
     */
    play_plant() {
      if (this.plantv <= 0) return;
      this.init_context();
      if (this.context.state === "suspended") this.context.resume();
      this.plant.pause();
      this.plant.currentTime = 0;
      this.plant.play();
    }
    /**
     * @description: 匹配成功音效
     */
    play_match() {
      if (this.matchv <= 0) return;
      this.init_context();
      if (this.context.state === "suspended") this.context.resume();
      this.match.pause();
      this.match.currentTime = 0;
      this.match.play();
    }
    /**
     * @description: 计时滴答音效
     */
    play_timer_tick() {
      if (this.timer_tickv <= 0) return;
      this.init_context();
      if (this.context.state === "suspended") this.context.resume();
      this.timer_tick.pause();
      this.timer_tick.currentTime = 0;
      this.timer_tick.play();
    }
    /**
     * @description: 计时结束音效
     */
    play_timer_end() {
      if (this.timer_endv <= 0) return;
      this.init_context();
      if (this.context.state === "suspended") this.context.resume();
      this.timer_end.pause();
      this.timer_end.currentTime = 0;
      this.timer_end.play();
    }
  };
})();
