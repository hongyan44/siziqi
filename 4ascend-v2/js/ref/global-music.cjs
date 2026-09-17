/*
 * @Description: 当前页面背景音乐控制器
 */
const GLOBAL_MUSIC_HELP_KEY = 'global_music_help_shown';
const GLOBAL_MUSIC_CLICK_WINDOW = 1000;
const GLOBAL_MUSIC_DEFAULT_SRC = '/audio/game/main.opus?v=1';

(() => {
    const audio = new Audio(GLOBAL_MUSIC_DEFAULT_SRC);
    let tracks = null;
    let track_index = -1;
    let loading_tracks = null;
    let enabled = false;
    let click_count = 0;
    let click_timer = null;

    audio.preload = 'auto';
    audio.loop = true;

    const show_message = (message, placement = 'top-right') => {
        const old = document.getElementById('global_music_message');
        if (old) old.remove();

        const element = document.createElement('div');
        element.id = 'global_music_message';
        element.textContent = message;
        const position = placement === 'top-right'
            ? 'top:16px;right:16px;'
            : 'left:50%;bottom:24px;transform:translateX(-50%);';
        element.style.cssText = `position:fixed;${position}z-index:10000;max-width:min(360px,calc(100vw - 32px));padding:10px 18px;border-radius:8px;background:rgba(32,35,42,.94);color:#fff;font:14px/1.4 sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.25);pointer-events:none;transition:opacity .25s ease;`;
        document.body.appendChild(element);
        setTimeout(() => { element.style.opacity = '0'; }, 2400);
        setTimeout(() => element.remove(), 2700);
    };

    const show_help = () => {
        if (localStorage.getItem(GLOBAL_MUSIC_HELP_KEY) === '1') return;
        localStorage.setItem(GLOBAL_MUSIC_HELP_KEY, '1');
        show_message('音乐按钮：单击切换下一首；1 秒内双击开始/停止播放。');
    };

    const sync_icon = (playing) => {
        const icon = document.getElementById('icon_music_toggle');
        if (icon) icon.name = playing ? 'volume-up' : 'volume-mute';

        const title = '单击切换下一首；1 秒内双击开始/停止播放';
        const button = document.getElementById('button_music_toggle');
        if (button) {
            button.setAttribute('aria-pressed', playing ? 'true' : 'false');
            button.setAttribute('aria-label', title);
            button.title = title;
        }
    };

    const set_volume = () => {
        try {
            const opt = JSON.parse(localStorage.getItem('opt') || '{}');
            const value = Number(opt.bgmv);
            audio.volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value / 5)) : 0.2;
        } catch (_) {
            audio.volume = 0.2;
        }
    };

    const revoke_tracks = () => {
        (tracks || []).forEach((track) => track.url && URL.revokeObjectURL(track.url));
    };

    const load_tracks = async (force = false) => {
        if (!force && tracks) return tracks;
        if (loading_tracks) return loading_tracks;
        loading_tracks = (async () => {
            let next_tracks = [];
            try {
                next_tracks = window.MusicPlaylist ? await window.MusicPlaylist.urls() : [];
            } catch (_) { /* 没有本地歌单时使用默认音乐 */ }
            revoke_tracks();
            tracks = next_tracks;
            if (track_index >= tracks.length) track_index = -1;
            return tracks;
        })();
        try {
            return await loading_tracks;
        } finally {
            loading_tracks = null;
        }
    };

    const set_default_source = () => {
        audio.loop = true;
        audio.onended = null;
        if (!audio.src || !audio.src.includes('/audio/game/main.opus')) {
            audio.src = GLOBAL_MUSIC_DEFAULT_SRC;
            audio.load();
        }
    };

    const set_track_source = () => {
        const track = tracks[track_index];
        if (!track) return false;
        audio.src = track.url;
        audio.loop = false;
        audio.onended = () => {
            track_index = (track_index + 1) % tracks.length;
            play();
        };
        audio.currentTime = 0;
        audio.load();
        return true;
    };

    const play = async () => {
        set_volume();
        const initial_play = tracks === null ? audio.play() : null;
        await load_tracks();

        if (tracks.length) {
            if (track_index < 0 || track_index >= tracks.length) track_index = 0;
            if (audio.src !== tracks[track_index].url) set_track_source();
        } else {
            set_default_source();
        }

        if (!audio.paused) {
            enabled = true;
            sync_icon(true);
            return true;
        }

        try {
            if (initial_play) await initial_play;
            else await audio.play();
            enabled = true;
            sync_icon(true);
            return true;
        } catch (_) {
            enabled = false;
            sync_icon(false);
            return false;
        }
    };

    const stop = () => {
        enabled = false;
        audio.pause();
        audio.currentTime = 0;
        sync_icon(false);
    };

    const next_track = async () => {
        await load_tracks(true);
        if (!tracks.length) {
            set_default_source();
            await play();
            show_message('当前没有自定义歌单，已重新播放默认背景音乐。', 'bottom');
            return;
        }

        track_index = (track_index + 1) % tracks.length;
        set_track_source();
        await play();
        show_message('已切换到下一首背景音乐。', 'bottom');
    };

    const toggle = () => {
        if (enabled && !audio.paused) stop();
        else play().then((playing) => playing && show_message('已开始播放背景音乐。', 'bottom'));
    };

    const handle_button_click = () => {
        show_help();
        click_count += 1;
        if (click_count === 1) {
            click_timer = setTimeout(() => {
                click_count = 0;
                next_track();
            }, GLOBAL_MUSIC_CLICK_WINDOW);
            return;
        }

        clearTimeout(click_timer);
        click_timer = null;
        click_count = 0;
        toggle();
    };

    const refresh_playlist = async () => {
        const was_playing = enabled && !audio.paused;
        await load_tracks(true);
        if (!tracks.length) set_default_source();
        else {
            if (track_index < 0 || track_index >= tracks.length) track_index = 0;
            set_track_source();
        }
        if (was_playing) await play();
    };

    const cleanup = () => {
        if (click_timer) clearTimeout(click_timer);
        click_timer = null;
        click_count = 0;
        stop();
        revoke_tracks();
        tracks = null;
        audio.removeAttribute('src');
        audio.load();
    };

    const bind = () => {
        const button = document.getElementById('button_music_toggle');
        if (button && !button.dataset.globalMusicBound) {
            button.dataset.globalMusicBound = '1';
            button.addEventListener('click', handle_button_click);
        }
        sync_icon(false);
    };

    window.GlobalMusic = {
        toggle,
        refresh_volume: () => { set_volume(); },
        refresh_playlist,
        stop,
    };

    window.addEventListener('pagehide', cleanup, { once: true });
    window.addEventListener('beforeunload', cleanup, { once: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind, { once: true });
    } else {
        bind();
    }
})();
