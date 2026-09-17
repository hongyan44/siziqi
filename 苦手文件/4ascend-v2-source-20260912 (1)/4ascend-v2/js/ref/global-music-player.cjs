/*
 * @Description: 全局背景音乐播放器
 */
const GLOBAL_MUSIC_CHANNEL = 'siziqi-global-music';
const GLOBAL_MUSIC_STATE_KEY = 'global_music_enabled';

(() => {
    const audio = new Audio('/audio/game/main.opus?v=1');
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(GLOBAL_MUSIC_CHANNEL) : null;
    let tracks = [];
    let track_index = -1;
    let loading_tracks = null;
    let last_next_request_id = null;

    audio.preload = 'auto';
    audio.loop = true;

    const post_status = () => {
        const message = { type: 'music-status', enabled: !audio.paused };
        if (channel) channel.postMessage(message);
        if (window.opener && !window.opener.closed) {
            try { window.opener.postMessage(message, location.origin); } catch (_) { /* opener may be navigating */ }
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

    const load_tracks = async () => {
        if (loading_tracks) return loading_tracks;
        loading_tracks = (async () => {
            try {
                tracks = window.MusicPlaylist ? await window.MusicPlaylist.urls() : [];
            } catch (_) {
                tracks = [];
            }
            return tracks;
        })();
        await loading_tracks;
        loading_tracks = null;
        return tracks;
    };

    const play = async () => {
        set_volume();
        await load_tracks();

        if (tracks.length) {
            if (audio.src !== tracks[track_index]?.url) {
                track_index = track_index < 0 || track_index >= tracks.length ? 0 : track_index;
                audio.loop = false;
                audio.src = tracks[track_index].url;
                audio.load();
                audio.onended = () => {
                    track_index = (track_index + 1) % tracks.length;
                    play();
                };
            }
        } else {
            audio.loop = true;
            audio.onended = null;
            if (!audio.src || !audio.src.includes('/audio/game/main.opus')) {
                audio.src = '/audio/game/main.opus?v=1';
                audio.load();
            }
        }

        if (!audio.paused) return;
        try {
            await audio.play();
        } catch (_) {
            // The controller retries after navigation or another user gesture.
        }
        post_status();
    };

    const stop = () => {
        audio.pause();
        audio.currentTime = 0;
        post_status();
    };

    const close_after_stop = () => {
        stop();
        if (window.opener && !window.opener.closed) window.close();
    };

    const next_track = async () => {
        set_volume();
        await load_tracks();
        if (!tracks.length) {
            audio.loop = true;
            audio.onended = null;
            if (!audio.src || !audio.src.includes('/audio/game/main.opus')) {
                audio.src = '/audio/game/main.opus?v=1';
                audio.load();
            }
            try {
                await audio.play();
            } catch (_) {
                // The controller retries after navigation or another user gesture.
            }
            post_status();
            return;
        }

        if (audio.paused && track_index < 0) {
            track_index = 0;
        } else if (window.MusicPlaylist && window.MusicPlaylist.get_mode() === 'random') {
            const candidates = tracks.map((_, index) => index).filter((index) => index !== track_index);
            track_index = candidates[Math.floor(Math.random() * candidates.length)];
        } else {
            track_index = (track_index + 1) % tracks.length;
        }

        const track = tracks[track_index];
        audio.pause();
        audio.src = track.url;
        audio.loop = false;
        audio.onended = () => {
            track_index = (track_index + 1) % tracks.length;
            play();
        };
        audio.currentTime = 0;
        audio.load();
        try {
            await audio.play();
        } catch (_) {
            // The controller retries after navigation or another user gesture.
        }
        post_status();
    };

    const handle = (message) => {
        if (!message) return;
        if (message.type === 'play') play();
        else if (message.type === 'next') {
            if (message.request_id && message.request_id === last_next_request_id) return;
            last_next_request_id = message.request_id || null;
            next_track();
        }         else if (message.type === 'stop') {
            if (message.reason === 'switch-to-page-player') close_after_stop();
            else stop();
        }
        else if (message.type === 'refresh-volume') {
            set_volume();
            if (!audio.paused) play();
        }
    };

    if (channel) channel.addEventListener('message', (event) => handle(event.data));
    window.addEventListener('message', (event) => {
        if (event.origin === location.origin) handle(event.data);
    });

    if (localStorage.getItem(GLOBAL_MUSIC_STATE_KEY) === '1') play();
    post_status();
})();
