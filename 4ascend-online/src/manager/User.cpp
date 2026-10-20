/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: User
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "User.h"

#include "../Config.h"
#include "../libs/db/Sqlite3.h"
#include "../libs/digest/Hmac.h"
#include "../libs/only/Flie.h"
#include "../libs/only/Random.h"
#include "../libs/security/Bytes.h"

#include <sqlite/sqlite3.h>

#include <cstdint>
#include <string>
#include <string_view>



namespace Manager {
namespace User {
sqlite3* db = nullptr;

sqlite3_stmt* p_all_user    = nullptr;
sqlite3_stmt* p_create_user = nullptr;
sqlite3_stmt* p_update_user = nullptr;
sqlite3_stmt* p_delete_user = nullptr;
sqlite3_stmt* p_exist_user  = nullptr;

sqlite3_stmt* p_exist_ident   = nullptr;
sqlite3_stmt* p_exist_account = nullptr;
sqlite3_stmt* p_ident_uuid    = nullptr;
sqlite3_stmt* p_info_user     = nullptr;
sqlite3_stmt* p_account_user  = nullptr;
sqlite3_stmt* p_pass_user     = nullptr;
sqlite3_stmt* p_update_pass   = nullptr;
sqlite3_stmt* p_update_account = nullptr;
sqlite3_stmt* p_get_level         = nullptr;
sqlite3_stmt* p_consume_level_key = nullptr;

sqlite3_stmt* p_get_name_color = nullptr;
sqlite3_stmt* p_set_name_color = nullptr;

sqlite3_stmt* p_friend_id_user   = nullptr;
sqlite3_stmt* p_friend_id_uuid   = nullptr;
sqlite3_stmt* p_friend_id_set    = nullptr;
sqlite3_stmt* p_friend_id_miss   = nullptr;

namespace {
void bind_text(sqlite3_stmt* statement, int index, std::string_view value) noexcept {
    sqlite3_bind_text(statement, index, value.data(), static_cast<int>(value.size()), SQLITE_TRANSIENT);
}

void reset(sqlite3_stmt* statement) noexcept {
    sqlite3_reset(statement);
    sqlite3_clear_bindings(statement);
}

std::string to_hex(std::string_view raw) noexcept {
    static constexpr char HEX[] = "0123456789abcdef";
    std::string digest;
    digest.reserve(raw.size() * 2);
    for (const auto byte : raw) {
        const auto value = static_cast<unsigned char>(byte);
        digest.push_back(HEX[value >> 4]);
        digest.push_back(HEX[value & 0x0F]);
    }
    return digest;
}

std::string secret_digest(std::string_view secret) noexcept {
    std::string raw;
    Libs::Digest::Hmac::sha256(secret, LEVEL_SALT, raw);
    return to_hex(raw);
}

// 密码摘要：与权限秘钥做域分离，避免两类摘要可互相复用。
std::string password_digest(std::string_view password) noexcept {
    std::string raw;
    Libs::Digest::Hmac::sha256(std::string("4ascend-pass:").append(password), LEVEL_SALT, raw);
    return to_hex(raw);
}

std::string generate_secret(int target_level) noexcept {
    static constexpr std::string_view ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
    std::string secret = "4ASCEND-L";
    secret += std::to_string(target_level);
    secret += '-';
    secret.reserve(secret.size() + 43);
    for (size_t index = 0; index < 43; ++index) {
        secret.push_back(ALPHABET[Libs::Only::Random::mod(static_cast<uint32_t>(ALPHABET.size()))]);
    }
    return secret;
}

// 专属短 ID：8 位，去掉易混淆的 0/O/1/I，便于用户口头或手输分享。
std::string generate_friend_id() noexcept {
    static constexpr std::string_view ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    std::string id;
    id.reserve(8);
    for (size_t index = 0; index < 8; ++index) {
        id.push_back(ALPHABET[Libs::Only::Random::mod(static_cast<uint32_t>(ALPHABET.size()))]);
    }
    return id;
}

struct LevelKeyDigest {
    const char* digest;
    int level;
};

constexpr LevelKeyDigest LEVEL_KEY_DIGESTS[] = {
    {"2efe7dc594aada6ec5e6c9fb8a57cd23db52a95da2143abaf6475441f9e00501", 2},
    {"8f9f837af2280f2ef095a954ecfcec6fd2bd38cfa425ffadf027e686c3c9674d", 2},
    {"8e785b38932cee1efef86c57102dfd6cd9a7f5730f055366b5a8daa001a20df0", 2},
    {"fdd525a98e8205884f066e02816eb517c8f18404db7df7db4399d675820673ed", 2},
    {"51ab3832d48740cb83393f1a1061cbdf03b14159549546a144af0378f354c868", 2},
    {"7dc2797f55743446b597390dd0b721c9d7b4105c5782d36f7f046c1ecaf84807", 2},
    {"aeeaa752c0a0c24e2cfe8667ccaaf6eadb767d6c5258f652f7e28807a14b1f60", 2},
    {"66324f9e260d31f0e328255524d45c02f212ddd502e4727d37652412012c85a7", 2},
    {"cb095ab9ee936154e324dc44d5eef28dfb141586d1bffa2cf493bb9db21c0333", 2},
    {"7c2c8cdab253f395fca85175dbfa3945f6da63ffe5d598d84aae7052f65d0101", 2},
    {"b0b712151e9ff9ec1040529089c89e3cae1ae338fe3daa9289c36be0e882793b", 2},
    {"8c48b6f5367ace31104be5e93a3fdd2b099342d56e0f914279e3f2d80196946b", 2},
    {"05a12c2a134f822c5d4653cc8756658b615b7b7f139a5f0ca488aacf1c009ebf", 2},
    {"fe6ee4b75ac3f71cd6d40de0cdd4ddf77ebef5015da4ac3c20d4a2b9a3f0c09a", 2},
    {"0d151144265cf74d6dfba8f4bc90111db3ccd6d5e03c95cbb8339ace61786bcc", 2},
    {"c4a277d656b5ed47365ab8a74652b5235f10fb044f574d048da979fe7ae1657a", 2},
    {"49de529dd6f250461a1d4f5d03b604eeeffdf5b9a57ba988c3b8508139219641", 2},
    {"28d102938950779be488e2c4f750449440592160121d3e75a583bc325b5ea74d", 2},
    {"40fe0a14868259597dd44ff2115de828674968b35ecdf6f943240a45626d0971", 2},
    {"86ac7acdf6c13d454beeef8e7e13e9019bb1e7a14e6b8da76d6162bbc2ff6788", 2},
    {"e77058fe463ba084b3517036f86366986ef2450b883e3e85e7d90f3477b221b2", 3},
    {"e14790c7a06098de2228ebe4f0ecfdfbbb7b22cb2b03e5a54dba05ac1bfaed52", 3},
    {"2ca90ce25b76fb9c2f1bb5ff0128f0fe0b704072716e52143e818e12cc3aab04", 3},
    {"a7d7d2f2d5bbd0b52f887408531ac6b0e86652a6e8fb2f5a9d49c5b0467973f9", 3},
    {"4acdcdf561dade80672b4100431e9017f808999e10cb9f7b6793080522c0baa7", 3},
    {"d41af35bd9430b42de28c82d6a0a3f79b2a3d412ff68c8bcac2e16e717fab78b", 3},
    {"90f13109488d8f2e9535b970cce7c9b8fdd57325883a1d65b756b599aee08d7d", 3},
    {"3ccf7b9c92c453c5d5db3a2be0964e8a233535fa918ad10b313bcdce23587ac0", 3},
    {"f89cb5d68b52ffb6757499cb8fed0ac44cccb3fc65330ef789c6a2d92e4b2352", 3},
    {"958eaeefde061a263b80995738c326d52f7db6f81bfe79ba7213095ed90c24af", 3},
    {"db3380a8f8faa98cd7073892014caaac171f2df71311edd3bd1325d482a001e1", 3},
    {"1a81406c7b7664d53c2c8aab7696bdd17a47714c98175a216c7c1afd2e7f337c", 3},
    {"deb14d3458fe2eee89bef325756f9fa41ca494bc2e9269a84b43cec00f1f12da", 3},
    {"0fd45a1a9921d4e989154146e59c6533db36cad7fa81e1b80c923dff016069fc", 3},
    {"460df28a2da7f7d1a0b2ce4ace3f0265f9ea2575b30d01a2e7db44e2f913d729", 3},
    {"8421c63871864732041c9ffa97f851b9e0b45b0548fb9aa21920c7521259574d", 3},
    {"b403f7c652b85623bf7965af05239a1e91bb340c1b317943a9ed096db6e11048", 3},
    {"d9f4d6f3d20e44d2c14c09a73ccd6a1bdf79e4e181e195b10453a43605b5cd21", 3},
    {"4ddd01291439afa3296591ec376a8360cc8b9a3333968c44443a514b799a7ceb", 3},
    {"7cb9ca87ef1ec072ab29171c4b6f82b7f9545e7e3e15d654dd0f60f5d789ace3", 3},
    {"11b84559fe9f3de9e775a188d28082bf8eb977173c5379bda4da1fbce72d1e77", 4},
    {"52ee755266a981893f157a8d644016cf1989c7514a59a191c6013bd64eba6a25", 4},
    {"ad566643147b49f3a75a79d806e01e09f54965d0c3f396a7755b50054c31045e", 4},
    {"4f2489bf3617e67d38a24ddefac35f0cd57bf006ef4e7bf5c0b5d6125a354329", 4},
    {"746d2e07a4c8fabfcbe97371048a1416592845c3a7903f6825340c10a977ef8a", 4},
    {"825c99e54890982d8406eb90850a0fedfda0c37f6c67e0d9b67da126cd065c13", 4},
    {"7a45019f99fd298e07ea6937490925c7d83279f75dc84e07f66c52320d6d167b", 4},
    {"875e4a6b74cb61dff5190423bbf5158ea69d9d5fdefdc370d567c3959d6bc8ac", 4},
    {"50151070551b3435d543b3cf93e18e6985fa903c536db8daf41793b2596a0f03", 4},
    {"b482004872b98c79b31efea841aec61b0ed2cfcfeb1e2f581e2965911d4fb4f9", 4},
    {"dd7ca30bde95ebd810869f85264dc13631204c75d18dc5904697ca08c9190c14", 4},
    {"5ca87d9bbb1730c9690e39122defe8b9235acf01fd4629148644163f6d618644", 4},
    {"3dbd943adaec6c2f667d72f4a299d3475b31dee1e619ba4956371d5d8a82ca35", 4},
    {"96476f27bac4f10a68cd3903c5582867ab6916dbb9c27cfd139df3ad3a286bba", 4},
    {"1ffce645e168de93114998f594b2197cb8563a15803275c5867733b72a858d50", 4},
    {"dbd2c45f0ae987560953a90c08ad099ec05f02a9a839893e8883233944dc6dda", 4},
    {"0b1f35cee0b030c96ca7b68f20f5ccf706160d0a87e24bdbd21eb0d59136d671", 4},
    {"d00339301b4cab4e6588d2b931be6d3b7761523d0428748a500dafa9f2769397", 4},
    {"c88bb1eb0ee31da70a847a377a7b3acb8bead9f1db6da3f91e18408220468e41", 4},
    {"d895e9e5e8324ad3226a06ba3f51f5bc06ef75287210ac4e382342827863a060", 4},
};
} // namespace


// 初始化
void init() noexcept {
    // 打开数据库
    Libs::DB::Sqlite3::open("db/user.db", db);
    if (!db || LEVEL_SALT.empty()) return;

    // 没有表则创建
    sqlite3_exec(
        db,
        "CREATE TABLE IF NOT EXISTS users (mail TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', account TEXT NOT NULL DEFAULT '', pass TEXT "
        "NOT NULL DEFAULT '', uuid TEXT NOT NULL, time INTEGER NOT NULL, name TEXT NOT NULL, avatar TEXT NOT NULL, level INTEGER NOT NULL "
        "DEFAULT 1, friend_id TEXT NOT NULL DEFAULT '') STRICT",
        nullptr,
        nullptr,
        nullptr
    );
    // 兼容已经存在的旧用户表：SQLite 会在列已存在时返回错误，此处无需中断启动。
    sqlite3_exec(db, "ALTER TABLE users ADD COLUMN level INTEGER NOT NULL DEFAULT 1;", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "ALTER TABLE users ADD COLUMN account TEXT NOT NULL DEFAULT '';", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "ALTER TABLE users ADD COLUMN pass TEXT NOT NULL DEFAULT '';", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "ALTER TABLE users ADD COLUMN friend_id TEXT NOT NULL DEFAULT '';", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "ALTER TABLE users ADD COLUMN name_color TEXT NOT NULL DEFAULT '';", nullptr, nullptr, nullptr);

    // 没有索引则创建
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_users_mail ON users (mail)", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone)", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_users_account ON users (account)", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_users_uuid ON users (uuid)", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "CREATE INDEX IF NOT EXISTS idx_users_friend_id ON users (friend_id)", nullptr, nullptr, nullptr);

    // 一次性权限秘钥只保存 HMAC-SHA256 摘要；部署时需提供对应 level_salt.bin。
    // 将旧版仅允许 level=4 的表迁移为支持等级2-4，保留已核销状态。
    sqlite3_exec(db, "DROP TABLE IF EXISTS level_keys_new", nullptr, nullptr, nullptr);
    sqlite3_exec(
        db,
        "CREATE TABLE level_keys_new (digest TEXT PRIMARY KEY, level INTEGER NOT NULL CHECK(level BETWEEN 2 AND 4), used_at INTEGER NOT NULL DEFAULT 0) STRICT",
        nullptr,
        nullptr,
        nullptr
    );
    sqlite3_exec(db, "INSERT OR IGNORE INTO level_keys_new(digest, level, used_at) SELECT digest, level, used_at FROM level_keys", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "DROP TABLE IF EXISTS level_keys", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "ALTER TABLE level_keys_new RENAME TO level_keys", nullptr, nullptr, nullptr);
    sqlite3_stmt* insert_level_key = nullptr;
    if (sqlite3_prepare_v2(db, "INSERT OR IGNORE INTO level_keys (digest, level) VALUES (?, ?)", -1, &insert_level_key, nullptr) == SQLITE_OK) {
        for (const auto& key : LEVEL_KEY_DIGESTS) {
            bind_text(insert_level_key, 1, key.digest);
            sqlite3_bind_int(insert_level_key, 2, key.level);
            sqlite3_step(insert_level_key);
            reset(insert_level_key);
        }
        sqlite3_finalize(insert_level_key);
    }

    // 预编译
    sqlite3_prepare_v2(
        db,
        "INSERT INTO users (mail, phone, account, pass, uuid, time, name, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
        -1,
        &p_create_user,
        nullptr
    );
    sqlite3_prepare_v2(db, "UPDATE users SET name = ?, avatar = ? WHERE uuid = ?;", -1, &p_update_user, nullptr);
    sqlite3_prepare_v2(db, "DELETE FROM users WHERE uuid = ?;", -1, &p_delete_user, nullptr);

    sqlite3_prepare_v2(db, "SELECT 1 FROM users WHERE uuid = ? LIMIT 1;", -1, &p_exist_user, nullptr);
    sqlite3_prepare_v2(
        db,
        "SELECT 1 FROM users WHERE (mail = ? AND mail <> '') OR (phone = ? AND phone <> '') LIMIT 1;",
        -1,
        &p_exist_ident,
        nullptr
    );
    sqlite3_prepare_v2(db, "SELECT 1 FROM users WHERE account = ? AND account <> '' LIMIT 1;", -1, &p_exist_account, nullptr);

    sqlite3_prepare_v2(db, "SELECT name, avatar, time, mail FROM users WHERE uuid = ?;", -1, &p_info_user, nullptr);
    sqlite3_prepare_v2(db, "SELECT account, phone FROM users WHERE uuid = ?;", -1, &p_account_user, nullptr);
    sqlite3_prepare_v2(db, "SELECT pass FROM users WHERE uuid = ?;", -1, &p_pass_user, nullptr);
    sqlite3_prepare_v2(db, "UPDATE users SET pass = ? WHERE uuid = ?;", -1, &p_update_pass, nullptr);
    // 仅在账号为空时写入，借助 SQL 条件原子保证“设置后不可再改”。
    sqlite3_prepare_v2(db, "UPDATE users SET account = ? WHERE uuid = ? AND account = '';", -1, &p_update_account, nullptr);
    sqlite3_prepare_v2(
        db,
        "SELECT uuid FROM users WHERE (mail = ? AND mail <> '') OR (phone = ? AND phone <> '') OR (account = ? AND account <> '') LIMIT 1;",
        -1,
        &p_ident_uuid,
        nullptr
    );
    sqlite3_prepare_v2(db, "SELECT level FROM users WHERE uuid = ?;", -1, &p_get_level, nullptr);
    sqlite3_prepare_v2(db, "SELECT name_color FROM users WHERE uuid = ?;", -1, &p_get_name_color, nullptr);
    sqlite3_prepare_v2(db, "UPDATE users SET name_color = ? WHERE uuid = ?;", -1, &p_set_name_color, nullptr);
    sqlite3_prepare_v2(
        db,
        "UPDATE level_keys SET used_at = strftime('%s','now') WHERE digest = ? AND used_at = 0 AND level BETWEEN 2 AND 4",
        -1,
        &p_consume_level_key,
        nullptr
    );

    sqlite3_prepare_v2(db, "SELECT uuid FROM users;", -1, &p_all_user, nullptr);

    // 好友专属短 ID：查询、反查、写入（仅缺失时可写，保证唯一且不可改）。
    sqlite3_prepare_v2(db, "SELECT friend_id FROM users WHERE uuid = ?;", -1, &p_friend_id_user, nullptr);
    sqlite3_prepare_v2(db, "SELECT uuid FROM users WHERE friend_id = ? AND friend_id <> '' LIMIT 1;", -1, &p_friend_id_uuid, nullptr);
    sqlite3_prepare_v2(db, "UPDATE users SET friend_id = ? WHERE uuid = ? AND friend_id = '';", -1, &p_friend_id_set, nullptr);
    sqlite3_prepare_v2(db, "SELECT uuid FROM users WHERE friend_id = '';", -1, &p_friend_id_miss, nullptr);

    // 老用户回填专属短 ID，保证每个账号都可被好友搜索。
    ensure_all_friend_id();
};

// 关闭
void close() noexcept {
    sqlite3_finalize(p_create_user);
    sqlite3_finalize(p_update_user);
    sqlite3_finalize(p_delete_user);
    sqlite3_finalize(p_exist_user);
    sqlite3_finalize(p_exist_ident);
    sqlite3_finalize(p_exist_account);
    sqlite3_finalize(p_info_user);
    sqlite3_finalize(p_account_user);
    sqlite3_finalize(p_pass_user);
    sqlite3_finalize(p_update_pass);
    sqlite3_finalize(p_update_account);
    sqlite3_finalize(p_ident_uuid);
    sqlite3_finalize(p_get_level);
    sqlite3_finalize(p_consume_level_key);
    sqlite3_finalize(p_get_name_color);
    sqlite3_finalize(p_set_name_color);
    sqlite3_finalize(p_all_user);
    sqlite3_finalize(p_friend_id_user);
    sqlite3_finalize(p_friend_id_uuid);
    sqlite3_finalize(p_friend_id_set);
    sqlite3_finalize(p_friend_id_miss);

    sqlite3_close(db);
    db = nullptr;
};


// 获取所有用户的 UUID
bool all_user(std::vector<std::string>& uuids) noexcept {
    uuids.clear();

    int rc;
    while ((rc = sqlite3_step(p_all_user)) == SQLITE_ROW) {
        if (const char* text = reinterpret_cast<const char*>(sqlite3_column_text(p_all_user, 0))) {
            uuids.emplace_back(text);
        }
    }

    sqlite3_reset(p_all_user);
    return rc == SQLITE_DONE;
};

// 创建用户
bool create_user(
    std::string_view mail, std::string_view phone, std::string_view account, std::string_view pass, std::string_view uuid, int64_t time,
    std::string_view name, std::string_view avatar
) noexcept {
    const auto digest = pass.empty() ? std::string() : password_digest(pass);

    sqlite3_bind_text(p_create_user, 1, mail.data(), mail.size(), nullptr);
    sqlite3_bind_text(p_create_user, 2, phone.data(), phone.size(), nullptr);
    sqlite3_bind_text(p_create_user, 3, account.data(), account.size(), nullptr);
    sqlite3_bind_text(p_create_user, 4, digest.data(), digest.size(), nullptr);
    sqlite3_bind_text(p_create_user, 5, uuid.data(), uuid.size(), nullptr);
    sqlite3_bind_int64(p_create_user, 6, time);
    sqlite3_bind_text(p_create_user, 7, name.data(), name.size(), nullptr);
    sqlite3_bind_text(p_create_user, 8, avatar.data(), avatar.size(), nullptr);

    int rc = sqlite3_step(p_create_user);
    sqlite3_reset(p_create_user);
    if (rc != SQLITE_DONE) return false;

    // 新账号立即分配专属短 ID，供好友搜索使用。
    std::string friend_id;
    ensure_friend_id(uuid, friend_id);

    return true;
};

// 删除用户
bool delete_user(std::string_view uuid) noexcept {
    sqlite3_bind_text(p_delete_user, 1, uuid.data(), uuid.size(), nullptr);

    int rc = sqlite3_step(p_delete_user);
    sqlite3_reset(p_delete_user);
    if (rc != SQLITE_DONE) return false;

    return true;
};

// 更新用户信息
bool update_user(std::string_view uuid, std::string_view name, std::string_view avatar) noexcept {
    sqlite3_bind_text(p_update_user, 1, name.data(), name.size(), nullptr);
    sqlite3_bind_text(p_update_user, 2, avatar.data(), avatar.size(), nullptr);
    sqlite3_bind_text(p_update_user, 3, uuid.data(), uuid.size(), nullptr);

    int rc = sqlite3_step(p_update_user);
    sqlite3_reset(p_update_user);
    if (rc != SQLITE_DONE) return false;

    return true;
};

// 查询用户信息
bool info_user(std::string_view uuid, std::string& name, std::string& avatar, std::string& mail, int64_t& time) noexcept {
    sqlite3_bind_text(p_info_user, 1, uuid.data(), uuid.size(), nullptr);

    int rc = sqlite3_step(p_info_user);
    if (rc != SQLITE_ROW) {
        sqlite3_reset(p_info_user);
        return false;
    }

    name   = reinterpret_cast<const char*>(sqlite3_column_text(p_info_user, 0));
    avatar = reinterpret_cast<const char*>(sqlite3_column_text(p_info_user, 1));
    time   = sqlite3_column_int64(p_info_user, 2);
    mail   = reinterpret_cast<const char*>(sqlite3_column_text(p_info_user, 3));

    sqlite3_reset(p_info_user);
    return true;
};

// 查询账号与手机号
bool account_user(std::string_view uuid, std::string& account, std::string& phone) noexcept {
    sqlite3_bind_text(p_account_user, 1, uuid.data(), uuid.size(), nullptr);

    int rc = sqlite3_step(p_account_user);
    if (rc != SQLITE_ROW) {
        sqlite3_reset(p_account_user);
        return false;
    }

    account = reinterpret_cast<const char*>(sqlite3_column_text(p_account_user, 0));
    phone   = reinterpret_cast<const char*>(sqlite3_column_text(p_account_user, 1));

    sqlite3_reset(p_account_user);
    return true;
};

// 设置登录账号（仅当前账号为空时可写；已设置则 changed 为 0，返回失败）
bool update_account(std::string_view uuid, std::string_view account) noexcept {
    if (uuid.empty() || account.empty()) return false;

    bind_text(p_update_account, 1, account);
    bind_text(p_update_account, 2, uuid);

    const int rc      = sqlite3_step(p_update_account);
    const int changed = sqlite3_changes(db);
    reset(p_update_account);
    return rc == SQLITE_DONE && changed == 1;
};

// 查询用户昵称
bool name_user(std::string_view uuid, std::string& name) noexcept {
    sqlite3_bind_text(p_info_user, 1, uuid.data(), uuid.size(), nullptr);

    int rc = sqlite3_step(p_info_user);
    if (rc != SQLITE_ROW) {
        sqlite3_reset(p_info_user);
        return false;
    }

    name = reinterpret_cast<const char*>(sqlite3_column_text(p_info_user, 0));

    sqlite3_reset(p_info_user);
    return true;
};

// 查询用户专属短 ID
bool friend_id_user(std::string_view uuid, std::string& friend_id) noexcept {
    friend_id.clear();
    if (!db || !p_friend_id_user || uuid.empty()) return false;

    sqlite3_bind_text(p_friend_id_user, 1, uuid.data(), uuid.size(), nullptr);
    const int rc = sqlite3_step(p_friend_id_user);
    if (rc == SQLITE_ROW) {
        if (const char* text = reinterpret_cast<const char*>(sqlite3_column_text(p_friend_id_user, 0))) friend_id = text;
    }
    sqlite3_reset(p_friend_id_user);
    return rc == SQLITE_ROW;
};

// 专属短 ID 反查用户标识
bool friend_id_uuid(std::string_view friend_id, std::string& uuid) noexcept {
    uuid.clear();
    if (!db || !p_friend_id_uuid || friend_id.empty()) return false;

    sqlite3_bind_text(p_friend_id_uuid, 1, friend_id.data(), friend_id.size(), nullptr);
    const int rc = sqlite3_step(p_friend_id_uuid);
    if (rc == SQLITE_ROW) {
        if (const char* text = reinterpret_cast<const char*>(sqlite3_column_text(p_friend_id_uuid, 0))) uuid = text;
    }
    sqlite3_reset(p_friend_id_uuid);
    return rc == SQLITE_ROW;
};

// 确保用户拥有专属短 ID：缺失则生成唯一值并写入
bool ensure_friend_id(std::string_view uuid, std::string& friend_id) noexcept {
    friend_id.clear();
    if (!db || !p_friend_id_user || !p_friend_id_set || uuid.empty()) return false;

    // 已有则直接返回
    if (friend_id_user(uuid, friend_id) && !friend_id.empty()) return true;

    for (int attempt = 0; attempt < 12; ++attempt) {
        auto candidate = generate_friend_id();

        std::string exists;
        if (friend_id_uuid(candidate, exists)) continue;

        bind_text(p_friend_id_set, 1, candidate);
        bind_text(p_friend_id_set, 2, uuid);
        const int rc      = sqlite3_step(p_friend_id_set);
        const int changed = sqlite3_changes(db);
        reset(p_friend_id_set);

        if (rc == SQLITE_DONE && changed == 1) {
            friend_id = std::move(candidate);
            return true;
        }
        // 并发写入时另一请求已赋值：直接读取现有值
        if (friend_id_user(uuid, friend_id) && !friend_id.empty()) return true;
    }
    return false;
};

// 为所有缺失专属短 ID 的用户回填
void ensure_all_friend_id() noexcept {
    if (!db || !p_friend_id_miss) return;

    std::vector<std::string> missing;
    int rc;
    while ((rc = sqlite3_step(p_friend_id_miss)) == SQLITE_ROW) {
        if (const char* text = reinterpret_cast<const char*>(sqlite3_column_text(p_friend_id_miss, 0))) missing.emplace_back(text);
    }
    sqlite3_reset(p_friend_id_miss);

    for (const auto& uuid : missing) {
        std::string friend_id;
        ensure_friend_id(uuid, friend_id);
    }
};

// 查询用户权限等级
bool get_level(std::string_view uuid, int& level) noexcept {
    sqlite3_bind_text(p_get_level, 1, uuid.data(), uuid.size(), nullptr);

    int rc = sqlite3_step(p_get_level);
    if (rc != SQLITE_ROW) {
        sqlite3_reset(p_get_level);
        return false;
    }

    level = sqlite3_column_int(p_get_level, 0);
    sqlite3_reset(p_get_level);
    return level >= 1 && level <= 4;
};

// 生成一次性权限秘钥并写入数据库。
bool generate_level_key(int target_level, std::string& secret) noexcept {
    if (!db || LEVEL_SALT.empty() || target_level < 2 || target_level > 4) return false;

    for (int attempt = 0; attempt < 8; ++attempt) {
        auto candidate = generate_secret(target_level);
        const auto digest = secret_digest(candidate);
        sqlite3_stmt* insert = nullptr;
        if (sqlite3_prepare_v2(db, "INSERT INTO level_keys (digest, level) VALUES (?, ?)", -1, &insert, nullptr) != SQLITE_OK) return false;
        bind_text(insert, 1, digest);
        sqlite3_bind_int(insert, 2, target_level);
        const int rc = sqlite3_step(insert);
        sqlite3_finalize(insert);
        if (rc == SQLITE_DONE) {
            secret = std::move(candidate);
            return true;
        }
        if (rc != SQLITE_CONSTRAINT) return false;
    }
    return false;
}

bool unlock_level(std::string_view uuid, std::string_view secret, int& level) noexcept {
    if (!db || !p_consume_level_key || LEVEL_SALT.empty() || secret.empty()) return false;

    const auto digest = secret_digest(secret);
    if (sqlite3_exec(db, "BEGIN IMMEDIATE TRANSACTION", nullptr, nullptr, nullptr) != SQLITE_OK) return false;

    bind_text(p_consume_level_key, 1, digest);
    const int consume_rc = sqlite3_step(p_consume_level_key);
    const int consumed = sqlite3_changes(db);
    reset(p_consume_level_key);
    if (consume_rc != SQLITE_DONE || consumed != 1) {
        sqlite3_exec(db, "ROLLBACK", nullptr, nullptr, nullptr);
        return false;
    }

    sqlite3_stmt* set_level = nullptr;
    const int prepare_rc = sqlite3_prepare_v2(
        db,
        "UPDATE users SET level = (SELECT level FROM level_keys WHERE digest = ? LIMIT 1) WHERE uuid = ? AND level < (SELECT level FROM level_keys WHERE digest = ? LIMIT 1)",
        -1,
        &set_level,
        nullptr
    );
    if (prepare_rc != SQLITE_OK) {
        sqlite3_exec(db, "ROLLBACK", nullptr, nullptr, nullptr);
        return false;
    }
    bind_text(set_level, 1, digest);
    bind_text(set_level, 2, uuid);
    bind_text(set_level, 3, digest);
    const int set_rc = sqlite3_step(set_level);
    const int updated = sqlite3_changes(db);
    reset(set_level);
    sqlite3_finalize(set_level);
    if (set_rc != SQLITE_DONE || updated != 1) {
        sqlite3_exec(db, "ROLLBACK", nullptr, nullptr, nullptr);
        return false;
    }

    if (sqlite3_exec(db, "COMMIT", nullptr, nullptr, nullptr) != SQLITE_OK) {
        sqlite3_exec(db, "ROLLBACK", nullptr, nullptr, nullptr);
        return false;
    }

    return get_level(uuid, level);
};

// 是否存在标识
bool exist_user(std::string_view uuid) noexcept {
    sqlite3_bind_text(p_exist_user, 1, uuid.data(), uuid.size(), nullptr);

    int rc = sqlite3_step(p_exist_user);
    sqlite3_reset(p_exist_user);
    return rc == SQLITE_ROW;
};

// 是否存在邮箱或手机号（注册标识）
bool exist_ident(std::string_view ident) noexcept {
    if (ident.empty()) return false;

    sqlite3_bind_text(p_exist_ident, 1, ident.data(), ident.size(), nullptr);
    sqlite3_bind_text(p_exist_ident, 2, ident.data(), ident.size(), nullptr);

    int rc = sqlite3_step(p_exist_ident);
    sqlite3_reset(p_exist_ident);
    return rc == SQLITE_ROW;
};

// 是否存在账号
bool exist_account(std::string_view account) noexcept {
    if (account.empty()) return false;

    sqlite3_bind_text(p_exist_account, 1, account.data(), account.size(), nullptr);

    int rc = sqlite3_step(p_exist_account);
    sqlite3_reset(p_exist_account);
    return rc == SQLITE_ROW;
};


// 标识（邮箱/手机号/账号）得到标识
bool ident2uuid(std::string_view ident, std::string& uuid) noexcept {
    if (ident.empty()) return false;

    sqlite3_bind_text(p_ident_uuid, 1, ident.data(), ident.size(), nullptr);
    sqlite3_bind_text(p_ident_uuid, 2, ident.data(), ident.size(), nullptr);
    sqlite3_bind_text(p_ident_uuid, 3, ident.data(), ident.size(), nullptr);

    int rc = sqlite3_step(p_ident_uuid);
    if (rc != SQLITE_ROW) {
        sqlite3_reset(p_ident_uuid);
        return false;
    }

    uuid = reinterpret_cast<const char*>(sqlite3_column_text(p_ident_uuid, 0));

    sqlite3_reset(p_ident_uuid);
    return true;
};

// 校验密码
bool check_pass(std::string_view uuid, std::string_view password) noexcept {
    if (uuid.empty() || password.empty()) return false;

    sqlite3_bind_text(p_pass_user, 1, uuid.data(), uuid.size(), nullptr);

    int rc = sqlite3_step(p_pass_user);
    if (rc != SQLITE_ROW) {
        sqlite3_reset(p_pass_user);
        return false;
    }

    const auto* text = reinterpret_cast<const char*>(sqlite3_column_text(p_pass_user, 0));
    const std::string stored = text ? text : std::string();
    sqlite3_reset(p_pass_user);
    if (stored.empty()) return false;

    return Libs::Security::Bytes::safe_equal(stored, password_digest(password));
};

// 是否已设置登录密码
bool has_pass(std::string_view uuid, bool& has) noexcept {
    if (uuid.empty()) return false;

    bind_text(p_pass_user, 1, uuid);

    const int rc = sqlite3_step(p_pass_user);
    if (rc != SQLITE_ROW) {
        reset(p_pass_user);
        return false;
    }

    const auto* text = reinterpret_cast<const char*>(sqlite3_column_text(p_pass_user, 0));
    has = text && text[0] != '\0';
    reset(p_pass_user);
    return true;
}

// 更新登录密码
bool update_pass(std::string_view uuid, std::string_view pass) noexcept {
    if (uuid.empty() || pass.empty()) return false;

    const auto digest = password_digest(pass);

    bind_text(p_update_pass, 1, digest);
    bind_text(p_update_pass, 2, uuid);

    const int rc      = sqlite3_step(p_update_pass);
    const int changed = sqlite3_changes(db);
    reset(p_update_pass);
    return rc == SQLITE_DONE && changed == 1;
};

// 查询昵称颜色（空串表示未设置）
bool get_name_color(std::string_view uuid, std::string& out) noexcept {
    out.clear();
    if (!db || !p_get_name_color || uuid.empty()) return false;

    bind_text(p_get_name_color, 1, uuid);
    const int rc = sqlite3_step(p_get_name_color);
    if (rc == SQLITE_ROW) {
        if (const char* text = reinterpret_cast<const char*>(sqlite3_column_text(p_get_name_color, 0))) out = text;
    }
    reset(p_get_name_color);
    return rc == SQLITE_ROW;
};

// 设置昵称颜色（空串表示清除）
bool set_name_color(std::string_view uuid, std::string_view color) noexcept {
    if (!db || !p_set_name_color || uuid.empty()) return false;

    bind_text(p_set_name_color, 1, color);
    bind_text(p_set_name_color, 2, uuid);

    const int rc      = sqlite3_step(p_set_name_color);
    const int changed = sqlite3_changes(db);
    reset(p_set_name_color);
    return rc == SQLITE_DONE && changed == 1;
};
} // namespace User
} // namespace Manager