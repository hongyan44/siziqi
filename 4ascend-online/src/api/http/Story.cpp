/***
 * @Author: CsVeryLoveXieWenLi
 * @Description: 剧情角色 HTTP 接口（角色与表情图片；缩略图入库，原图落盘，管理员可下载）
 * @@Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
#include "Story.h"

#include "../Utils.h"

#include "../../libs/coder/Base64.h"
#include "../../libs/only/Flie.h"
#include "../../libs/only/Random.h"
#include "../../libs/only/Time.h"
#include "../../manager/Docs.h"
#include "../../manager/Story.h"
#include "../../manager/Task.h"
#include "../../manager/Token.h"
#include "../../manager/User.h"

#include <cinatra/coro_http_request.hpp>
#include <cinatra/coro_http_response.hpp>

#include <algorithm>
#include <filesystem>
#include <map>
#include <set>
#include <string>
#include <string_view>
#include <utility>
#include <vector>


namespace Api {
namespace Http {
namespace Story {
namespace {
// 角色名 / 表情名长度上限（字节，UTF-8 中文约 3 字节）
constexpr std::size_t NAME_LIMIT = 96;
// 关卡标题上限（编辑器限制 20 字，按 UTF-8 字节放宽到 64）
constexpr std::size_t TITLE_LIMIT = 64;
// 单个关卡剧本上限；整份剧本文档仍受 docs 的 1MB 上限约束
constexpr std::size_t SCRIPT_LIMIT = 512 * 1024;
// 关卡序号上限（与前端编辑器一致）
constexpr uint64_t LEVEL_MAX = 9999;
// 剧本文档上限（与 docs_update 对 story 文档的限制保持一致）
constexpr std::size_t STORY_DOC_LIMIT = 1024 * 1024;
// 原图落盘目录（相对服务进程工作目录）
constexpr std::string_view ORIGINAL_DIR = "db/story_images";

std::string json_string(const jsoncons::json& value, std::string_view key) noexcept {
    if (!value.contains(key)) return {};
    try { return value.at(key).as<std::string>(); } catch (...) { return {}; }
}

uint64_t json_u64(const jsoncons::json& value, std::string_view key) noexcept {
    if (!value.contains(key)) return 0;
    try { return value.at(key).as<uint64_t>(); } catch (...) { return 0; }
}

bool json_flag(const jsoncons::json& value, std::string_view key) noexcept {
    if (!value.contains(key)) return false;
    try { return value.at(key).as<bool>(); } catch (...) { return false; }
}

bool token_uuid(const jsoncons::json& value, std::string& uuid) noexcept {
    try {
        auto bin = value.at("token").as<jsoncons::byte_string_view>();
        std::string token(bin.begin(), bin.end());
        return Manager::Token::token2uuid(token, uuid) && Manager::User::exist_user(uuid);
    } catch (...) { return false; }
}

bool token_level(const jsoncons::json& value, std::string& uuid, int& level) noexcept {
    level = 0;
    return token_uuid(value, uuid) && Manager::User::get_level(uuid, level);
}

// jsoncons 1.9 的 dump 需要显式输出容器
std::string json_dump(const jsoncons::json& value) {
    std::string buffer;
    value.dump(buffer);
    return buffer;
}

// 等级 2 及以上可使用剧情编辑器与角色管理器；等级 4 额外拥有删除与审核权限
bool can_edit(const jsoncons::json& value, std::string& uuid, int& level) noexcept {
    return token_level(value, uuid, level) && level >= 2;
}

// 只接受前端 canvas 生成的图片 data URL，避免写入任意文本
bool valid_image(std::string_view image) noexcept {
    if (image.empty() || image.size() > Manager::Story::IMAGE_LIMIT) return false;
    return image.starts_with("data:image/") && image.find(";base64,") != std::string_view::npos;
}

bool valid_name(std::string_view name) noexcept {
    return !name.empty() && name.size() <= NAME_LIMIT;
}

std::string image_extension(std::string_view subtype) noexcept {
    if (subtype == "png") return "png";
    if (subtype == "webp") return "webp";
    if (subtype == "jpeg" || subtype == "jpg") return "jpg";
    return {};
}

std::string image_mime(std::string_view path) noexcept {
    if (path.ends_with(".png")) return "png";
    if (path.ends_with(".jpg")) return "jpeg";
    return "webp";
}

// 把 data URL 中的原图写到服务端磁盘，返回相对路径；失败返回空串
std::string save_original(std::string_view data_url) noexcept {
    const auto mark = data_url.find(";base64,");
    if (mark == std::string_view::npos) return {};
    const auto head = data_url.substr(0, mark);
    const auto slash = head.rfind('/');
    if (slash == std::string_view::npos) return {};
    const std::string ext = image_extension(head.substr(slash + 1));
    if (ext.empty()) return {};

    std::string raw;
    Libs::Coder::Base64::decode(data_url.substr(mark + 8), raw);
    if (raw.empty() || raw.size() > Manager::Story::IMAGE_LIMIT) return {};

    std::error_code ec;
    std::filesystem::create_directories(std::string(ORIGINAL_DIR), ec);
    const std::string path = std::string(ORIGINAL_DIR) + "/" + Libs::Only::Random::uuid_v4() + "." + ext;
    Libs::Only::Flie::write(path, raw);
    if (!std::filesystem::exists(path, ec)) return {};
    return path;
}

// 读取磁盘原图并转回 data URL；文件缺失返回空串
std::string original_data_url(std::string_view path) noexcept {
    if (path.empty()) return {};
    std::string raw;
    Libs::Only::Flie::read(path, raw);
    if (raw.empty()) return {};
    return "data:image/" + image_mime(path) + ";base64," + Libs::Coder::Base64::encode(raw);
}

void remove_original(std::string_view path) noexcept {
    if (path.empty()) return;
    std::error_code ec;
    std::filesystem::remove(std::string(path), ec);
}

// 解析可选的 original 参数；provided 表示本次是否携带新原图（未携带时调用方保留库中已有原图）。
// 空串按「未携带」处理：只换压缩图时不会清空已落盘的原图。
bool resolve_original(const jsoncons::json& value, std::string& path, bool* provided = nullptr) noexcept {
    path.clear();
    if (provided) *provided = false;
    const auto original = json_string(value, "original");
    if (original.empty()) return true;
    if (!valid_image(original)) return false;
    path = save_original(original);
    if (path.empty()) return false;
    if (provided) *provided = true;
    return true;
}

// 只下发压缩图（rep / image）；has_original 仅表示服务端是否存有原图，供管理页判断能否保留，不携带原图本体
// with_images=false 时只返回名称等元信息（剧情编辑器只需角色名与表情名，避免整库图片拖慢解密）
jsoncons::json character_json(const Manager::Story::CharacterRecord& record, const std::set<std::string>* expressions, bool with_images) noexcept {
    jsoncons::json value = jsoncons::json::object();
    value["id"] = record.id;
    value["name"] = record.name;
    if (with_images) value["rep"] = record.rep;
    value["has_original"] = !record.rep_original.empty();
    value["updated_at"] = record.updated_at;
    jsoncons::json list = jsoncons::json::array();
    for (const auto& item : record.expressions) {
        // expressions 非空时只返回剧情关卡实际用到的表情，避免整库图片下发给前端
        if (expressions && expressions->count(item.name) == 0) continue;
        jsoncons::json expression = jsoncons::json::object();
        expression["id"] = item.id;
        expression["name"] = item.name;
        if (with_images) expression["image"] = item.image;
        expression["has_original"] = !item.image_original.empty();
        list.push_back(expression);
    }
    value["expressions"] = list;
    return value;
}

// 解析可选的 faces 过滤：[{name, expressions: [...]}]；未提供时返回全部角色与表情
bool parse_faces(const jsoncons::json& value, std::map<std::string, std::set<std::string>>& faces, bool& filtered) noexcept {
    faces.clear();
    filtered = false;
    if (!value.contains("faces")) return true;
    const auto& list = value.at("faces");
    if (!list.is_array()) return false;
    filtered = true;
    for (const auto& item : list.array_range()) {
        if (!item.is_object()) continue;
        const auto name = json_string(item, "name");
        if (name.empty()) continue;
        auto& expressions = faces[name];
        if (!item.contains("expressions") || !item.at("expressions").is_array()) continue;
        for (const auto& expression : item.at("expressions").array_range()) {
            if (!expression.is_string()) continue;
            try {
                const auto text = expression.as<std::string>();
                if (!text.empty()) expressions.insert(text);
            } catch (...) { /* 忽略非法表情名 */ }
        }
    }
    return true;
}

// 读取 docs 里的剧情目录（story 文档），返回 levels 数组
bool load_story_levels(jsoncons::json& levels) noexcept {
    Manager::Docs::DocRecord record{};
    if (!Manager::Docs::query_doc("story", record) || record.data.empty()) return false;
    jsoncons::json catalog;
    try { catalog = jsoncons::json::parse(record.data); } catch (...) { return false; }
    if (!catalog.contains("levels") || !catalog.at("levels").is_array()) return false;
    levels = catalog.at("levels");
    return true;
}

// 关卡序号缺失时按所在位置补位（与前端 normalizeCatalog 一致）
uint64_t json_level(const jsoncons::json& item, std::size_t index) noexcept {
    if (!item.contains("level")) return index;
    try {
        const auto value = item.at("level").as<int64_t>();
        if (value > 0) return static_cast<uint64_t>(value);
    } catch (...) { /* 非法序号回退位置 */ }
    return index;
}

// 读取完整剧本文档；文档不存在时返回空目录，便于合并投稿
bool load_story_catalog(jsoncons::json& catalog) noexcept {
    catalog = jsoncons::json::object();
    catalog["version"] = 1;
    catalog["levels"] = jsoncons::json::array();

    Manager::Docs::DocRecord record{};
    if (!Manager::Docs::query_doc("story", record) || record.data.empty()) return true;
    try { catalog = jsoncons::json::parse(record.data); } catch (...) { return false; }
    if (!catalog.is_object()) return false;
    if (!catalog.contains("levels") || !catalog.at("levels").is_array()) catalog["levels"] = jsoncons::json::array();
    return true;
}

// 投稿记录转前端结构。图片原图体量大，只在审核通过时由服务端使用，不下发给前端。
jsoncons::json submission_json(const Manager::Story::SubmissionRecord& record) noexcept {
    jsoncons::json value = jsoncons::json::object();
    value["id"] = record.id;
    value["kind"] = record.kind;
    value["level_from"] = record.level_from;
    value["level_to"] = record.level_to;
    value["name"] = record.name;
    value["creator"] = record.creator;
    std::string creator_name;
    Manager::User::name_user(record.creator, creator_name);
    value["creator_name"] = creator_name;
    value["created_at"] = record.created_at;
    value["status"] = record.status;
    value["reviewer"] = record.reviewer;
    value["reviewed_at"] = record.reviewed_at;

    jsoncons::json payload = jsoncons::json::object();
    try { payload = jsoncons::json::parse(record.payload); } catch (...) { payload = jsoncons::json::object(); }
    if (!payload.is_object()) payload = jsoncons::json::object();

    // 剔除原图本体，只告知是否携带原图
    const auto original = json_string(payload, "original");
    jsoncons::json clean = jsoncons::json::object();
    for (const auto& member : payload.object_range()) {
        if (member.key() != "original") clean[member.key()] = member.value();
    }
    value["has_original"] = !original.empty();
    value["payload"] = clean;
    return value;
}

// 等级 2/3 的角色管理器操作：只入库为待审投稿，不直接落盘/写库
bool create_character_submission(
    const jsoncons::json& value,
    std::string_view action,
    std::string_view creator,
    uint64_t now,
    uint64_t& id
) noexcept {
    id = 0;
    const auto image = json_string(value, "image");
    const auto original = json_string(value, "original");
    if (!valid_image(image)) return false;
    if (!original.empty() && !valid_image(original)) return false;

    jsoncons::json payload = jsoncons::json::object();
    payload["image"] = image;
    if (!original.empty()) payload["original"] = original;

    std::string name;
    if (action == "character") {
        name = json_string(value, "name");
        if (!valid_name(name) || Manager::Story::exist_character_name(name)) return false;
    } else if (action == "expression") {
        const auto character_id = json_u64(value, "character_id");
        name = json_string(value, "name");
        if (!valid_name(name) || !Manager::Story::exist_character_id(character_id)) return false;
        if (Manager::Story::exist_expression_name(character_id, name)) return false;
        payload["character_id"] = character_id;
    } else if (action == "update_rep") {
        const auto character_id = json_u64(value, "character_id");
        if (!Manager::Story::exist_character_id(character_id)) return false;
        payload["character_id"] = character_id;
    } else if (action == "update_expression_image") {
        const auto character_id = json_u64(value, "character_id");
        const auto expression_id = json_u64(value, "expression_id");
        std::string old_name, old_image, old_original;
        if (!Manager::Story::query_expression_image(character_id, expression_id, old_name, old_image, old_original)) return false;
        name = old_name;
        payload["character_id"] = character_id;
        payload["expression_id"] = expression_id;
    } else {
        return false;
    }

    return Manager::Story::add_submission(action, 0, 0, name, json_dump(payload), creator, now, id);
}

// 审核通过：把投稿内容应用到正式数据
bool apply_level_submission(const Manager::Story::SubmissionRecord& record, std::string_view reviewer, uint64_t now) noexcept {
    jsoncons::json payload;
    try { payload = jsoncons::json::parse(record.payload); } catch (...) { return false; }
    if (!payload.is_object()) return false;

    const auto title = json_string(payload, "title");
    const auto script = json_string(payload, "script");
    if (title.empty() || title.size() > TITLE_LIMIT || script.size() > SCRIPT_LIMIT) return false;

    jsoncons::json catalog;
    if (!load_story_catalog(catalog)) return false;

    std::vector<std::pair<uint64_t, jsoncons::json>> items;
    std::size_t index = 0;
    for (const auto& item : catalog.at("levels").array_range()) {
        const uint64_t current = json_level(item, index);
        index++;
        // 同序号覆盖：移除被编辑的旧关卡与目标序号上可能存在的旧关卡
        if (record.level_from != 0 && current == record.level_from) continue;
        if (current == record.level_to) continue;
        items.emplace_back(current, item);
    }

    jsoncons::json entry = jsoncons::json::object();
    entry["level"] = record.level_to;
    entry["title"] = title;
    entry["script"] = script;
    if (payload.contains("stats") && payload.at("stats").is_object()) entry["stats"] = payload.at("stats");
    items.emplace_back(record.level_to, entry);

    std::sort(items.begin(), items.end(), [](const auto& left, const auto& right) {
        return left.first < right.first;
    });

    jsoncons::json levels = jsoncons::json::array();
    for (const auto& item : items) levels.push_back(item.second);
    catalog["levels"] = levels;

    const std::string data = json_dump(catalog);
    if (data.size() > STORY_DOC_LIMIT) return false;
    return Manager::Docs::update_doc("story", data, reviewer, now);
}

bool apply_character_submission(const Manager::Story::SubmissionRecord& record, uint64_t now) noexcept {
    jsoncons::json payload;
    try { payload = jsoncons::json::parse(record.payload); } catch (...) { return false; }
    if (!payload.is_object()) return false;

    const auto image = json_string(payload, "image");
    if (!valid_image(image)) return false;
    const auto original = json_string(payload, "original");
    if (!original.empty() && !valid_image(original)) return false;

    std::string original_path;
    bool replaced = false;
    if (!original.empty()) {
        original_path = save_original(original);
        if (original_path.empty()) return false;
        replaced = true;
    }

    const auto cleanup = [&]() {
        if (replaced) remove_original(original_path);
    };

    uint64_t created_id = 0;
    if (record.kind == "character") {
        if (!valid_name(record.name) || Manager::Story::exist_character_name(record.name)) {
            cleanup();
            return false;
        }
        if (!Manager::Story::add_character(record.name, image, original_path, record.creator, now, created_id)) {
            cleanup();
            return false;
        }
        return true;
    }

    const auto character_id = json_u64(payload, "character_id");
    if (record.kind == "expression") {
        if (!valid_name(record.name) || !Manager::Story::exist_character_id(character_id)) {
            cleanup();
            return false;
        }
        if (Manager::Story::exist_expression_name(character_id, record.name)) {
            cleanup();
            return false;
        }
        if (!Manager::Story::add_expression(character_id, record.name, image, original_path, record.creator, now, created_id)) {
            cleanup();
            return false;
        }
        return true;
    }

    if (record.kind == "update_rep") {
        std::string old_name, old_image, old_original;
        if (!Manager::Story::query_character_rep(character_id, old_name, old_image, old_original)) {
            cleanup();
            return false;
        }
        if (!replaced) original_path = old_original;
        if (!Manager::Story::update_character_rep(character_id, image, original_path, now)) {
            cleanup();
            return false;
        }
        if (replaced) remove_original(old_original);
        return true;
    }

    if (record.kind == "update_expression_image") {
        const auto expression_id = json_u64(payload, "expression_id");
        std::string old_name, old_image, old_original;
        if (!Manager::Story::query_expression_image(character_id, expression_id, old_name, old_image, old_original)) {
            cleanup();
            return false;
        }
        if (!replaced) original_path = old_original;
        if (!Manager::Story::update_expression_image(character_id, expression_id, image, original_path, now)) {
            cleanup();
            return false;
        }
        if (replaced) remove_original(old_original);
        return true;
    }

    cleanup();
    return false;
}

bool apply_submission(const Manager::Story::SubmissionRecord& record, std::string_view reviewer, uint64_t now) noexcept {
    if (record.kind == "level") return apply_level_submission(record, reviewer, now);
    return apply_character_submission(record, now);
}
} // namespace

// 查询全部角色与表情。公开接口，任何人可读（剧情播放页需要展示角色图）。
// 可选 faces 过滤：只返回剧情关卡实际用到的角色与表情，减少进入关卡前的下载量。
// 可选 meta=true：只返回角色名与表情名，不下发图片本体（剧情编辑器选角色用，避免大文件解密阻塞页面）。
void character_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("character_query", response);
    auto value = body.value();

    std::map<std::string, std::set<std::string>> faces;
    bool filtered = false;
    if (!parse_faces(value, faces, filtered)) return api_http_error("character_query", response);

    const bool meta_only = json_flag(value, "meta");

    std::vector<Manager::Story::CharacterRecord> records;
    if (!Manager::Story::query_characters(records)) return api_http_error("character_query", response);

    jsoncons::json characters = jsoncons::json::array();
    for (const auto& record : records) {
        if (filtered) {
            const auto found = faces.find(record.name);
            if (found == faces.end()) continue;
            characters.push_back(character_json(record, &found->second, !meta_only));
        } else {
            characters.push_back(character_json(record, nullptr, !meta_only));
        }
    }

    jsoncons::json result = jsoncons::json::object();
    result["characters"] = characters;

    std::string buffer;
    api_end("character_query", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 剧情关卡查询：不带 level 时返回目录（仅序号/标题/统计，不含剧本）；
// 带 level 时只返回该关剧本，避免进入剧情模式时一次性下发全部关卡。
void level_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("level_query", response);
    auto value = body.value();

    jsoncons::json levels;
    if (!load_story_levels(levels)) return api_http_error("level_query", response);

    const auto level = json_u64(value, "level");
    jsoncons::json result = jsoncons::json::object();
    if (level == 0) {
        jsoncons::json list = jsoncons::json::array();
        std::size_t index = 0;
        for (const auto& item : levels.array_range()) {
            ++index;
            if (!item.is_object()) continue;
            jsoncons::json entry = jsoncons::json::object();
            entry["level"] = json_level(item, index);
            entry["title"] = json_string(item, "title");
            if (item.contains("stats") && item.at("stats").is_object()) entry["stats"] = item.at("stats");
            list.push_back(entry);
        }
        result["levels"] = list;
    } else {
        bool found = false;
        std::size_t index = 0;
        for (const auto& item : levels.array_range()) {
            ++index;
            if (!item.is_object() || json_level(item, index) != level) continue;
            result["level"] = level;
            result["title"] = json_string(item, "title");
            result["script"] = json_string(item, "script");
            found = true;
            break;
        }
        if (!found) return api_http_error("level_query", response);
    }

    std::string buffer;
    api_end("level_query", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 新增角色 / 新增表情 / 更换代表图 / 删除角色 / 删除表情。
// 等级 ≥ 2 可使用：等级 4 直接保存；等级 2/3 的修改提交待审投稿，且不能删除任何内容。
void character_update(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("character_update", response);
    auto value = body.value();

    std::string creator;
    int level = 0;
    if (!can_edit(value, creator, level)) return api_http_error("character_update", response);

    const auto action = json_string(value, "action");
    const auto now = static_cast<uint64_t>(Libs::Only::Time::timestamp_ms());
    uint64_t id = 0;

    // 删除权限仅限等级 4：等级 2/3 不得删除关卡、角色或表情
    if (action == "delete" || action == "delete_expression") {
        if (level < 4) return api_http_error("character_update", response);
    } else if (level != 4) {
        if (!create_character_submission(value, action, creator, now, id)) return api_http_error("character_update", response);
        // 剧情系统内的任何投稿都算「尝试投稿剧情」
        Manager::Task::event(creator, "story_submit", Manager::Task::today());
        jsoncons::json pending = jsoncons::json::object();
        pending["id"] = id;
        pending["submitted"] = true;
        std::string pending_buffer;
        api_end("character_update", true, pending, pending_buffer);
        response.set_status_and_content(cinatra::status_type::ok, pending_buffer);
        return;
    }

    if (action == "character") {
        const auto name = json_string(value, "name");
        const auto image = json_string(value, "image");
        if (!valid_name(name) || !valid_image(image)) return api_http_error("character_update", response);
        if (Manager::Story::exist_character_name(name)) return api_http_error("character_update", response);
        std::string original_path;
        if (!resolve_original(value, original_path)) return api_http_error("character_update", response);
        if (!Manager::Story::add_character(name, image, original_path, creator, now, id)) {
            remove_original(original_path);
            return api_http_error("character_update", response);
        }
    } else if (action == "expression") {
        const auto character_id = json_u64(value, "character_id");
        const auto name = json_string(value, "name");
        const auto image = json_string(value, "image");
        if (!valid_name(name) || !valid_image(image)) return api_http_error("character_update", response);
        if (!Manager::Story::exist_character_id(character_id)) return api_http_error("character_update", response);
        if (Manager::Story::exist_expression_name(character_id, name)) return api_http_error("character_update", response);
        std::string original_path;
        if (!resolve_original(value, original_path)) return api_http_error("character_update", response);
        if (!Manager::Story::add_expression(character_id, name, image, original_path, creator, now, id)) {
            remove_original(original_path);
            return api_http_error("character_update", response);
        }
    } else if (action == "update_rep") {
        const auto character_id = json_u64(value, "character_id");
        const auto image = json_string(value, "image");
        if (!valid_image(image)) return api_http_error("character_update", response);
        if (!Manager::Story::exist_character_id(character_id)) return api_http_error("character_update", response);
        std::string old_name, old_image, old_original;
        Manager::Story::query_character_rep(character_id, old_name, old_image, old_original);
        std::string original_path;
        bool replaced = false;
        if (!resolve_original(value, original_path, &replaced)) return api_http_error("character_update", response);
        // 未携带新原图时沿用库中原图路径：只更新压缩图，不触碰已落盘的原图
        if (!replaced) original_path = old_original;
        if (!Manager::Story::update_character_rep(character_id, image, original_path, now)) {
            if (replaced) remove_original(original_path);
            return api_http_error("character_update", response);
        }
        if (replaced) remove_original(old_original);
        id = character_id;
    } else if (action == "update_expression_image") {
        const auto character_id = json_u64(value, "character_id");
        const auto expression_id = json_u64(value, "expression_id");
        const auto image = json_string(value, "image");
        if (!valid_image(image)) return api_http_error("character_update", response);
        std::string old_name, old_image, old_original;
        if (!Manager::Story::query_expression_image(character_id, expression_id, old_name, old_image, old_original)) return api_http_error("character_update", response);
        std::string original_path;
        bool replaced = false;
        if (!resolve_original(value, original_path, &replaced)) return api_http_error("character_update", response);
        // 未携带新原图时沿用库中原图路径：只更新压缩图，不触碰已落盘的原图
        if (!replaced) original_path = old_original;
        if (!Manager::Story::update_expression_image(character_id, expression_id, image, original_path, now)) {
            if (replaced) remove_original(original_path);
            return api_http_error("character_update", response);
        }
        if (replaced) remove_original(old_original);
        id = expression_id;
    } else if (action == "delete") {
        const auto character_id = json_u64(value, "character_id");
        if (!Manager::Story::exist_character_id(character_id)) return api_http_error("character_update", response);
        std::vector<std::string> originals;
        Manager::Story::query_character_originals(character_id, originals);
        if (!Manager::Story::delete_character(character_id)) return api_http_error("character_update", response);
        for (const auto& path : originals) remove_original(path);
        id = character_id;
    } else if (action == "delete_expression") {
        const auto character_id = json_u64(value, "character_id");
        const auto expression_id = json_u64(value, "expression_id");
        if (!Manager::Story::exist_character_id(character_id)) return api_http_error("character_update", response);
        std::string name, image, original;
        Manager::Story::query_expression_image(character_id, expression_id, name, image, original);
        if (!Manager::Story::delete_expression(character_id, expression_id)) return api_http_error("character_update", response);
        remove_original(original);
        id = expression_id;
    } else {
        return api_http_error("character_update", response);
    }

    jsoncons::json result = jsoncons::json::object();
    result["id"] = id;

    std::string buffer;
    api_end("character_update", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 等级 ≥ 2 可下载原图：kind = rep（角色代表图）/ expression（表情），返回 data URL。
// 旧数据没有落盘原图，回退为库中图片（旧格式本身就是原尺寸图）。
void image_download(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("image_download", response);
    auto value = body.value();

    std::string mover;
    int level = 0;
    if (!can_edit(value, mover, level)) return api_http_error("image_download", response);

    const auto kind = json_string(value, "kind");
    const auto character_id = json_u64(value, "character_id");
    std::string name, image, original;
    bool found = false;
    if (kind == "expression") {
        found = Manager::Story::query_expression_image(character_id, json_u64(value, "expression_id"), name, image, original);
    } else {
        found = Manager::Story::query_character_rep(character_id, name, image, original);
    }
    if (!found) return api_http_error("image_download", response);

    auto data = original_data_url(original);
    if (data.empty()) data = image;
    if (data.empty()) return api_http_error("image_download", response);

    jsoncons::json result = jsoncons::json::object();
    result["name"] = name;
    result["image"] = data;

    std::string buffer;
    api_end("image_download", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 剧情播放页按需取图：公开只读（与 character_query 一致），返回服务端原图 data URL。
// 前端据此按角色框实际像素重新压缩并填充满；旧数据没有落盘原图时回退为库中图片。
void image_source(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("image_source", response);
    auto value = body.value();

    const auto kind = json_string(value, "kind");
    const auto character_id = json_u64(value, "character_id");
    std::string name, image, original;
    bool found = false;
    if (kind == "expression") {
        found = Manager::Story::query_expression_image(character_id, json_u64(value, "expression_id"), name, image, original);
    } else {
        found = Manager::Story::query_character_rep(character_id, name, image, original);
    }
    if (!found) return api_http_error("image_source", response);

    auto data = original_data_url(original);
    if (data.empty()) data = image;
    if (data.empty()) return api_http_error("image_source", response);

    jsoncons::json result = jsoncons::json::object();
    result["name"] = name;
    result["image"] = data;

    std::string buffer;
    api_end("image_source", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 等级 ≥ 2 提交剧情/角色编辑投稿；等级 4 直接保存（走原有接口，不产生投稿）。
void submission_submit(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("submission_submit", response);
    auto value = body.value();

    std::string creator;
    int level = 0;
    if (!can_edit(value, creator, level)) return api_http_error("submission_submit", response);

    const auto kind = json_string(value, "kind");
    const auto now = static_cast<uint64_t>(Libs::Only::Time::timestamp_ms());
    uint64_t id = 0;

    if (kind == "level") {
        const auto level_from = json_u64(value, "level_from");
        const auto level_to = json_u64(value, "level_to");
        const auto title = json_string(value, "title");
        const auto script = json_string(value, "script");
        if (level_from > LEVEL_MAX || level_to == 0 || level_to > LEVEL_MAX) return api_http_error("submission_submit", response);
        if (title.empty() || title.size() > TITLE_LIMIT || script.size() > SCRIPT_LIMIT) return api_http_error("submission_submit", response);

        jsoncons::json payload = jsoncons::json::object();
        payload["title"] = title;
        payload["script"] = script;
        if (value.contains("stats") && value.at("stats").is_object()) payload["stats"] = value.at("stats");
        if (!Manager::Story::add_submission(kind, level_from, level_to, title, json_dump(payload), creator, now, id)) {
            return api_http_error("submission_submit", response);
        }
    } else {
        if (!create_character_submission(value, kind, creator, now, id)) return api_http_error("submission_submit", response);
    }

    // 剧情系统内的任何投稿都会推进「尝试投稿剧情」每日任务
    Manager::Task::event(creator, "story_submit", Manager::Task::today());

    jsoncons::json result = jsoncons::json::object();
    result["id"] = id;
    result["submitted"] = true;

    std::string buffer;
    api_end("submission_submit", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 等级 4 查看全部待审投稿；等级 2/3 只能查看自己的投稿记录（含已审核结果）。
void submission_query(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("submission_query", response);
    auto value = body.value();

    std::string creator;
    int level = 0;
    if (!can_edit(value, creator, level)) return api_http_error("submission_query", response);

    const bool admin = level == 4;
    std::vector<Manager::Story::SubmissionRecord> records;
    if (!Manager::Story::query_submissions(admin, admin ? std::string_view{} : std::string_view(creator), records)) {
        return api_http_error("submission_query", response);
    }

    jsoncons::json list = jsoncons::json::array();
    for (const auto& record : records) list.push_back(submission_json(record));

    jsoncons::json result = jsoncons::json::object();
    result["submissions"] = list;

    std::string buffer;
    api_end("submission_query", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

// 仅等级 4 可审核投稿：approve 应用到正式数据，reject 仅标记拒绝。
void submission_review(cinatra::coro_http_request& request, cinatra::coro_http_response& response) {
    auto body = api_body(request.get_body());
    if (!body) return api_http_error("submission_review", response);
    auto value = body.value();

    std::string reviewer;
    int level = 0;
    if (!token_level(value, reviewer, level) || level != 4) return api_http_error("submission_review", response);

    const auto id = json_u64(value, "id");
    const auto action = json_string(value, "action");
    const auto now = static_cast<uint64_t>(Libs::Only::Time::timestamp_ms());

    Manager::Story::SubmissionRecord record{};
    if (!Manager::Story::query_submission(id, record) || record.status != 0) return api_http_error("submission_review", response);

    if (action == "reject") {
        if (!Manager::Story::set_submission_status(id, 0, 2, reviewer, now)) return api_http_error("submission_review", response);
    } else if (action == "approve") {
        // 先占用审核状态，避免同一投稿被并发、重复应用
        if (!Manager::Story::set_submission_status(id, 0, 1, reviewer, now)) return api_http_error("submission_review", response);
        if (!apply_submission(record, reviewer, now)) {
            Manager::Story::set_submission_status(id, 1, 0, std::string_view{}, 0);
            return api_http_error("submission_review", response);
        }
    } else {
        return api_http_error("submission_review", response);
    }

    jsoncons::json result = jsoncons::json::object();
    result["id"] = id;
    result["status"] = action == "approve" ? 1 : 2;

    std::string buffer;
    api_end("submission_review", true, result, buffer);
    response.set_status_and_content(cinatra::status_type::ok, buffer);
}

void load(cinatra::coro_http_server& server) noexcept {
    server.set_http_handler<cinatra::POST>("/story/character_query", character_query);
    server.set_http_handler<cinatra::POST>("/story/character_update", character_update);
    server.set_http_handler<cinatra::POST>("/story/image_download", image_download);
    server.set_http_handler<cinatra::POST>("/story/image_source", image_source);
    server.set_http_handler<cinatra::POST>("/story/level_query", level_query);
    server.set_http_handler<cinatra::POST>("/story/submission_submit", submission_submit);
    server.set_http_handler<cinatra::POST>("/story/submission_query", submission_query);
    server.set_http_handler<cinatra::POST>("/story/submission_review", submission_review);
}
} // namespace Story
} // namespace Http
} // namespace Api
