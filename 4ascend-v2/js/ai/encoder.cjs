/* 25-plane AlphaZero input encoder shared by browser AI and tests. */


class StateEncoder {
    static SIZE = 9;
    static CELLS = 81;
    static PLANES = 25;

    /**
     * Symbols are identity values in JavaScript. The AI and rules are emitted
     * as separate browser bundles, so importing enum.cjs here would create a
     * second, incompatible set of Symbols. Always receive the canonical rule
     * exports instead.
     */
    constructor(rules = globalThis.FAscendExports) {
        if (!rules || !rules.STONE_ENUM || !rules.PLANT_ENUM || !rules.PLAYER_ENUM || !rules.ASCEND_ENUM) {
            throw new Error('StateEncoder requires the canonical FAscend rule exports.');
        }
        this.rules = rules;
    }

    static index(plane, cell) {
        return plane * StateEncoder.CELLS + cell;
    }

    static countDirection(board, row, column, dr, dc, stone) {
        let count = 0;
        row += dr;
        column += dc;
        while (row >= 0 && row < StateEncoder.SIZE && column >= 0 && column < StateEncoder.SIZE) {
            const pos = board.data[row * StateEncoder.SIZE + column];
            if (pos.stone !== stone) break;
            count++;
            row += dr;
            column += dc;
        }
        return count;
    }

    static writePotentialPlane(output, plane, board, stone) {
        const directions = [[1, 0], [0, 1], [1, -1], [1, 1]];
        for (let row = 0; row < StateEncoder.SIZE; row++) {
            for (let column = 0; column < StateEncoder.SIZE; column++) {
                const cell = row * StateEncoder.SIZE + column;
                if (board.data[cell].stone === stone) {
                    output[StateEncoder.index(plane, cell)] = 0;
                    continue;
                }

                let score = 0;
                let any = false;
                directions.forEach(([dr, dc]) => {
                    const neighbours = StateEncoder.countDirection(board, row, column, dr, dc, stone)
                        + StateEncoder.countDirection(board, row, column, -dr, -dc, stone);
                    if (neighbours + 1 >= 4) {
                        score += neighbours;
                        any = true;
                    }
                });
                output[StateEncoder.index(plane, cell)] = score + (any ? 1 : 0);
            }
        }
    }

    /**
     * Encode from the current side's point of view.
     * @param {object} game canonical JS rule game
     * @return {Float32Array}
     */
    encode(game) {
        const { STONE_ENUM, PLANT_ENUM, PLAYER_ENUM, ASCEND_ENUM } = this.rules;
        const output = new Float32Array(StateEncoder.PLANES * StateEncoder.CELLS);
        const me = game.state.turn_player;
        const opponent = me === PLAYER_ENUM.BLACK ? PLAYER_ENUM.WHITE : PLAYER_ENUM.BLACK;
        const myStone = me === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
        const opponentStone = opponent === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
        const meIndex = me === PLAYER_ENUM.BLACK ? 0 : 1;
        const opponentIndex = meIndex ^ 1;
        const inAscend = game.state.ascend_status !== ASCEND_ENUM.NONE;
        // The trained feature uses 1 while plant timing is not applicable.
        // Blight/endgame games never advance the plant countdown, so exposing
        // an arbitrary snapshot parity would feed the model a false signal.
        const growParity = inAscend || game.natural_plant === false
            ? 1
            : game.state.grow_count % 2;

        for (let cell = 0; cell < StateEncoder.CELLS; cell++) {
            const pos = game.board.data[cell];
            output[StateEncoder.index(0, cell)] = pos.stone === myStone ? 1 : 0;
            output[StateEncoder.index(1, cell)] = pos.stone === opponentStone ? 1 : 0;
            output[StateEncoder.index(2, cell)] = pos.stone === STONE_ENUM.BLACK_ASCEND || pos.stone === STONE_ENUM.WHITE_ASCEND ? 1 : 0;
            output[StateEncoder.index(3, cell)] = pos.plant === PLANT_ENUM.TWO ? 2 : pos.plant === PLANT_ENUM.ONE ? 1 : 0;
            output[StateEncoder.index(4, cell)] = game.state.hp[meIndex];
            output[StateEncoder.index(5, cell)] = game.state.hp[opponentIndex];
            output[StateEncoder.index(6, cell)] = inAscend ? 1 : 0;
            output[StateEncoder.index(7, cell)] = me === game.first_player ? 1 : 0;
            output[StateEncoder.index(8, cell)] = growParity;
        }

        StateEncoder.writePotentialPlane(output, 9, game.board, myStone);
        StateEncoder.writePotentialPlane(output, 10, game.board, opponentStone);

        // Seven newest PRE-move boards. Each pair is ordered by the player who
        // moved at that historical turn, exactly as in the training encoder.
        const history = game.history_boards || [];
        const firstCode = game.first_player === PLAYER_ENUM.WHITE ? 2 : 1;
        for (let j = 1; j <= 7; j++) {
            if (j > history.length) continue;
            const past = history[history.length - j];
            const moveIndex = game.state.turn_count - j;
            const moverCode = moveIndex % 2 === 0 ? firstCode : (firstCode === 1 ? 2 : 1);
            const otherCode = moverCode === 1 ? 2 : 1;
            const firstPlane = 11 + (j - 1) * 2;
            for (let cell = 0; cell < StateEncoder.CELLS; cell++) {
                output[StateEncoder.index(firstPlane, cell)] = past[cell] === moverCode ? 1 : 0;
                output[StateEncoder.index(firstPlane + 1, cell)] = past[cell] === otherCode ? 1 : 0;
            }
        }

        return output;
    }
}


export { StateEncoder };
