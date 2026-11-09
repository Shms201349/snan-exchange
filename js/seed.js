// بيانات تجريبية للوضع المحلي فقط
import { DEFAULT_SITE, DEFAULT_DISCOUNT } from './defaults.js';

const G = [
  ['EA SPORTS FC 25', 'PS4/PS5', 'ar', 'available', '45 GB', 'أحدث نسخة من سلسلة كرة القدم الأشهر بالتعليق العربي، مع أوضاع Ultimate Team والمهنة وأندية العالم.', 46, 3, 0],
  ["Marvel's Spider-Man 2", 'PS5', 'ar', 'available', '98 GB', 'بيتر باركر ومايلز موراليس معاً في نيويورك أكبر، في مواجهة فينوم وكرافن.', 39, 1, 0],
  ['God of War Ragnarök', 'PS4/PS5', 'ar', 'available', '90 GB', 'كريتوس وأتريوس في رحلة عبر العوالم التسعة قبل نهاية العالم الإسكندنافي.', 44, 2, 0],
  ['Grand Theft Auto V', 'PS4/PS5', 'en', 'available', '95 GB', 'مدينة لوس سانتوس المفتوحة مع ثلاث شخصيات وقصة مليئة بالإثارة.', 52, 4, 0],
  ['Call of Duty: Modern Warfare III', 'PS4/PS5', 'ar', 'available', '149 GB', 'حملة قصصية وأطوار لعب جماعي وزومبي.', 31, 6, 0],
  ['Minecraft Dungeons', 'PS4', 'en', 'available', '6 GB', 'مغامرة أكشن في عالم ماين كرافت — العب لوحدك أو مع أصحابك حتى 4 لاعبين.', 27, 2, 0],
  ['Tekken 8', 'PS5', 'ar', 'available', '100 GB', 'أقوى ألعاب القتال بشخصيات جديدة ونظام Heat.', 22, 1, 0],
  ['The Last of Us Part II', 'PS4', 'ar', 'available', '78 GB', 'قصة إيلي المؤثرة في عالم ما بعد الكارثة.', 35, 2, 0],
  ["Uncharted 4: A Thief's End", 'PS4', 'ar', 'unavailable', '60 GB', 'آخر مغامرات نيثان دريك بحثاً عن كنز القراصنة.', 18, 0, 3],
  ['Red Dead Redemption 2', 'PS4', 'en', 'available', '105 GB', 'ملحمة الغرب الأمريكي مع آرثر مورغان وعصابة فان دير ليند.', 41, 1, 0],
  ['Ghost of Tsushima', 'PS4/PS5', 'ar', 'available', '50 GB', 'الساموراي جين ساكاي يدافع عن جزيرة تسوشيما.', 29, 1, 0],
  ['Elden Ring', 'PS4/PS5', 'en', 'unavailable', '60 GB', 'عالم مفتوح مظلم من صانعي Dark Souls.', 24, 2, 5],
  ['Resident Evil 4', 'PS4/PS5', 'ar', 'available', '67 GB', 'ليون كينيدي في مهمة إنقاذ ابنة الرئيس — نسخة الريميك.', 20, 1, 0],
  ["Assassin's Creed Mirage", 'PS4/PS5', 'ar', 'available', '40 GB', 'باسم في بغداد العباسية — عودة لجذور السلسلة.', 26, 2, 0],
  ['Mortal Kombat 1', 'PS5', 'ar', 'unavailable', '100 GB', 'بداية جديدة لعالم مورتال كومبات.', 12, 1, 2],
  ['Need for Speed Unbound', 'PS5', 'ar', 'available', '35 GB', 'سباقات الشوارع في ليكشور سيتي بأسلوب فني جديد.', 15, 0, 0],
  ['Hogwarts Legacy', 'PS4/PS5', 'en', 'available', '85 GB', 'عِش حياة طالب في هوغوورتس في القرن التاسع عشر.', 19, 1, 0],
  ['Black Myth: Wukong', 'PS5', 'en', 'unavailable', '130 GB', 'مغامرة أكشن مستوحاة من رحلة إلى الغرب.', 17, 0, 7],
];

const P = [
  ['بلايستيشن 5 سليم — جديد', 'أجهزة', 'new', true, 650000, 'جهاز PS5 Slim بنسخة الأقراص، كرتون مختوم.', true],
  ['بلايستيشن 4 برو — مستعمل نظيف', 'أجهزة', 'used', true, 280000, 'PS4 Pro 1TB نظيف جداً مع يد أصلية، ويمكن تهكيره حسب الإصدار.', true],
  ['يد DualSense وكالة', 'يدات', 'new', true, 75000, 'يد PS5 أصلية وكالة بألوان متعددة.', true],
  ['يد DualShock 4 وكالة', 'يدات', 'new', true, 45000, 'يد PS4 أصلية وكالة.', true],
  ['سماعة Pulse 3D', 'سماعات', 'new', false, 95000, 'سماعة لاسلكية بصوت ثلاثي الأبعاد.', false],
  ['شاحن يدات مزدوج', 'إكسسوارات', 'new', true, 12000, 'قاعدة شحن ليدين في نفس الوقت.', true],
];

export function SEED() {
  const now = Date.now();
  const games = G.map(([title, platform, language, status, size, description, likes, dislikes, requests], i) => ({
    id: `g${i + 1}`,
    title, platform, language, status, size, description, likes, dislikes, requests,
    price: 1500, cover: `assets/demo/g${i + 1}-cover.webp`, screenshots: [0, 1, 2].map((k) => `assets/demo/g${i + 1}-s${k}.webp`),
    created_at: new Date(now - i * 36e5 * 7).toISOString(),
  }));
  const products = P.map(([name, category, condition, delivery, price, description, in_stock], i) => ({
    id: `p${i + 1}`,
    name, category, condition, delivery, price, description, in_stock,
    warranty: condition === 'new' ? 'ضمان 3 أشهر ضد أي خلل مصنعي' : 'ضمان شهر ضد أي خلل مصنعي',
    images: [],
    created_at: new Date(now - i * 36e5 * 11).toISOString(),
  }));
  const banners = ['g2', 'g1', 'g3', 'g5', 'g4'].map((gid, i) => {
    const g = games.find((x) => x.id === gid);
    return { id: `b${i + 1}`, image: '', title: g.title, subtitle: g.description, link_type: 'game', link_id: gid, sort: i, created_at: new Date(now - i * 1000).toISOString() };
  });
  return {
    games, products, banners,
    notifications: [],
    settings: [
      { key: 'site', value: DEFAULT_SITE },
      { key: 'discount', value: DEFAULT_DISCOUNT },
      { key: 'admin_password', value: 'admin123' },
    ],
    coupons: [{ code: 'JAAFAR10', percent: 10, active: true, max_uses: null, uses: 0, expires_at: null, created_at: new Date().toISOString() }],
    orders: [],
    game_requests: [],
    game_votes: [],
    game_sources: [],
    custom_requests: [],
    custom_request_devices: [],
    sync_queue: [],
    _order_no: 1000,
  };
}
