/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 信息传输
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const msgpack_lite = require('msgpack-lite');


class Message {
    /**
     * @description: 创建房间
     * @param {string} id
     * @return {string}
     */
    static room_create(id) {
        return msgpack_lite.encode({ 'op': 'room_create', id });
    };

    /**
     * @description: 房间是否存在
     * @param {string} id
     * @return {string}
     */
    static room_exist(id) {
        return msgpack_lite.encode({ 'op': 'room_exist', id });
    };

    /**
     * @description: 房间是否存在
     * @param {string} id
     * @param {string} token
     * @return {string}
     */
    static room_foeex(id, token) {
        return msgpack_lite.encode({ 'op': 'room_foeex', id, token });
    };

    /**
     * @description: 房间得到另外一位玩家是否离开
     * @param {string} id
     * @param {string} token
     * @return {string}
     */
    static room_foele(id, token) {
        return msgpack_lite.encode({ 'op': 'room_foele', id, token });
    };

    /**
     * @description: 设置自己离开了
     * @param {string} id
     * @param {string} token
     * @return {string}
     */
    static room_setle(id, token) {
        return msgpack_lite.encode({ 'op': 'room_setle', id, token });
    };

    /**
     * @description: 所有房间信息
     * @return {string}
     */
    static room_all() {
        return msgpack_lite.encode({ 'op': 'room_all' });
    };

    /**
     * @description: 房间的所有观众昵称
     * @param {string} id
     * @return {string}
     */
    static room_observers(id) {
        return msgpack_lite.encode({ 'op': 'room_observers', id });
    };


    /**
     * @description: 玩家加入房间
     * @param {string} id
     * @param {string} token
     * @return {string}
     */
    static player_join(id, token) {
        return msgpack_lite.encode({ 'op': 'player_join', id, token });
    };

    /**
     * @description: 观众加入房间
     * @param {string} id
     * @param {string} token
     * @return {string}
     */
    static observer_join(id, token) {
        return msgpack_lite.encode({ 'op': 'observer_join', id, token });
    };

    /**
     * @description: 加入匹配池
     * @param {string} token
     * @return {string}
     */
    static ranked_join(token) {
        return msgpack_lite.encode({ 'op': 'ranked_join', token });
    };

    /**
     * @description: 加入随机匹配
     * @param {string} token
     * @param {number} seconds
     * @return {string}
     */
    static ranked_match(token, seconds) {
        return msgpack_lite.encode({ 'op': 'ranked_match', token, seconds });
    };

    /**
     * @description: 列出匹配池玩家
     * @return {string}
     */
    static ranked_all() {
        return msgpack_lite.encode({ 'op': 'ranked_all' });
    };

    /**
     * @description: 得到自己的分数
     * @param {string} token
     * @return {string}
     */
    static ranked_getscore(token) {
        return msgpack_lite.encode({ 'op': 'ranked_getscore', token });
    };

    /**
     * @description: 所有房间信息
     * @param {string} token
     * @return {string}
     */
    static ranked_leaderboard(token) {
        return msgpack_lite.encode({ 'op': 'ranked_leaderboard', token });
    };

    /**
     * @description: 结算并验证
     * @param {string} token
     * @param {string} room
     * @param {string} win
     * @param {string} archive
     * @param {boolean} is_backbg
     * @return {string}
     */
    static ranked_endgame(token, room, win, archive, is_backbg) {
        return msgpack_lite.encode({ 'op': 'ranked_endgame', token, room, win, archive, is_backbg });
    };


    /**
     * @description: 玩家心跳
     * @param {string} id
     * @param {string} token
     * @return {string}
     */
    static player_heartbeat(id, token) {
        return msgpack_lite.encode({ 'op': 'player_heartbeat', id, token });
    };

    /**
     * @description: 观众心跳
     * @param {string} id
     * @param {string} token
     * @return {string}
     */
    static observer_heartbeat(id, token) {
        return msgpack_lite.encode({ 'op': 'observer_heartbeat', id, token });
    };


    /**
     * @description: 玩家之间的同步
     * @param {string} id
     * @param {string} token
     * @param {object} data
     * @return {string}
     */
    static sync_player2player(id, token, data) {
        return msgpack_lite.encode({ 'op': 'sync_player2player', id, data, token });
    };

    /**
     * @description: 玩家与观众之间的同步
     * @param {string} id
     * @param {string} token
     * @param {object} data
     * @return {string}
     */
    static sync_player2observers(id, token, data) {
        return msgpack_lite.encode({ 'op': 'sync_player2observers', id, data, token });
    };

    /**
     * @description: 观众之间的同步
     * @param {string} id
     * @param {string} token
     * @param {object} data
     * @return {string}
     */
    static sync_observer2observers(id, token, data) {
        return msgpack_lite.encode({ 'op': 'sync_observer2observers', id, data, token });
    };
}


export { Message };