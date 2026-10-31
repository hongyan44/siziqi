const { StateEncoder } = require('./encoder.cjs');


class OnnxEvaluator {
    constructor(modelUrl = '/model/4ascend-zero.onnx', rules = globalThis.FAscendExports) {
        this.modelUrl = modelUrl;
        this.encoder = new StateEncoder(rules);
        this.session = null;
        this.initializing = null;
    }

    async initialize() {
        if (this.session) return;
        if (this.initializing) return this.initializing;
        this.initializing = (async () => {
            if (!globalThis.ort) throw new Error('ONNX Runtime Web was not loaded.');
            const hardware = globalThis.navigator && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 1;
            ort.env.wasm.numThreads = Math.max(1, Math.min(4, Math.ceil(hardware / 2)));
            ort.env.wasm.proxy = false;
            ort.env.wasm.wasmPaths = '/vendor/onnxruntime-web/';
            this.session = await ort.InferenceSession.create(this.modelUrl, {
                'executionProviders': ['wasm'],
                'graphOptimizationLevel': 'all',
            });

            // Exported models differ in tensor naming: the ZERO export uses
            // `state` / `policy_logits` / `value`, while the 四子鱼 teacher
            // export uses `input` / `policy` / `value`. Accept either naming so
            // one evaluator can drive both opponents.
            const inputNames = this.session.inputNames;
            const outputNames = this.session.outputNames;
            if (!inputNames || inputNames.length !== 1) {
                throw new Error('The ONNX model must expose exactly one input tensor.');
            }
            this.inputName = inputNames[0];
            this.policyName = outputNames.includes('policy_logits')
                ? 'policy_logits'
                : (outputNames.includes('policy') ? 'policy' : null);
            if (!this.policyName || !outputNames.includes('value')) {
                throw new Error("ONNX outputs 'policy'(/'policy_logits') and 'value' are required.");
            }
        })();
        try {
            await this.initializing;
        } finally {
            this.initializing = null;
        }
    }

    async evaluate(game) {
        await this.initialize();
        const encoded = this.encoder.encode(game);
        const state = new ort.Tensor('float32', encoded, [1, StateEncoder.PLANES, StateEncoder.SIZE, StateEncoder.SIZE]);
        const output = await this.session.run({ [this.inputName]: state });
        const policy = output[this.policyName] && output[this.policyName].data;
        const value = output.value && output.value.data;
        if (!policy || policy.length !== StateEncoder.CELLS || !value || value.length < 1) {
            throw new Error('The ONNX model returned an unexpected output shape.');
        }
        return { 'logits': Float32Array.from(policy), 'value': Number(value[0]) };
    }

    async dispose() {
        if (this.session && typeof this.session.release === 'function') await this.session.release();
        this.session = null;
    }
}


export { OnnxEvaluator };
