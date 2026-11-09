# Steam Store

Steam 账号 / 代充 / 改区商城。Next.js 16 全栈（App Router + Route Handlers）+ Prisma + MySQL。

## 快速开始

```bash
# 1. MySQL（Docker）
docker run -d --name steam-mysql -e MYSQL_ROOT_PASSWORD=my-secret-pw -e MYSQL_DATABASE=steam_store \
  -p 3306:3306 -v steam-mysql-data:/var/lib/mysql mysql:8

# 2. 环境变量
cp .env.example .env   # 按需修改 DATABASE_URL / SESSION_SECRET / ADMIN_EMAILS / SMTP / USDT 地址

# 3. 安装、建表、填充示例商品
npm install
npm run db:migrate
npm run db:seed

# 4. 启动
npm run dev            # http://localhost:3000
```

用 `ADMIN_EMAILS` 里的邮箱注册即自动成为管理员，后台在 `/admin`。
未配置 SMTP 时，所有邮件（含验证码）直接打印到 `npm run dev` 的终端。

## 目录结构

```
prisma/schema.prisma          数据模型（用户/身份/商品/库存/订单/支付/工单）
prisma/seed.ts                示例商品 + 库存
src/server/lib/               基础设施：prisma、env、session(JWT cookie)、mail、api 包装
src/server/services/          业务逻辑（纯函数，不依赖 HTTP；Web API 与 Telegram Bot 共用）
  auth.ts                     验证码、注册/登录、Telegram Widget 校验、身份绑定与账号合并
  products.ts                 商品、库存导入
  orders.ts                   下单锁库存、超时释放、支付后发货/开工单、后台完成/退款
  payments.ts                 BEpusdt 建单 / 回调 / 换链取消、后台人工确认、模拟支付商
  tickets.ts                  售前/售后工单、客服回复、通知
src/server/bot/               Telegram Bot（grammY）：telegram.ts 交互逻辑，i18n.ts 四语文案
src/app/api/telegram/webhook  Bot Webhook 入口（生产）；scripts/telegram-bot.ts 长轮询 / 设置 webhook
src/app/api/**                HTTP 接口（薄层：鉴权 + zod 校验 → services）
src/app/(shop)/**             前台页面
src/app/admin/**              后台页面
src/components/ui/            shadcn/ui 组件（Button/Card/Badge/Sheet/...，base-nova 风格，RTL 已启用）
src/components/               shared.tsx（StatusBadge/MoneyText/PageHeader/EmptyState/CodeBlock）、ApiForm、PayPanel、
                              NavClient/AdminShell（响应式导航）、MessageThread、forms/*（带 transform 的客户端表单）
scripts/smoke-test.ps1        端到端冒烟测试（需 dev server 运行中）
```

## 核心流程

```
下单  POST /api/orders           → PENDING，自动发货商品锁定库存 15 分钟
支付  POST /api/orders/:id/pay   → 创建 Payment（BEPUSDT 链上支付；开发环境另有 MOCK）
      模拟支付商回调 POST /api/payments/mock/callback（HMAC 验签）
      链上：BEpusdt 回调 POST /api/payments/bepusdt/notify；没匹配上时管理员后台「确认到账」
发货  fulfillPaidOrder()
      AUTO_INVENTORY → 库存标记 SOLD，deliveryPayload 写入订单，邮件发给用户 → DELIVERED
      MANUAL_TICKET  → 自动创建 TOPUP/REGION_CHANGE 工单，通知管理员 → PROCESSING
      管理员处理完 POST /api/admin/orders/:id/complete → DELIVERED，工单 RESOLVED
```

订单状态机：`PENDING → PAID/PROCESSING → DELIVERED`，分支 `EXPIRED / CANCELLED / REFUNDED`。
无 Redis/定时任务：过期订单由下单、查询时的 `expireStaleOrders()` 顺带释放。

## 登录与账号合并

一个用户可挂多个身份（`identities` 表：EMAIL / TELEGRAM / DISCORD）。
TG 用户绑定邮箱时若邮箱已属于另一账号：验证码通过 → 两账号无同类型身份冲突 → 合并到创建更早的账号（订单、工单、余额一起迁移）；有冲突则 409 拒绝。

## 接真实支付商

参照 `src/server/services/payments.ts` 的 `handleMockCallback`：验签 → 找到 Payment → `confirmPayment()`。发货逻辑无需改动。

## 支付：BEpusdt 网关（多链 USDT / USDC / 原生币）

只收加密货币，**不接支付宝 / 微信**。通过自托管的 [BEpusdt](https://github.com/v03413/BEpusdt) 监听链上到账：纯监听模式，服务器上只有你的**收款地址**，没有私钥；无需公司 / KYC。

支持的链见 src/server/lib/bepusdt.ts 的 BEPUSDT_TRADE_TYPES（Tron / BSC / Polygon / Ethereum / Arbitrum / Solana / TON / Aptos / X Layer / Plasma / Base 上的 USDT、USDC，以及 TRX / ETH / BNB / TON 原生币）。前台实际开放哪些由 BEPUSDT_TRADE_TYPES 环境变量决定，默认 8 种：usdt.trc20, usdt.bep20, usdt.polygon, usdt.erc20, usdt.ton, usdt.solana, usdc.trc20, tron.trx。

`
下单 → POST /api/orders/:id/pay {provider:"BEPUSDT", payType:"usdt.trc20"}
     → POST {gateway}/api/v1/order/create-transaction（fiat=USD，MD5 签名）
     → 拿到 收款地址 / 必须精确支付的加密货币金额(actual_amount) / 收银台链接；二维码由本站生成
用户付款 → 向该地址转账精确金额 → BEpusdt 扫链按「地址 + 金额」匹配
BEpusdt → POST /api/payments/bepusdt/notify（JSON，MD5 验签，status=2 成功 / 3 超时）→ confirmPayment → 发货
      回调失败会按退避重试最多 10 次；订单页每 5 秒刷新
`

- 金额匹配：同一地址同时有多笔待付时，BEpusdt 会把 ctual_amount 的小数位错开，所以页面反复强调「金额必须完全一致」。
- 换链：用户在订单页改选其他链时，旧支付记录作废并调 cancel-transaction 释放网关侧的金额占用；取消订单同理。
- 我方订单 15 分钟过期，网关侧有效期 = 剩余时间 + 15 分钟。**过期后才到账**的付款也会被确认：优先从可售库存重新补齐自动发货，补不齐则标记 PAID 并通知管理员补发。
- 回调走 confirmPayment()，幂等；重复回调返回 success；回调里的 lock_transaction_id 写入 payment.txHash。
- 用户转错金额 / 网络导致网关没匹配上：后台「支付确认」页列出待付 / 超时的网关单，你在区块浏览器核实到账后点「确认到账」（可附交易哈希）即可照常发货；「作废」会同时通知网关释放金额占用。

### 部署 BEpusdt（生产）

1. 服务器：`docker run -d --restart=unless-stopped -p 8080:8080 -v /opt/bepusdt:/var/lib/bepusdt v03413/bepusdt:latest`，反代到公网 HTTPS 域名。首次启动日志里会打印**后台账号 / 密码 / 安全入口 / 对接令牌**，只显示一次。
2. 后台 `https://pay.example.com/<安全入口>`：
   - 钱包：为每条要开放的链添加自己的收款地址（`usdt.trc20` 填 T 开头的 Tron 地址，EVM 链填 0x 地址，TON 填 `UQ` 开头的非弹回地址……）。没配钱包的链建单会失败，别写进 `BEPUSDT_TRADE_TYPES`。
   - 系统设置：配置 TronGrid API Key（TRC20 扫块稳定性），按需调汇率浮动。
3. 本站 `.env`：`BEPUSDT_GATEWAY` / `BEPUSDT_TOKEN` / `BEPUSDT_TRADE_TYPES`。`APP_URL` 必须是 BEpusdt 能访问到的公网 HTTPS 地址（回调发到 `{APP_URL}/api/payments/bepusdt/notify`）。

### 本地联调

`ash
docker run -d --name bepusdt-local -p 8080:8080 -v bepusdt-local-data:/var/lib/bepusdt v03413/bepusdt:latest
docker logs bepusdt-local            # 记下 账号 / 密码 / 安全入口 / 对接令牌
# 后台给要测的链加测试钱包地址（任意格式合法的地址即可），.env 填 BEPUSDT_GATEWAY=http://localhost:8080、BEPUSDT_TOKEN
# 容器里访问宿主机要用 host.docker.internal：.env 设 PAYMENT_NOTIFY_BASE_URL=http://host.docker.internal:3000
npm run dev
$env:BEPUSDT_ADMIN_USER="..."; $env:BEPUSDT_ADMIN_PASS="..."; $env:BEPUSDT_SECURE_PATH="..."
powershell -File scripts/bepusdt-smoke-test.ps1  # 下单→建单→换链→伪造回调验签/金额→后台标记已付触发真实回调→发货→取消释放→超时回调
`

不提供 `BEPUSDT_ADMIN_*` 时脚本跳过「后台标记已付」，改为自签正确回调验证发货链路。
## Telegram Bot 购买

与网站共用同一套 services 与数据库：Bot 里的用户 = `identities` 表的 TELEGRAM 身份（与网站 Telegram 登录 / 绑定是同一个账号），订单 `source = TELEGRAM`。

```
/start      主菜单（商品 / 我的订单 / 语言 / 打开网站）
/products   商品列表 → 商品详情（描述、规格、库存）→ 选规格 → 选数量（自动发货类）→ 逐项填写下单字段 → 确认
            → 创建订单 → 选链 / 币种（BEpusdt 多链；开发环境另有模拟支付）→ 付款指引
/orders     最近 10 笔订单 → 详情（发货内容 / 工单号 / 刷新状态 / 取消待支付订单）
/lang       切换语言（zh / en / ru / ar，首次按 Telegram 客户端语言）
/cancel     取消当前多步操作
/id         显示当前 chat id（店主用：填到 ADMIN_TELEGRAM_CHAT_IDS 接收后台通知）
```

- 深链 `https://t.me/<bot>?start=p_<productId>` 直达商品。
- 支付确认后、后台完成订单、客服回复工单时，会通过 Bot API 主动推送给用户（`src/server/lib/telegram.ts`），与邮件通知并行。
- 多步输入的草稿保存在进程内存，重启后用户重新点「购买」即可。

### 运行方式

```bash
# 本地开发：长轮询，不需要公网地址（会自动清除已设置的 webhook）
npm run bot

# 生产：把 webhook 指到 ${APP_URL}/api/telegram/webhook（APP_URL 必须是 HTTPS）
TELEGRAM_WEBHOOK_SECRET=<随机串>   # 可选，Telegram 回传时校验
npm run bot:webhook
npm run bot:webhook -- off          # 删除 webhook
```

`.env` 需要 `TELEGRAM_BOT_TOKEN`（@BotFather 获取）；网站的 Telegram 登录按钮还需要 `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`。
机器上若通过 `HTTP_PROXY` / `HTTPS_PROXY` 上网，Next 进程与 Bot 进程都会自动走代理（`src/server/lib/proxy.ts`，Node 原生 fetch 默认忽略这些变量）。

## 多语言

- 界面：`next-intl`，字典在 `messages/{zh,en,ru,ar}.json`，阿拉伯语自动 RTL（`<html dir>` + shadcn RTL + 逻辑属性）。
- 语言选择存 cookie（`locale`），不改 URL；首次访问按 `Accept-Language` 推断；已登录用户切换时同步到 `User.locale`。
- 商品内容：`Product.i18n` JSON `{ en: { name, description, faq }, ru, ar }`，`localizeProduct()` 按 目标语言 → en → 中文主字段 回退。后台新建商品可填「多语言内容」。
- 尚未本地化：API 返回的错误文案、邮件模板（仍为中文）。

## 商品规格与展示货币

- **规格**：`ProductVariant`（name / price / sortOrder / active），商品可有 0 或多个规格。有规格时价格、库存都按规格走（`InventoryItem.variantId`），订单记录 `variantId` + `variantName` 快照。规格有 i18n 字段（{ zh, en, ru, ar } → 显示名，缺省回退中立 
ame）。后台「商品」页可行内编辑规格（名称 / 价格 / 排序 / 各语言名 / 上下架 / 删除——有订单或库存的只能下架）、「库存」页按规格导入。示例：土耳其代充 = 5 / 10 / 20 / 30 / 40 USD。
- **展示货币**：所有价格与结算均为 USD。前台右上角可切换 12 种展示货币（USD / CNY / RUB / AED / SAR / TRY / EUR / IDR / THB / VND / PHP / MYR），存 cookie，默认按语言推断（中文→CNY、俄语→RUB、阿语→AED）。汇率来自 open.er-api.com，内存缓存 6 小时，失败回退静态表（`src/lib/currency.ts`）。非 USD 展示时附带 `≈ US$` 原价。支付时由 BEpusdt 按其汇率把 USD 折算成所选加密货币金额。

## 下一步（未实现）

- Discord Bot（照 Telegram Bot 的方式直接 import `src/server/services`）
- 库存 payload 加密存储
- 接入真实支付通道


测试账号
角色	邮箱	密码	说明
管理员	admin@example.com	Admin123456	登录后右上角进 后台 → /admin（订单 / 支付 / 工单 / 商品 / 库存）
买家	buyer1@test.local	Buyer123456	默认中文
买家	buyer2@test.local	Buyer123456	默认 English
买家	buyer3@test.local	Buyer123456	默认 Русский