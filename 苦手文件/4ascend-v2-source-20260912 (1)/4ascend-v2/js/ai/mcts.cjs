class SearchNode {
    constructor(game) {
        this.game = game;
        this.edges = new Map();
        this.expanded = false;
    }
}

class SearchEdge {
    constructor(action, prior) {
        this.action = action;
        this.prior = prior;
        this.visits = 0;
        this.valueSum = 0;
        this.child = null;
    }

    get meanValue() {
        return this.visits === 0 ? 0 : this.valueSum / this.visits;
    }
}


class MctsSearch {
    constructor(evaluator, runtime, options = {}) {
        this.evaluator = evaluator;
        this.runtime = runtime;
        this.cPuct = Number.isFinite(options.cPuct) ? Math.max(0.01, options.cPuct) : 2.0;
        this.maximumMilliseconds = Number.isFinite(options.maximumMilliseconds)
            ? Math.max(100, options.maximumMilliseconds)
            : 45000;
        this.maximumDepth = Number.isFinite(options.maximumDepth) ? Math.max(8, options.maximumDepth) : 256;
    }

    async expand(node) {
        const legal = this.runtime.legalMoves(node.game);
        if (legal.length === 0) {
            node.expanded = true;
            return;
        }

        const prediction = await this.evaluator.evaluate(node.game);
        let maximum = -Infinity;
        legal.forEach((action) => {
            maximum = Math.max(maximum, prediction.logits[action]);
        });

        let sum = 0;
        const weights = new Map();
        legal.forEach((action) => {
            const weight = Math.exp(Math.max(-80, Math.min(80, prediction.logits[action] - maximum)));
            weights.set(action, weight);
            sum += weight;
        });
        legal.forEach((action) => {
            const prior = sum > 1e-12 ? weights.get(action) / sum : 1 / legal.length;
            node.edges.set(action, new SearchEdge(action, prior));
        });
        node.expanded = true;
        node.modelValue = Math.max(-1, Math.min(1, prediction.value));
    }

    select(node) {
        let totalVisits = 0;
        node.edges.forEach((edge) => totalVisits += edge.visits);
        const root = Math.sqrt(Math.max(1, totalVisits));
        let best = null;
        let bestScore = -Infinity;
        node.edges.forEach((edge) => {
            const exploration = this.cPuct * edge.prior * root / (1 + edge.visits);
            const score = edge.meanValue + exploration;
            if (score > bestScore || (score === bestScore && (!best || edge.action < best.action))) {
                best = edge;
                bestScore = score;
            }
        });
        return best;
    }

    terminalValue(game) {
        const winner = this.runtime.winner(game);
        if (!winner) return 0;
        return winner === game.state.turn_player ? 1 : -1;
    }

    async simulate(root) {
        let node = root;
        const path = [];
        let depth = 0;

        while (node.expanded && node.edges.size > 0 && depth < this.maximumDepth) {
            const edge = this.select(node);
            if (!edge) break;
            if (!edge.child) {
                const childGame = this.runtime.fork(node.game);
                const result = this.runtime.applyMove(childGame, edge.action);
                if (!result.legal) throw new Error(`MCTS selected illegal action ${edge.action}.`);
                edge.child = new SearchNode(childGame);
            }
            path.push({ edge, 'parentPlayer': node.game.state.turn_player });
            node = edge.child;
            depth++;
            if (!node.expanded || this.runtime.isTerminal(node.game)) break;
        }

        let value;
        if (this.runtime.isTerminal(node.game)) {
            value = this.terminalValue(node.game);
        } else {
            await this.expand(node);
            value = Number.isFinite(node.modelValue) ? node.modelValue : 0;
        }

        let valuePlayer = node.game.state.turn_player;
        for (let index = path.length - 1; index >= 0; index--) {
            const step = path[index];
            if (step.parentPlayer !== valuePlayer) value = -value;
            step.edge.visits++;
            step.edge.valueSum += value;
            valuePlayer = step.parentPlayer;
        }
    }

    async findImmediateWin(root) {
        for (const action of this.runtime.legalMoves(root.game)) {
            const game = this.runtime.fork(root.game);
            const player = game.state.turn_player;
            const result = this.runtime.applyMove(game, action);
            if (result.winner === player) return action;
        }
        return -1;
    }

    async search(game, simulations) {
        const count = Math.max(1, Math.trunc(Number(simulations) || 1));
        const root = new SearchNode(this.runtime.fork(game));
        const immediate = await this.findImmediateWin(root);
        if (immediate >= 0) {
            return {
                'action': immediate,
                'simulations': 0,
                'winRate': 1,
                'top': [{ 'action': immediate, 'visits': 1, 'q': 1, 'prior': 1 }],
            };
        }

        await this.expand(root);
        if (root.edges.size === 0) throw new Error('MCTS found no legal action.');
        const started = performance.now();
        let completed = 0;
        while (completed < count && performance.now() - started < this.maximumMilliseconds) {
            await this.simulate(root);
            completed++;
        }

        const ranked = Array.from(root.edges.values()).sort((left, right) =>
            right.visits - left.visits || right.prior - left.prior || left.action - right.action
        );
        const best = ranked[0];
        const visited = ranked.reduce((sum, edge) => sum + edge.visits, 0);
        const weightedQ = ranked.reduce((sum, edge) => sum + edge.meanValue * edge.visits, 0);
        return {
            'action': best.action,
            'simulations': completed,
            'milliseconds': performance.now() - started,
            'winRate': visited > 0 ? (weightedQ / visited + 1) / 2 : 0.5,
            'top': ranked.slice(0, 8).map((edge) => ({
                'action': edge.action,
                'visits': edge.visits,
                'q': edge.meanValue,
                'prior': edge.prior,
            })),
        };
    }
}


export { MctsSearch };
