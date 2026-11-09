# v0.dev 提示词（静态界面）

使用方法：每次向 v0 提问时，先贴 **「公共上下文」**，再贴其中一个 **「批次」**。三个批次分三次提问，避免单次输出过长导致质量下降。
生成结果只要静态页面 + mock 数据；接入时把 `<form>` 换成项目里的 `<ApiForm action=...>`，字段 `name` 已对齐 API，无需改动。

---

## 公共上下文（每次都贴）

```
You are building the STATIC UI (no data fetching, no server actions, no auth logic) for "Steam Store" — a shop selling Steam accounts by region, Steam wallet top-ups, and region-change services. Customers are in China, Russia, the Middle East and Southeast Asia and mostly arrive from Telegram/Discord on mobile.

TECH CONSTRAINTS
- Next.js App Router + TypeScript + Tailwind CSS v4 + shadcn/ui + lucide-react. No other UI libs.
- Static only: all data comes from `lib/mock.ts`. No fetch, no server actions, no auth, no middleware, no `cacheComponents`.
- Forms must be plain `<form>` elements. Every input MUST have the exact `name` attribute I specify — I will swap the form element for my own `<ApiForm>` wrapper later. Do not add onSubmit handlers.
- Mobile-first. Must look good at 375px and 1280px.
- Every user-visible string must come from a single dictionary `lib/i18n/zh.ts` (keys like `t.nav.products`). UI copy is Simplified Chinese for now; I will add en/ru/ar later. Layouts must be RTL-safe: use flex/grid with logical spacing (`ms-`/`me-`/`ps-`/`pe-`, `start`/`end`), never hard-code left/right.
- Put shared pieces in `components/`: `StatusBadge`, `MoneyText`, `EmptyState`, `PageHeader`, `CopyButton`, `CountdownText`, `QrBlock`.

VISUAL DIRECTION
- Dark theme only. Deep navy/charcoal background (#0b0f14 → #141b24 cards), subtle 1px borders (white/8%), one accent color (electric blue #4fb3ff) used sparingly for primary buttons/links, green for success, amber for pending, red for danger. Generous radius (rounded-xl), soft shadows, no gradients heavier than a faint top glow.
- Steam-like "digital goods" feel: compact cards, monospace for order numbers / credentials / wallet addresses, region shown as a small pill (TR, AR, RU, CN, US, GLOBAL).
- Typography: system font stack; headings semibold; body 14px; muted text #8b98a8.

DOMAIN MODEL & LABELS (mirror exactly)
Product { id, slug, type: "ACCOUNT"|"TOPUP"|"REGION_CHANGE", deliveryMode: "AUTO_INVENTORY"|"MANUAL_TICKET", region: string, name, description?, price: string, currency: "USD", stock: number|null (null = manual service, unlimited), inputSchema?: {key,label,required?,placeholder?}[] }
Order { id, orderNo "SO2026…", productName, productType, region, quantity, amount: string, currency, status, source: "WEB"|"TELEGRAM"|"DISCORD", customerInput?: Record<string,string>, deliveryPayload?: string (multi-line credentials), expiresAt, paidAt?, deliveredAt?, createdAt, payments: Payment[], tickets: {id,ticketNo,type,status}[] }
Payment { id, provider: "BEPUSDT"|"MOCK", status, amount, currency, txHash?, createdAt, meta?: { payType: "usdt.trc20"|"usdt.bep20"|..., label: "USDT · TRC20", network, payUrl, qrcode (data url), address, payCurrency: "USDT"|"USDC"|"TRX", payAmount, uniqueAmount (the EXACT amount the user must pay), rate?, expiredAt? } }
Ticket { id, ticketNo "TK…", type: "PRESALE"|"TOPUP"|"REGION_CHANGE"|"SUPPORT", status, subject, orderNo?, createdAt, updatedAt, messages: { id, isStaff: boolean, authorId: string|null (null = system), body, createdAt }[] }
Identity { provider: "EMAIL"|"TELEGRAM"|"DISCORD", providerUid, displayName?, createdAt }

Status labels & colors:
Order: PENDING 待支付(amber) PAID 已支付(blue) PROCESSING 处理中(blue) DELIVERED 已完成(green) EXPIRED 已过期(gray) CANCELLED 已取消(gray) REFUNDED 已退款(red)
Payment: PENDING 待支付(amber) CONFIRMED 已确认(green) FAILED 失败(red) EXPIRED 已过期(gray)
Ticket: OPEN 待处理(amber) IN_PROGRESS 处理中(blue) WAITING_USER 等待用户(purple) RESOLVED 已解决(green) CLOSED 已关闭(gray)
Types: ACCOUNT 账号, TOPUP 代充, REGION_CHANGE 改区, PRESALE 售前咨询, SUPPORT 售后; providers: BEPUSDT 链上支付, MOCK 模拟支付

Provide realistic mock data: 2 ACCOUNT products (TR stock 3, AR stock 0), 1 TOPUP (inputSchema: steam_login required, note optional), 1 REGION_CHANGE (steam_login required, contact required); orders in every status; a ticket with system + user + staff messages.
```

---

## 批次 1：店面 + 账号（公共页面）

```
Build these routes under `app/(shop)/` sharing one layout.

LAYOUT `app/(shop)/layout.tsx`
- Sticky top nav: logo text "Steam Store" (link /), links 商品 (/), 售前咨询 (/tickets/new). Right side: when logged out → 登录 (ghost) + 注册 (primary); when logged in → 我的订单, 我的工单, 账号, optional 后台 (accent, admins only), 退出 (plain button inside <form> with no inputs). Render both states via a `loggedIn` boolean in mock. Mobile: collapse into a sheet/drawer.
- Language switcher placeholder (globe icon, dropdown with 中文 / English / Русский / العربية, non-functional).
- Footer: © year + site name, small links 帮助 / Telegram / Discord.

PAGE `/` (home)
- Optional slim hero: one line value prop + two chips "自动发货" "USDT 多链".
- Products grouped by type with section headings 账号 / 代充 / 改区. Card: region pill top-left, stock indicator top-right (green "库存 3", red "缺货", or hidden when stock is null), name, 2-line clamped description, price large in accent. Entire card is a link to /products/[slug]. Grid 1/2/3 columns.
- Empty state component when no products.

PAGE `/products/[slug]`
- Back link ← 返回商品列表. Card with pills (type, region), name, full description (preserve line breaks), price, stock line.
- Divider, then ONE of three states (render all three in mock via a `state` switch and show them stacked under headings for review): 
  a) not logged in: text with link "请先 登录 后购买"
  b) out of stock: muted text + link 咨询客服
  c) buy form `<form>`: if deliveryMode AUTO_INVENTORY show number input name="quantity" (min 1, max stock, default 1, width ~8rem); then one text input per inputSchema field with name={field.key}, label, required asterisk, placeholder; primary full-width button 立即下单; helper text "下单后 15 分钟内完成支付，超时自动取消".

PAGE `/login`
- Centered card max-w-sm. Form: email (name="email"), password (name="password"), primary button 登录; row with links 注册账号 / 忘记密码.
- Divider "或", then a Telegram login button placeholder (rounded blue button with Telegram icon "使用 Telegram 登录").

PAGE `/register`
- Form: email (name="email"); verification code row: input name="code" (6 digits, inputMode numeric) + ghost button 发送验证码 that shows a 60s countdown state (static variants: idle and "58s" disabled); password name="password" (min 8, helper "至少 8 位"); primary 注册; link 已有账号？登录.

PAGE `/forgot-password`
- Same pattern: email, code + send button, new password (name="password"), primary 重置并返回登录.

PAGE `/account`
- Header 我的账号.
- Card 已绑定的登录方式: list rows — provider pill (邮箱/Telegram/Discord), displayName or providerUid (monospace for ids), bound date on the end. Footer line 余额 0.00 USD · 角色 USER.
- Card 绑定邮箱 (shown when no EMAIL identity): helper text explaining merge ("若该邮箱已有账号，验证通过后两个账号的订单会自动合并"); form: email name="email", code name="code" + 发送验证码 button, optional password name="password" labeled 设置密码（可选，用于邮箱登录）; button 绑定.
- Card 绑定 Telegram (shown when no TELEGRAM identity): helper text + Telegram button placeholder.
Render account page twice in mock: email-only user and telegram-only user.
```

---

## 批次 2：订单 + 支付 + 工单（用户侧）

```
Build these routes under the same `app/(shop)/` layout from before (recreate a minimal nav if needed).

PAGE `/orders`
- Header 我的订单. List of order rows (whole row is a link): left — product name, muted line "{orderNo} · {date} · x{quantity}" (orderNo monospace); right — amount bold + StatusBadge. Empty state with link 去逛逛.

PAGE `/orders/[id]` — the most important page, build carefully.
- Back link ← 我的订单.
- Summary card: name, muted meta "{orderNo} · {type} · {region} · x{qty}", 下单时间; right: amount large + StatusBadge. If customerInput exists: boxed <pre> "您提交的信息" with key: value lines.
- PAYMENT CARD (only when status PENDING). Title 支付, helper "请在 {expiresAt} 前完成支付，超时库存将释放" with a CountdownText (mm:ss). Three sub-states, render each in mock:
  1) Method picker: one card per chain (USDT · TRC20 / BEP20 / Polygon / ERC20 / TON / Solana, USDC · TRC20, TRX); ghost button 模拟支付（测试）.
  2) Gateway pending (on-chain): horizontal on desktop / stacked on mobile — QrBlock (176px square white-padded image from payment.meta.qrcode, encodes the address) + details: 请精确支付 followed by uniqueAmount in red, 3xl, mono + payCurrency (e.g. "3.5 USDT"), address row with copy button, warning alert "金额必须与上方完全一致（包括小数）" / "请使用 {network} 网络转账", muted "订单 3.50 USD · 1 USD ≈ 1.0000 USDT", outline small buttons 打开收银台 / 复制付款链接. Below: muted note "付款后页面会自动更新…", then a row of ghost small buttons 改用USDT · BEP20 / 改用USDT · Polygon … for the other chains.
  3) USDT pending: same layout but shows address in monospace accent with CopyButton, QR of the address, uniqueAmount like "3.500023 USDT", network pill "TRC20", warning about exact amount.
  Footer of payment card: border-top, tiny muted button 取消订单 inside a <form> (no inputs).
- DELIVERED block (when deliveryPayload): card with green border tint, title 发货内容, <pre> monospace content in a dark box with a CopyButton, note "请尽快修改密码并更换绑定邮箱。"
- PROCESSING block: card 处理进度 with text + links to tickets by ticketNo.
- 支付记录 card: rows — "{provider label} · {amount currency}", optional txHash truncated monospace, date + StatusBadge on the end.
- Bottom centered muted line "订单有问题？ 提交售后工单" (link).
Render mock variants: PENDING(method picker), PENDING(usdt), PROCESSING, DELIVERED, EXPIRED.

PAGE `/tickets`
- Header row: 我的工单 + primary button 新建工单. Rows (link): subject, muted "{ticketNo} · {type} · 订单 {orderNo} · 更新于 {date}", StatusBadge on the end. Empty state.

PAGE `/tickets/new`
- Title 售前咨询 (or 售后工单 when an orderId is present — show both variants). Helper "提交后我们会收到邮件通知，回复会显示在工单里并通过邮件告知您。"
- Form: input name="subject" (placeholder 例如：土耳其区账号能改密码吗？), textarea name="body" rows 6, primary full-width 提交. Logged-out variant: centered text with 登录 / 注册 links.

PAGE `/tickets/[id]`
- Back link. Header card: subject, muted "{ticketNo} · {type} · 订单 {orderNo}(link)", StatusBadge.
- Message thread: system messages (authorId null) as full-width muted boxes; user messages aligned start in card color; staff messages aligned end with accent/10 background. Each has tiny header "客服 / 我 / 系统 · date" and preserves line breaks.
- Reply form (hidden when CLOSED → show muted "工单已关闭。"): textarea name="body" rows 4 placeholder 输入回复…, primary 发送.
```

---

## 批次 3：后台管理

```
Build an admin area under `app/admin/` with its own layout (NOT the shop nav).

LAYOUT
- Left sidebar 12rem on desktop (collapsible icon rail on mobile / top bar with sheet): link ← 返回前台, then nav items with lucide icons: 概览 /admin, 订单 /admin/orders, 支付确认 /admin/payments, 工单 /admin/tickets, 商品 /admin/products, 库存 /admin/inventory. Active item highlighted. Main content padded, max-w-5xl.

PAGE `/admin` (概览)
- Title 概览. 5 stat cards (link each): 待支付订单, 待处理订单, USDT 待确认, 待回复工单, 可售库存 — label muted, number 3xl semibold. Grid 1/2/3.

PAGE `/admin/orders`
- Title 订单. Filter chips row: 全部 + one chip per order status (active chip = accent bg, black text; others white/10). 
- Order cards (dense): top row — product name + "x{qty}" muted; muted lines "{orderNo} · {date} · {source label}", "用户：{email} · TG {tgId}"; optional <pre> customerInput box; optional "工单：TK… (links)". Right column: amount bold + StatusBadge.
- When status PAID or PROCESSING: action row under a divider — inline `<form>` with input name="deliveryPayload" (label 完成备注 / 补发内容（可选，会邮件发给用户）) + primary button 标记完成; separate `<form>` with danger button 退款.
- When deliveryPayload exists: <pre> in green text.

PAGE `/admin/payments`
- Title 支付确认, helper text. Rows: "{provider} · {amount}", muted "订单 {orderNo} · {date}", optional "TX: {hash}" as external link (monospace, break-all). End: StatusBadge + (when SUBMITTED) primary 确认 and ghost 拒绝 buttons, each in its own empty <form>. Empty state 没有待处理的支付。

PAGE `/admin/tickets`
- Title 工单. Filter chips: 未关闭 + each ticket status. Rows (link): subject, muted "{ticketNo} · {type} · {email} · 订单 {orderNo} · {date}", StatusBadge.

PAGE `/admin/tickets/[id]`
- Back link. Header card: subject, meta "{ticketNo} · {type} · 创建于 {date}", "用户：{email} · TG {name}", StatusBadge. If linked order: nested dark box with "订单 {orderNo} · {product} · {amount} · StatusBadge", optional <pre> customerInput, and (when order PAID/PROCESSING) inline form input name="deliveryPayload" + primary 订单完成.
- Message thread identical styling to the user ticket page but labels 客服 / 用户 / 系统.
- Reply card: textarea name="body" placeholder "回复内容（会邮件通知用户）；留空则只改状态"; row with <select name="status"> options: "" → 发送后自动置为「等待用户」, then OPEN/IN_PROGRESS/WAITING_USER/RESOLVED/CLOSED with Chinese labels; primary 发送.

PAGE `/admin/products`
- Title 商品. List rows: name + "/slug" muted monospace; muted "{type} · {region} · 自动发货|人工处理 · 库存 N"; end: price bold + toggle button 下架 (ghost) / 上架 (primary) inside empty <form>.
- Card 新增商品, 2-column form grid: name="name" 名称; name="slug" slug（URL 标识）pattern [a-z0-9-]+; <select name="type"> 账号（自动发货）/ 代充（人工）/ 改区（人工）; name="region" 区域 (placeholder TR / AR / RU / CN / US); name="price" number step 0.01; name="currency" default USD; textarea name="description" (span 2); textarea name="inputSchema" monospace (span 2) placeholder '[{"key":"steam_login","label":"Steam 登录名","required":true}]'; name="sortOrder" number; primary 创建.

PAGE `/admin/inventory`
- Title 库存. Table: 商品 | 可售(green) | 锁定中(amber) | 已售(muted), only AUTO_INVENTORY products.
- Card 导入库存: helper "每行一条，内容原样发给买家，建议格式：账号----密码----邮箱----邮箱密码"; <select name="productId"> of products; textarea name="lines" rows 8 monospace; primary 导入. Empty state if no auto products.
```
