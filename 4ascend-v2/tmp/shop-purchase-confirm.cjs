// 商店购买二次确认 & 火与钢皮肤回传回归测试
// 运行：node tmp/shop-purchase-confirm.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let count = 0;
const ok = (msg) => {
    count += 1;
    console.log(`  ✓ ${msg}`);
};

// 1. 卡片按钮不再直接扣费，只打开弹窗（弹窗内按钮才是二次确认）
const shopSrc = read('js/main/shop.cjs');
const bindBlock = shopSrc.slice(shopSrc.indexOf('const shop_bind'), shopSrc.indexOf('// 基础收益'));
assert.ok(!bindBlock.includes('shop_buy('), '卡片点击不应直接调用 shop_buy');
assert.ok(bindBlock.includes('shop_dialog_open(card.dataset.item)'), '卡片点击应打开商品弹窗');
ok('卡片点击只打开弹窗，不直接扣费');

// 2. 弹窗按钮显式标注「确认购买 / 确认兑换」
assert.ok(shopSrc.includes('const confirm_action'), '弹窗应计算二次确认文案');
assert.ok(shopSrc.includes("'确认兑换'"), '权限码应显示「确认兑换」');
assert.ok(shopSrc.includes("'确认购买'"), '商品应显示「确认购买」');
assert.ok(shopSrc.includes('${confirm_action}'), '弹窗按钮应使用二次确认文案');
ok('弹窗按钮为二次确认文案');

// 3. 弹窗内购买按钮仍走 shop_buy
assert.ok(shopSrc.includes('shop_buy(shop_dialog_item)'), '弹窗内按钮应执行购买');
ok('弹窗内确认按钮执行购买');

// 4. 后端 user_info 必须回传 grass_firesteel
const userCpp = read('../4ascend-online/src/api/http/User.cpp');
const infoBlock = userCpp.slice(userCpp.indexOf('void user_info'), userCpp.indexOf('void user_rtoken'));
assert.ok(infoBlock.includes('skin_grass_firesteel'), 'user_info 应读取火与钢皮肤');
assert.ok(infoBlock.includes('skins.push_back(std::string("grass_firesteel"))'), 'user_info 应回传 grass_firesteel');
ok('user_info 回传火与钢皮肤');

// 5. shop_buy 也必须回传火与钢皮肤
const buyBlock = userCpp.slice(userCpp.indexOf('void user_shop_buy'), userCpp.indexOf('void user_voucher_use'));
assert.ok(buyBlock.includes('skins.push_back(std::string("grass_firesteel"))'), 'shop_buy 应回传 grass_firesteel');
ok('shop_buy 回传火与钢皮肤');

// 6. 发布产物已包含本次改动
const shopMin = read('root/js/main/shop.min.js');
assert.ok(shopMin.includes('确认购买') && shopMin.includes('确认兑换'), 'shop.min.js 应包含二次确认文案');
ok('shop.min.js 已重建');

const page = read('root/pages/user/shop.html');
assert.ok(!page.includes('?v=replace'), '发布版商店页版本号应已替换');
assert.ok(page.includes('art-grass-firesteel'), '发布版商店页应包含火与钢卡面');
ok('发布版商店页已刷新版本号');

console.log(`\n${count} 项断言全部通过`);
