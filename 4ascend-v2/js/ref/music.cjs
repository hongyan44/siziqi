/*
 * @Description: 本地背景音乐歌单
 */
const MUSIC_DB_NAME = '4ascend_music';
const MUSIC_DB_VERSION = 1;
const MUSIC_STORE = 'tracks';
const MUSIC_META_KEY = 'music_playlist';
const MUSIC_MODE_KEY = 'music_mode';
const MUSIC_MAX_TRACKS = 500;

const open_music_db = () => new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('当前浏览器不支持本地音乐存储'));

    const request = indexedDB.open(MUSIC_DB_NAME, MUSIC_DB_VERSION);
    request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MUSIC_STORE)) {
            db.createObjectStore(MUSIC_STORE, { keyPath: 'id' });
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('本地音乐数据库打开失败'));
});

const music_transaction = async (mode, callback) => {
    const db = await open_music_db();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction(MUSIC_STORE, mode);
            const store = transaction.objectStore(MUSIC_STORE);
            let result;
            try {
                result = callback(store);
            } catch (error) {
                reject(error);
                return;
            }
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error || new Error('本地音乐操作失败'));
            transaction.onabort = () => reject(transaction.error || new Error('本地音乐操作已取消'));
        });
    } finally {
        db.close();
    }
};

class MusicPlaylist {
    static get MAX_TRACKS() {
        return MUSIC_MAX_TRACKS;
    }

    static get_meta() {
        try {
            const value = JSON.parse(localStorage.getItem(MUSIC_META_KEY) || '[]');
            return Array.isArray(value) ? value.slice(0, MUSIC_MAX_TRACKS) : [];
        } catch (_) {
            return [];
        }
    }

    static save_meta(list) {
        localStorage.setItem(MUSIC_META_KEY, JSON.stringify(list.slice(0, MUSIC_MAX_TRACKS)));
    }

    static get_mode() {
        return localStorage.getItem(MUSIC_MODE_KEY) === 'random' ? 'random' : 'order';
    }

    static set_mode(mode) {
        const value = mode === 'random' ? 'random' : 'order';
        localStorage.setItem(MUSIC_MODE_KEY, value);
        return value;
    }

    static async add_files(file_list) {
        const files = Array.from(file_list || []).filter((file) => file && (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|opus|m4a|aac|flac)$/i.test(file.name)));
        const current = this.get_meta();
        const available = MUSIC_MAX_TRACKS - current.length;
        if (available <= 0) throw new Error(`歌单最多只能添加${MUSIC_MAX_TRACKS}首音乐`);
        if (!files.length) throw new Error('请选择音频文件');

        const selected = files.slice(0, available);
        const added = selected.map((file) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            name: file.name,
            type: file.type || 'audio/mpeg',
            size: file.size,
            created_at: Date.now(),
        }));

        await music_transaction('readwrite', (store) => {
            added.forEach((meta, index) => store.put({ ...meta, blob: selected[index] }));
        });
        this.save_meta(current.concat(added));
        return { added, skipped: files.length - selected.length };
    }

    static async get_tracks() {
        const meta = this.get_meta();
        const tracks = [];
        for (const item of meta) {
            try {
                const record = await music_transaction('readonly', (store) => new Promise((resolve, reject) => {
                    const request = store.get(item.id);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                }));
                if (record && record.blob) tracks.push({ ...item, blob: record.blob });
            } catch (_) {
                // 丢失的单首音乐不影响其他歌单项目
            }
        }
        if (tracks.length !== meta.length) this.save_meta(tracks.map(({ blob, ...item }) => item));
        return tracks;
    }

    static async delete(id) {
        const current = this.get_meta();
        if (!current.some((item) => item.id === id)) return;
        await music_transaction('readwrite', (store) => store.delete(id));
        this.save_meta(current.filter((item) => item.id !== id));
    }

    static async move(id, direction) {
        const current = this.get_meta();
        const index = current.findIndex((item) => item.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= current.length) return;
        [current[index], current[target]] = [current[target], current[index]];
        this.save_meta(current);
    }

    static async clear() {
        try {
            await music_transaction('readwrite', (store) => store.clear());
        } finally {
            localStorage.removeItem(MUSIC_META_KEY);
            localStorage.removeItem(MUSIC_MODE_KEY);
        }
    }

    static async urls() {
        const tracks = await this.get_tracks();
        return tracks.map((track) => ({
            ...track,
            url: URL.createObjectURL(track.blob),
        }));
    }
}

if (typeof window !== 'undefined') window.MusicPlaylist = MusicPlaylist;
if (typeof module !== 'undefined') module.exports = { MusicPlaylist };
