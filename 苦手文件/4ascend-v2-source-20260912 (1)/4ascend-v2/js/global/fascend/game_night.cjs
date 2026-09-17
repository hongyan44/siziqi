/*
 * @Description: 永夜模式
 */
const { GameNormal } = require('./game_normal.cjs');

class GameNight extends GameNormal {
    constructor(board, state, rand_aic, rand_unity) {
        super(board, state, rand_aic, rand_unity);
        this.always_overload = true;
    };
}

export { GameNight };
