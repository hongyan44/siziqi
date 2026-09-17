# 4ascend-online 服务端约定（后续开发参考）

- 项目是 xmake 构建的 C++20 单二进制，目标 Linux musl 静态链接（LibreSSL / Crypto++ / SQLite / cinatra / jsoncons）。
- 代码分层：`src/api` 协议入口、`src/manager` SQLite/鉴权/积分、`src/online` 内存房间与匹配池、`src/libs` 工具库。
- 业务实现偏好“命名空间函数 + 模块内静态状态”，而不是面向对象类层次。
- 协议统一：HTTP POST + `/game/ws` 二进制帧；请求 DES-ECB(`BODY_KEY`) 解包 MsgPack，响应 MsgPack 后再 DES-ECB(`RES_KEY`) 加密。
- Token 不入库，结构为 AES-CBC(`TOKEN_KEY`) + HMAC-MD5(`TOKEN_SALT`)；用户 UUID 为 UUIDv7，有效期 15 天。
- SQLite 采用 WAL + 预编译语句；`Contest`/`Puzzle` 目前为空壳；回放、好友房间、排位匹配已落地。
- 一次性权限秘钥存在 `db/user.db` 的 `level_keys` 表中，只保存 HMAC-SHA256 摘要，不保存明文。管理员接口 `GET /admin/generate_level_key?password=...&level=2|3|4` 在运行时生成秘钥并写入该表，明文仅返回一次。管理员密码硬编码在 `src/api/http/User.cpp`。`LEVEL_KEY_DIGESTS` 仍作为启动时内置白名单，不作为日常发卡密入口。
- 残局编辑器坐标以左下为原点，残局挑战引擎/Canvas 以左上为原点；导入残局码时必须翻转 Y 轴，内置每日挑战盘面不翻转。残局挑战应关闭 `GameNormal.natural_plant`，普通对局保持默认刷草。
- 后续改动应延续：`load()` 注册路由、`run()` 按 `op` 分发、输出参数 `bool` 表示成功、中文文件头版权、clang-format LLVM + 4 空格。
- 残局挑战 AI：优先 `EndgameTactics`（防自杀/斩杀遍历），无命中再回退 4zero MCTS；不依赖落子历史。

# 4ascend-v2 前端构建约定

- 源目录：`html/`（一层嵌套文件夹自动输出到 `root/pages/<文件夹>/`）、`js/`、`css/`；发布目录 `root/`。
- 手动改完单个页面后的最小重建：`bunx html-minifier-terser --remove-comments --collapse-whitespace --conservative-collapse --minify-css true --minify-js true -o root/<路径>.html html/<路径>.html`，再执行 `bun rand.cjs` 刷新 `?v=replace` 版本号。`bun watch.cjs` 可整仓监听构建。
- 首页板块顺序（`html/index.html`）：联机相关 → 本地相关 → 文档相关 → 额外功能 → 账号与设置。残局入口按钮文案为「残局投稿编辑器」。
