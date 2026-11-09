import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 商品多语言内容（缺失语言回退到 en，再回退到中文主字段） */
const I18N: Record<string, object> = {
  "tr-blank-account": {
    en: {
      name: "Turkey Steam account (fresh)",
      description: "Brand-new registration, no games, change password and email freely. Delivered automatically after payment.\n\nDelivery format: login----password----email----emailPassword",
      faq: [
        { q: "What should I do first after receiving the account?", a: "Log in to Steam and change the password immediately, then switch the linked email to your own. The email and its password are included in the delivery so you can receive verification codes." },
        { q: "Can I enable Steam Guard (mobile authenticator)?", a: "Yes. After changing the email, bind it in the Steam mobile app like any normal account." },
        { q: "Can I top up the wallet with my local payment method?", a: "Not directly — the Turkish wallet needs Turkish payment channels. Use our Wallet Top-up service instead." },
        { q: "Can the account be recovered by someone else?", a: "The account is freshly registered with no prior bindings, so it's exclusively yours after delivery. Change the password and email promptly and nobody can reclaim it." },
      ],
    },
    ru: {
      name: "Аккаунт Steam Турция (новый)",
      description: "Свежая регистрация, без игр, можно сменить пароль и почту. Выдаётся автоматически после оплаты.\n\nФормат выдачи: логин----пароль----почта----парольПочты",
      faq: [
        { q: "Что сделать первым делом после получения?", a: "Сразу войдите в Steam, смените пароль и привяжите свою почту. Почта и пароль от неё есть в выдаче — коды подтверждения придут туда." },
        { q: "Можно включить Steam Guard?", a: "Да. После смены почты привяжите аккаунт в мобильном приложении Steam как обычно." },
        { q: "Можно пополнить кошелёк своим способом оплаты?", a: "Напрямую нет — турецкий кошелёк пополняется только турецкими способами. Воспользуйтесь нашей услугой пополнения." },
        { q: "Могут ли аккаунт вернуть?", a: "Аккаунт новый, без прежних привязок, после выдачи он только ваш. Смените пароль и почту — и вернуть его никто не сможет." },
      ],
    },
    ar: {
      name: "حساب Steam تركيا (جديد)",
      description: "تسجيل جديد تمامًا، بلا ألعاب، يمكنك تغيير كلمة المرور والبريد بحرية. يُسلَّم تلقائيًا بعد الدفع.\n\nصيغة التسليم: الحساب----كلمة المرور----البريد----كلمة مرور البريد",
      faq: [
        { q: "ما أول شيء أفعله بعد استلام الحساب؟", a: "سجّل الدخول إلى Steam وغيّر كلمة المرور فورًا، ثم بدّل البريد المرتبط إلى بريدك. البريد وكلمة مروره مرفقان في التسليم لاستقبال رموز التحقق." },
        { q: "هل يمكن تفعيل Steam Guard؟", a: "نعم. بعد تغيير البريد اربطه من تطبيق Steam على الهاتف كأي حساب عادي." },
        { q: "هل يمكن شحن المحفظة بوسيلة دفعي المحلية؟", a: "ليس مباشرة — محفظة تركيا تحتاج وسائل دفع تركية. استخدم خدمة شحن المحفظة لدينا." },
        { q: "هل يمكن لأحد استرجاع الحساب؟", a: "الحساب مسجّل حديثًا بلا أي ارتباطات سابقة، فهو ملكك وحدك بعد التسليم. غيّر كلمة المرور والبريد فورًا ولن يستطيع أحد استرجاعه." },
      ],
    },
  },
  "ar-blank-account": {
    en: {
      name: "Argentina Steam account (fresh)",
      description: "Brand-new registration, no games. Delivered automatically after payment.",
      faq: [
        { q: "Argentina or Turkey — which should I pick?", a: "Both are very cheap. Some AAA titles are region-locked in Argentina; Turkey is generally more stable. Prefer Turkey if you mainly play big releases." },
        { q: "Which currency does the Argentina wallet use?", a: "Argentine peso (ARS). It can only be funded through local channels — pair it with our top-up service." },
      ],
    },
    ru: { name: "Аккаунт Steam Аргентина (новый)", description: "Свежая регистрация, без игр. Выдаётся автоматически после оплаты." },
    ar: { name: "حساب Steam الأرجنتين (جديد)", description: "تسجيل جديد تمامًا، بلا ألعاب. يُسلَّم تلقائيًا بعد الدفع." },
  },
  "topup-tr": {
    en: {
      name: "Turkey wallet top-up",
      description: "Top up a Turkey-region wallet by USD face value (credited as the equivalent in lira). Credited within 10 minutes to 2 hours after payment. Enter your Steam login name exactly.",
      faq: [
        { q: "What do 5 / 10 / 20 USD buy?", a: "Turkey pricing is very low — 10 USD usually covers a mid-priced indie title; 20–40 USD covers most discounted AAA games. Check the store's current prices." },
        { q: "Is it credited in USD or lira?", a: "In Turkish lira, converted at the day's rate. Face values are shown in USD for easy comparison." },
      ],
    },
    ru: { name: "Пополнение кошелька Турция", description: "Зачисление через 10 минут – 2 часа после оплаты. Укажите точный логин Steam." },
    ar: { name: "شحن محفظة تركيا", description: "يُضاف خلال 10 دقائق إلى ساعتين بعد الدفع. أدخل اسم دخول Steam بدقة." },
  },
  "region-change-to-ar": {
    en: {
      name: "Region change to Argentina",
      description: "Requires your login, password and email verification code; takes about 30 minutes.",
      faq: [
        { q: "Which currency after switching to Argentina?", a: "Argentine peso (ARS). The store then uses Argentina pricing; the wallet needs local payment methods — our top-up service covers that." },
        { q: "Are games region-locked in Argentina?", a: "Some AAA titles aren't sold or can't be activated there. If you have a specific game in mind, ask us before ordering." },
      ],
    },
    ru: { name: "Смена региона на Аргентину", description: "Нужны логин, пароль и код из почты; занимает около 30 минут." },
    ar: { name: "تغيير المنطقة إلى الأرجنتين", description: "يتطلب اسم الدخول وكلمة المرور ورمز تحقق البريد؛ يستغرق نحو 30 دقيقة." },
  },
};

async function main() {
  const products = [
    {
      slug: "tr-blank-account",
      type: "ACCOUNT" as const,
      deliveryMode: "AUTO_INVENTORY" as const,
      region: "TR",
      name: "土耳其区 Steam 空白账号",
      description: "全新注册，无游戏，可自行改密改邮箱。付款后自动发货。\n\n发货格式：账号----密码----邮箱----邮箱密码",
      price: "3.50",
      sortOrder: 1,
      faq: [
        { q: "收到账号后第一件事做什么？", a: "立即登录 Steam 修改密码，然后把绑定邮箱换成你自己的。邮箱和邮箱密码都在发货内容里，可以直接登录邮箱收验证码。" },
        { q: "能开启 Steam 令牌（手机验证）吗？", a: "可以。换绑邮箱后在手机 Steam App 里绑定即可，和普通账号没有区别。" },
        { q: "买了土耳其区账号，能用国内支付方式充钱包吗？", a: "不能直接用。土耳其区钱包需要土耳其本地支付渠道，建议购买我们的「钱包代充」服务。" },
        { q: "账号会不会被找回？", a: "账号为全新注册、无任何历史绑定，发货后由你独占。只要及时改密换邮，不存在被找回的情况。" },
      ],
    },
    {
      slug: "ar-blank-account",
      type: "ACCOUNT" as const,
      deliveryMode: "AUTO_INVENTORY" as const,
      region: "AR",
      name: "阿根廷区 Steam 空白账号",
      description: "全新注册，无游戏。付款后自动发货。",
      price: "3.00",
      sortOrder: 2,
      faq: [
        { q: "阿根廷区和土耳其区选哪个？", a: "两区价格都很低。阿根廷区部分大作有锁区限制，土耳其区相对更稳定；若主要玩 3A 大作，优先土耳其区。" },
        { q: "阿根廷区钱包用什么货币？", a: "阿根廷比索（ARS）。钱包同样只能用当地渠道充值，可搭配我们的代充服务。" },
      ],
    },
    {
      slug: "topup-tr",
      type: "TOPUP" as const,
      deliveryMode: "MANUAL_TICKET" as const,
      region: "TR",
      name: "土耳其区钱包代充",
      description: "按美元面额充入土耳其区钱包（到账为等值里拉）。付款后 10 分钟至 2 小时内到账，请准确填写 Steam 登录名。",
      price: "4.20",
      faq: [
        { q: "5 / 10 / 20 美元分别能买什么？", a: "土耳其区定价很低，10 美元通常够买一款中等价位的独立游戏，20–40 美元可覆盖大部分打折 3A。具体以商店当日价格为准。" },
        { q: "到账是美元还是里拉？", a: "到账为等值土耳其里拉，按充值当天汇率折算；面额以美元标注方便比价。" },
      ],
      inputSchema: [
        { key: "steam_login", label: "Steam 登录名", required: true },
        { key: "note", label: "备注（可选）" },
      ],
      sortOrder: 10,
    },
    {
      slug: "region-change-to-ar",
      type: "REGION_CHANGE" as const,
      deliveryMode: "MANUAL_TICKET" as const,
      region: "AR",
      name: "改区至阿根廷区",
      description: "需提供账号与密码及邮箱验证码配合，全程约 30 分钟。",
      price: "6.00",
      faq: [
        { q: "改到阿根廷区后用什么货币结算？", a: "阿根廷比索（ARS）。改区后商店按阿根廷区定价，钱包需用当地渠道充值，可搭配代充服务。" },
        { q: "阿根廷区有游戏锁区吗？", a: "部分大作在阿根廷区不售卖或限制激活。如果你有特定想买的游戏，下单前可先咨询我们确认。" },
      ],
      inputSchema: [
        { key: "steam_login", label: "Steam 登录名", required: true },
        { key: "contact", label: "联系方式（TG / Discord）", required: true },
      ],
      sortOrder: 20,
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({ where: { slug: p.slug }, update: { name: p.name, faq: p.faq, description: p.description, i18n: I18N[p.slug] ?? undefined }, create: { ...p, i18n: I18N[p.slug] ?? undefined } });
    if (p.deliveryMode === "AUTO_INVENTORY") {
      const existing = await prisma.inventoryItem.count({ where: { productId: product.id } });
      if (existing === 0) {
        await prisma.inventoryItem.createMany({
          data: Array.from({ length: 5 }, (_, i) => ({
            productId: product.id,
            payload: `${p.region.toLowerCase()}_demo_user${i + 1}----DemoPass${i + 1}!----demo${i + 1}@example.com----MailPass${i + 1}`,
          })),
        });
      }
    }
  }
  // 代充商品规格：5 / 10 / 20 / 30 / 40 USD 面额，售价含服务费
  const topup = await prisma.product.findUnique({ where: { slug: "topup-tr" } });
  if (topup) {
    const variants = [
      ["5 USD", "5.60", 1],
      ["10 USD", "10.90", 2],
      ["20 USD", "21.50", 3],
      ["30 USD", "32.00", 4],
      ["40 USD", "42.40", 5],
    ] as const;
    for (const [name, price, sortOrder] of variants) {
      const n = name.split(" ")[0];
      const i18n = { zh: `${n} 美元`, en: `${n} USD`, ru: `${n} долл.`, ar: `${n} دولار` };
      const exists = await prisma.productVariant.findFirst({ where: { productId: topup.id, name } });
      if (!exists) await prisma.productVariant.create({ data: { productId: topup.id, name, price, sortOrder, i18n } });
      else await prisma.productVariant.update({ where: { id: exists.id }, data: { i18n } });
    }
  }
  console.log("seed done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
