"""4zero 教师推理（纯 numpy，不依赖 torch）。

- 解析 torch.save 的 zip（自定义 Unpickler）
- 25 平面编码（直接复用仓库的 AlphaZeroStateEncoder）
- ResNet(64ch, 10 blocks) + value head
"""
import io, pickle, sys, zipfile
import numpy as np

DT = {'FloatStorage': np.float32, 'DoubleStorage': np.float64, 'HalfStorage': np.float16,
      'LongStorage': np.int64, 'IntStorage': np.int32, 'ByteStorage': np.uint8,
      'BoolStorage': np.bool_}

class _Storage:
    __slots__ = ('data', 'dtype')
    def __init__(self, data, dtype): self.data, self.dtype = data, dtype

def _rebuild(storage, offset, size, stride, *a, **k):
    arr = np.frombuffer(storage.data, dtype=storage.dtype)
    if len(size) == 0:
        return np.array(arr[int(offset)])
    st = tuple(int(s) * arr.itemsize for s in stride)
    return np.lib.stride_tricks.as_strided(arr[int(offset):], shape=tuple(int(x) for x in size), strides=st).copy()

def load_state_dict(path):
    z = zipfile.ZipFile(path)
    pkl = [n for n in z.namelist() if n.endswith('/data.pkl')][0]
    prefix = pkl[:-len('/data.pkl')]

    class U(pickle.Unpickler):
        def find_class(self, module, name):
            if name == '_rebuild_tensor_v2': return _rebuild
            if name == '_rebuild_parameter': return lambda d, *a, **k: d
            if name in DT: return name
            return super().find_class(module, name)
        def persistent_load(self, pid):
            typ, key = pid[1], pid[2]
            name = typ if isinstance(typ, str) else getattr(typ, '__name__', str(typ))
            return _Storage(z.read(f'{prefix}/data/{key}'), DT[name])

    data = U(io.BytesIO(z.read(pkl)), encoding='utf-8').load()
    return data['model']

def conv3x3(x, w, b=None):
    C, H, W = x.shape
    xp = np.pad(x, ((0, 0), (1, 1), (1, 1)))
    cols = np.empty((H * W, 9 * C), dtype=np.float32)
    k = 0
    for dr in range(3):
        for dc in range(3):
            patch = xp[:, dr:dr + H, dc:dc + W]
            cols[:, k * C:(k + 1) * C] = patch.reshape(C, -1).T
            k += 1
    wf = w.transpose(0, 2, 3, 1).reshape(w.shape[0], 9 * C)
    out = cols @ wf.T
    if b is not None:
        out += b
    return out.T.reshape(-1, H, W)

def conv1x1(x, w, b):
    C, H, W = x.shape
    return (w.reshape(w.shape[0], C) @ x.reshape(C, -1) + b[:, None]).reshape(-1, H, W)

def bn(x, w, b, rm, rv, eps=1e-5):
    s = w / np.sqrt(rv + eps)
    return x * s[:, None, None] + (b - rm * s)[:, None, None]

class Teacher:
    def __init__(self, path):
        self.sd = load_state_dict(path)

    def _get(self, k): return self.sd[k]

    def value(self, planes):
        sd = self.sd
        h = conv3x3(planes.astype(np.float32), sd['stem.0.weight'])
        h = np.maximum(bn(h, sd['stem.1.weight'], sd['stem.1.bias'],
                          sd['stem.1.running_mean'], sd['stem.1.running_var']), 0)
        i = 0
        while f'res.{i}.conv1.weight' in sd:
            p = f'res.{i}.'
            t = conv3x3(h, sd[p + 'conv1.weight'])
            t = np.maximum(bn(t, sd[p + 'bn1.weight'], sd[p + 'bn1.bias'],
                              sd[p + 'bn1.running_mean'], sd[p + 'bn1.running_var']), 0)
            t = conv3x3(t, sd[p + 'conv2.weight'])
            t = bn(t, sd[p + 'bn2.weight'], sd[p + 'bn2.bias'],
                   sd[p + 'bn2.running_mean'], sd[p + 'bn2.running_var'])
            h = np.maximum(h + t, 0)
            i += 1
        v = conv1x1(h, sd['v_conv.weight'], sd['v_conv.bias'])
        v = np.maximum(bn(v, sd['v_bn.weight'], sd['v_bn.bias'],
                          sd['v_bn.running_mean'], sd['v_bn.running_var']), 0)
        v = v.reshape(-1).astype(np.float32)
        v = np.maximum(v @ sd['v_fc1.weight'].T + sd['v_fc1.bias'], 0)
        v = v @ sd['v_fc2.weight'].T + sd['v_fc2.bias']
        return float(np.tanh(v[0])), i

    def policy(self, planes):
        """返回 81 个 logits（未 mask、未 softmax）。"""
        sd = self.sd
        h = conv3x3(planes.astype(np.float32), sd['stem.0.weight'])
        h = np.maximum(bn(h, sd['stem.1.weight'], sd['stem.1.bias'],
                          sd['stem.1.running_mean'], sd['stem.1.running_var']), 0)
        i = 0
        while f'res.{i}.conv1.weight' in sd:
            p = f'res.{i}.'
            t = conv3x3(h, sd[p + 'conv1.weight'])
            t = np.maximum(bn(t, sd[p + 'bn1.weight'], sd[p + 'bn1.bias'],
                              sd[p + 'bn1.running_mean'], sd[p + 'bn1.running_var']), 0)
            t = conv3x3(t, sd[p + 'conv2.weight'])
            t = bn(t, sd[p + 'bn2.weight'], sd[p + 'bn2.bias'],
                   sd[p + 'bn2.running_mean'], sd[p + 'bn2.running_var'])
            h = np.maximum(h + t, 0)
            i += 1
        p = conv1x1(h, sd['p_conv.weight'], sd['p_conv.bias'])
        p = np.maximum(bn(p, sd['p_bn.weight'], sd['p_bn.bias'],
                          sd['p_bn.running_mean'], sd['p_bn.running_var']), 0)
        p = p.reshape(-1)
        return p @ sd['p_fc.weight'].T + sd['p_fc.bias']

if __name__ == '__main__':
    import time
    t = Teacher('ckpt105841.pt')
    rng = np.random.default_rng(0)
    x = rng.standard_normal((25, 9, 9)).astype(np.float32)
    v, blocks = t.value(x)
    print(f"blocks={blocks} value(random input)={v:.4f}")
    t0 = time.perf_counter()
    for _ in range(20):
        t.value(x)
    print(f"forward: {(time.perf_counter()-t0)/20*1000:.1f} ms/position")
