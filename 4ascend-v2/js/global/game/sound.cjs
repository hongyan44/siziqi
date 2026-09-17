/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 声音
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
class Sound {
    /**
     * @description: 初始化
     * @param {number} mainv
     * @param {number} stonev
     * @param {number} plantv
     * @param {number} matchv
     * @param {number} timer_tickv
     * @param {number} timer_endv
     * @param {number} annihilationv
     * @param {number} hitv
     * @param {number} orbitv
     * @param {number} flyv
     * @return {Sound}
     */
    constructor(mainv, stonev, plantv, matchv, timer_tickv, timer_endv, annihilationv, hitv, orbitv, flyv) {
        this.main = new Audio('/audio/game/main.opus?v=1');
        this.stone = new Audio('/audio/game/stone.opus?v=1');
        this.plant = new Audio('/audio/game/plant.opus?v=1');
        this.match = new Audio('/audio/game/match.opus?v=1');
        this.timer_tick = new Audio('/audio/game/timer_tick.opus?v=1');
        this.timer_end = new Audio('/audio/game/timer_end.opus?v=1');
        this.annihilation = new Audio('/audio/game/annihilation.mp3?v=1');
        this.hit = new Audio('/audio/game/hit.mp3?v=1');
        this.orbit = new Audio('/audio/game/orbit.mp3?v=1');
        this.fly = new Audio('/audio/game/fly.mp3?v=1');

        this.mainv = mainv;
        this.stonev = stonev;
        this.plantv = plantv;
        this.matchv = matchv;
        this.timer_tickv = timer_tickv;
        this.timer_endv = timer_endv;
        this.annihilationv = Number.isFinite(annihilationv) ? annihilationv : stonev;
        this.hitv = Number.isFinite(hitv) ? hitv : stonev;
        this.orbitv = Number.isFinite(orbitv) ? orbitv : stonev;
        this.flyv = Number.isFinite(flyv) ? flyv : stonev;

        this.custom_tracks = [];
        this.custom_index = -1;
        this.custom_mode = localStorage.getItem('music_mode') === 'random' ? 'random' : 'order';
        this.default_main_src = '/audio/game/main.opus?v=1';
        this.main.preload = 'auto';
        this.orbit.loop = true;
        this.orbit_playing = false;

        this.context = null;
        this.init_context();
    };

    /**
     * @description: 等待资源加载完毕
     * @return {Promise<void>}
     */
    async init() {
        const load = (audio) => {
            return new Promise((resolve, reject) => {
                // 如果已经加载好了
                if (audio.readyState >= 4) return resolve();

                audio.addEventListener('canplaythrough', () => resolve(), { 'once': true });
                audio.addEventListener('error', (e) => reject(e), { 'once': true });

                // 强制触发加载
                audio.load();
            });
        };

        // 并行等待所有音频加载
        await Promise.all([
            load(this.main),
            load(this.stone),
            load(this.plant),
            load(this.match),
            load(this.timer_tick),
            load(this.timer_end),
            load(this.annihilation),
            load(this.hit),
            load(this.orbit),
            load(this.fly),
        ]);

        this.init_context();

        // 先空音量播放一下
        this.gain.main_gain.value = 0;
        this.gain.stone_gain.value = 0;
        this.gain.plant_gain.value = 0;
        this.gain.match_gain.value = 0;
        this.gain.tick_gain.value = 0;
        this.gain.end_gain.value = 0;
        this.gain.annihilation_gain.value = 0;
        this.gain.hit_gain.value = 0;
        this.gain.orbit_gain.value = 0;
        this.gain.fly_gain.value = 0;

        // 停止并归零
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
        reset(this.annihilation);
        reset(this.hit);
        reset(this.orbit);
        reset(this.fly);

        // 设置回去音量
        this.gain.main_gain.value = this.mainv;
        this.gain.stone_gain.value = this.stonev;
        this.gain.plant_gain.value = this.plantv;
        this.gain.match_gain.value = this.matchv;
        this.gain.tick_gain.value = this.timer_tickv;
        this.gain.end_gain.value = this.timer_endv;
        this.gain.annihilation_gain.value = this.annihilationv;
        this.gain.hit_gain.value = this.hitv;
        this.gain.orbit_gain.value = this.orbitv;
        this.gain.fly_gain.value = this.flyv;
    };

    /**
     * @description: 初始化 Web Audio Context
     * @return {void}
     */
    init_context() {
        if (this.context) return;

        // 初始化
        this.context = new (window.AudioContext || window.webkitAudioContext)();

        // 创建 Source
        const main_source = this.context.createMediaElementSource(this.main);
        const stone_source = this.context.createMediaElementSource(this.stone);
        const plant_source = this.context.createMediaElementSource(this.plant);
        const match_source = this.context.createMediaElementSource(this.match);
        const tick_source = this.context.createMediaElementSource(this.timer_tick);
        const end_source = this.context.createMediaElementSource(this.timer_end);
        const annihilation_source = this.context.createMediaElementSource(this.annihilation);
        const hit_source = this.context.createMediaElementSource(this.hit);
        const orbit_source = this.context.createMediaElementSource(this.orbit);
        const fly_source = this.context.createMediaElementSource(this.fly);

        // 音量增益节点
        const main_gain = this.context.createGain();
        const stone_gain = this.context.createGain();
        const plant_gain = this.context.createGain();
        const match_gain = this.context.createGain();
        const tick_gain = this.context.createGain();
        const end_gain = this.context.createGain();
        const annihilation_gain = this.context.createGain();
        const hit_gain = this.context.createGain();
        const orbit_gain = this.context.createGain();
        const fly_gain = this.context.createGain();

        main_gain.gain.value = this.mainv;
        stone_gain.gain.value = this.stonev;
        plant_gain.gain.value = this.plantv;
        match_gain.gain.value = this.matchv;
        tick_gain.gain.value = this.timer_tickv;
        end_gain.gain.value = this.timer_endv;
        annihilation_gain.gain.value = this.annihilationv;
        hit_gain.gain.value = this.hitv;
        orbit_gain.gain.value = this.orbitv;
        fly_gain.gain.value = this.flyv;

        this.gain = { main_gain, stone_gain, plant_gain, match_gain, tick_gain, end_gain, annihilation_gain, hit_gain, orbit_gain, fly_gain };

        // 节点连接
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

        annihilation_source.connect(annihilation_gain);
        annihilation_gain.connect(this.context.destination);

        hit_source.connect(hit_gain);
        hit_gain.connect(this.context.destination);

        orbit_source.connect(orbit_gain);
        orbit_gain.connect(this.context.destination);

        fly_source.connect(fly_gain);
        fly_gain.connect(this.context.destination);
    };

    /**
     * @description: 主界面音效
     */
    async play_main() {
        if (this.mainv <= 0) return;
        this.init_context();
        if (this.context.state === 'suspended') await this.context.resume();
        await this.load_custom_playlist();

        if (this.custom_tracks.length) return this.play_custom();

        this.main.pause();
        this.main.src = this.default_main_src;
        this.main.currentTime = 0;
        this.main.loop = true;
        this.main.onended = null;
        this.main.play();
    };

    /**
     * @description: 载入本地歌单
     * @return {Promise<number>}
     */
    async load_custom_playlist() {
        if (!window.MusicPlaylist) return 0;
        const tracks = await window.MusicPlaylist.urls();
        this.custom_tracks.forEach((track) => track.url && URL.revokeObjectURL(track.url));
        this.custom_tracks = tracks;
        this.custom_mode = window.MusicPlaylist.get_mode();
        if (this.custom_index >= tracks.length) this.custom_index = -1;
        return tracks.length;
    }

    /**
     * @description: 播放指定或下一首自定义音乐
     * @param {number} index
     * @return {Promise<boolean>}
     */
    async play_custom(index = -1) {
        if (this.mainv <= 0) return false;
        if (!this.custom_tracks.length) await this.load_custom_playlist();
        if (!this.custom_tracks.length) return false;

        if (index >= 0 && index < this.custom_tracks.length) {
            this.custom_index = index;
        } else if (this.custom_mode === 'random') {
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
            await this.main.play();
            return true;
        } catch (_) {
            return false;
        }
    }

    play_next_custom() {
        return this.play_custom();
    }

    stop_main() {
        this.main.pause();
        this.main.currentTime = 0;
    };

    async refresh_custom_playlist() {
        const was_playing = !this.main.paused;
        await this.load_custom_playlist();
        if (!this.custom_tracks.length) {
            this.main.src = this.default_main_src;
            this.main.loop = true;
            this.main.onended = null;
            if (was_playing) this.main.play();
            return;
        }
        if (was_playing) await this.play_custom(Math.min(this.custom_index, this.custom_tracks.length - 1));
    };

    /**
     * @description: 落子音效
     */
    play_stone() {
        if (this.stonev <= 0) return;
        this.init_context();
        if (this.context.state === 'suspended') this.context.resume();

        this.stone.pause();
        this.stone.currentTime = 0;
        this.stone.play();
    };

    /**
     * @description: 植物生成音效
     */
    play_plant() {
        if (this.plantv <= 0) return;
        this.init_context();
        if (this.context.state === 'suspended') this.context.resume();

        this.plant.pause();
        this.plant.currentTime = 0;
        this.plant.play();
    };

    /**
     * @description: 匹配成功音效
     */
    play_match() {
        if (this.matchv <= 0) return;
        this.init_context();
        if (this.context.state === 'suspended') this.context.resume();

        this.match.pause();
        this.match.currentTime = 0;
        this.match.play();
    };

    /**
     * @description: 计时滴答音效
     */
    play_timer_tick() {
        if (this.timer_tickv <= 0) return;
        this.init_context();
        if (this.context.state === 'suspended') this.context.resume();

        this.timer_tick.pause();
        this.timer_tick.currentTime = 0;
        this.timer_tick.play();
    };

    /**
     * @description: 计时结束音效
     */
    play_timer_end() {
        if (this.timer_endv <= 0) return;
        this.init_context();
        if (this.context.state === 'suspended') this.context.resume();

        this.timer_end.pause();
        this.timer_end.currentTime = 0;
        this.timer_end.play();
    };
    /**
     * @description: ASCEND 湮灭音效
     */
    play_annihilation() {
        if (this.annihilationv <= 0) return;
        this.init_context();
        if (this.context.state === 'suspended') this.context.resume();

        this.annihilation.pause();
        this.annihilation.currentTime = 0;
        this.annihilation.play();
    };

    /**
     * @description: ASCEND 受击音效
     */
    play_hit() {
        if (this.hitv <= 0) return;
        this.init_context();
        if (this.context.state === 'suspended') this.context.resume();

        this.hit.pause();
        this.hit.currentTime = 0;
        this.hit.play();
    };

    /**
     * @description: ASCEND 盘旋音效
     */
    play_orbit() {
        if (this.orbitv <= 0) return;
        this.init_context();
        if (this.context.state === 'suspended') this.context.resume();
        if (this.orbit_playing) return;

        this.orbit.loop = true;
        this.orbit.currentTime = 0;
        this.orbit_playing = true;
        this.orbit.play().catch(() => { this.orbit_playing = false; });
    };

    stop_orbit() {
        this.orbit.pause();
        this.orbit.currentTime = 0;
        this.orbit.loop = false;
        this.orbit_playing = false;
    };

    /**
     * @description: ASCEND 飞行打血音效
     */
    play_fly() {
        if (this.flyv <= 0) return;
        this.init_context();
        if (this.context.state === 'suspended') this.context.resume();

        this.fly.pause();
        this.fly.currentTime = 0;
        this.fly.play();
    };
}

export { Sound };