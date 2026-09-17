const { StateEncoder } = require('./encoder.cjs');
const { OnnxEvaluator } = require('./model.cjs');
const { MctsSearch } = require('./mcts.cjs');


globalThis.FourZeroExports = { StateEncoder, OnnxEvaluator, MctsSearch };
