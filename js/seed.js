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

const CATALOG = [{"id": "c1", "title": "Horizon Forbidden West Complete Edition", "platform": "PS4/PS5", "cover": "assets/demo/c1-cover.webp", "screenshots": ["assets/demo/c1-s0.webp", "assets/demo/c1-s1.webp"], "description": "Experience the epic Horizon Forbidden West™ in its entirety with bonus content and the Burning Shores expansion included. The Burning Shores add-on contains additional content for Aloy’s adventure, including new storylines, characters, and experiences in a stunning yet hazardous new area."}, {"id": "c2", "title": "DEATH STRANDING DIRECTOR'S CUT", "platform": "PS4/PS5", "cover": "assets/demo/c2-cover.webp", "screenshots": ["assets/demo/c2-s0.webp", "assets/demo/c2-s1.webp"], "description": "From legendary game creator Hideo Kojima comes a genre-defying experience, now expanded in this definitive DIRECTOR’S CUT. As Sam Bridges, your mission is to deliver hope to humanity by connecting the last survivors of a decimated America. Can you reunite the shattered world, one step at a time?"}, {"id": "c3", "title": "Days Gone", "platform": "PS4", "cover": "assets/demo/c3-cover.webp", "screenshots": ["assets/demo/c3-s0.webp", "assets/demo/c3-s1.webp"], "description": "Ride and fight into a deadly, post pandemic America. Play as Deacon St. John, a drifter and bounty hunter who rides the broken road, fighting to survive while searching for a reason to live in this open-world action-adventure game."}, {"id": "c4", "title": "Ratchet & Clank: Rift Apart", "platform": "PS5", "cover": "assets/demo/c4-cover.webp", "screenshots": ["assets/demo/c4-s0.webp", "assets/demo/c4-s1.webp"], "description": "Blast your way through an interdimensional adventure with Ratchet and Clank – now on PC! Help them take on an evil emperor from another reality as you jump between action-packed worlds and beyond at hyper-speed!"}, {"id": "c5", "title": "FINAL FANTASY VII REBIRTH", "platform": "PS5", "cover": "assets/demo/c5-cover.webp", "screenshots": ["assets/demo/c5-s0.webp", "assets/demo/c5-s1.webp"], "description": "The Unknown Journey Continues... After escaping the city of Midgar, Cloud and his friends set out on a journey across the planet. New adventures await in a vibrant, expansive world in this standalone entry of the FFVII remake trilogy."}, {"id": "c6", "title": "Street Fighter 6", "platform": "PS4/PS5", "cover": "assets/demo/c6-cover.webp", "screenshots": ["assets/demo/c6-s0.webp", "assets/demo/c6-s1.webp"], "description": "Here comes Capcom’s newest challenger! Street Fighter™ 6 launches worldwide on June 2nd, 2023 and represents the next evolution of the Street Fighter™ series! Street Fighter 6 spans three distinct game modes, including World Tour, Fighting Ground and Battle Hub."}, {"id": "c7", "title": "Cyberpunk 2077", "platform": "PS5", "cover": "assets/demo/c7-cover.webp", "screenshots": ["assets/demo/c7-s0.webp", "assets/demo/c7-s1.webp"], "description": "Cyberpunk 2077 is an open-world, action-adventure RPG set in the dark future of Night City — a dangerous megalopolis obsessed with power, glamor, and ceaseless body modification."}, {"id": "c8", "title": "SILENT HILL 2", "platform": "PS5", "cover": "assets/demo/c8-cover.webp", "screenshots": ["assets/demo/c8-s0.webp", "assets/demo/c8-s1.webp"], "description": "Investigating a letter from his late wife, James returns to where they made so many memories - Silent Hill. What he finds is a ghost town, prowled by disturbing monsters and cloaked in deep fog. Confront the monsters, solve puzzles, and search for traces of your wife in this remake of SILENT HILL 2."}, {"id": "c9", "title": "It Takes Two", "platform": "PS4/PS5", "cover": "assets/demo/c9-cover.webp", "screenshots": ["assets/demo/c9-s0.webp", "assets/demo/c9-s1.webp"], "description": "Embark on the craziest journey of your life in It Takes Two. Invite a friend to join for free with Friend’s Pass and work together across a huge variety of gleefully disruptive gameplay challenges. Winner of GAME OF THE YEAR at the Game Awards 2021."}, {"id": "c10", "title": "Split Fiction", "platform": "PS5", "cover": "assets/demo/c10-cover.webp", "screenshots": ["assets/demo/c10-s0.webp", "assets/demo/c10-s1.webp"], "description": "Embrace mind-blowing moments as you’re pulled deep into the many worlds of Split Fiction, a boundary-pushing co-op adventure."}, {"id": "c11", "title": "Monster Hunter Wilds", "platform": "PS5", "cover": "assets/demo/c11-cover.webp", "screenshots": ["assets/demo/c11-s0.webp", "assets/demo/c11-s1.webp"], "description": "The unbridled force of nature runs wild and relentless, with environments transforming drastically from one moment to the next. This is a story of monsters and humans and their struggles to live in harmony in a world of duality."}, {"id": "c12", "title": "Dying Light 2 Stay Human: Reloaded Edition", "platform": "PS4/PS5", "cover": "assets/demo/c12-cover.webp", "screenshots": ["assets/demo/c12-s0.webp", "assets/demo/c12-s1.webp"], "description": "Humanity is fighting a losing battle against the virus. Experience a post-apocalyptic open world overrun by hordes of zombies, where your parkour and combat skills are key to survival. Traverse the City freely during the day, but watch the monsters take over during the night."}, {"id": "c13", "title": "Sekiro: Shadows Die Twice - GOTY Edition", "platform": "PS4", "cover": "assets/demo/c13-cover.webp", "screenshots": ["assets/demo/c13-s0.webp", "assets/demo/c13-s1.webp"], "description": "Game of the Year - The Game Awards 2019 Best Action Game of 2019 - IGN Carve your own clever path to vengeance in the award winning adventure from developer FromSoftware, creators of Bloodborne and the Dark Souls series. Take Revenge. Restore Your Honor. Kill Ingeniously."}, {"id": "c14", "title": "Returnal", "platform": "PS5", "cover": "assets/demo/c14-cover.webp", "screenshots": ["assets/demo/c14-s0.webp", "assets/demo/c14-s1.webp"], "description": "BREAK THE CYCLE Fight to survive as this award-winning third-person shooter brings Selene’s story to PC. Take on roguelike challenges. Engage enemies in bullet hell-fuelled clashes. Share your journey through Returnal™ with another player."}, {"id": "c15", "title": "Stellar Blade", "platform": "PS5", "cover": "assets/demo/c15-cover.webp", "screenshots": ["assets/demo/c15-s0.webp", "assets/demo/c15-s1.webp"], "description": "Save humanity from extinction in post-apocalyptic action-adventure Stellar Blade™. Experience blistering combat and a twisting storyline as you unravel the mysteries of Earth’s downfall."}, {"id": "c16", "title": "Marvel’s Spider-Man Remastered", "platform": "PS5", "cover": "assets/demo/c16-cover.webp", "screenshots": ["assets/demo/c16-s0.webp", "assets/demo/c16-s1.webp"], "description": "In Marvel’s Spider-Man Remastered, the worlds of Peter Parker and Spider-Man collide in an original action-packed story. Play as an experienced Peter Parker, fighting big crime and iconic villains in Marvel’s New York. Web-swing through vibrant neighborhoods and defeat villains with epic takedowns."}];

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
      { key: 'chat', value: { public: true } },
    ],
    coupons: [{ code: 'JAAFAR10', percent: 10, active: true, max_uses: null, uses: 0, expires_at: null, created_at: new Date().toISOString() }],
    orders: [],
    game_requests: [],
    game_votes: [],
    game_sources: [],
    custom_requests: [],
    catalog: CATALOG.map((c, i) => ({ ...c, norm: c.title.toLowerCase().replace(/\s+/g, ' '), requests: 0, created_at: new Date(now - i * 6e5).toISOString() })),
    chat_messages: [{ id: 'm1', name: 'المحل 👑', body: 'أهلاً بكم في دردشة جعفر السلمي 🎮 تكلموا عن الألعاب واسألوا بعض — وللطلبات استخدموا "تواصل مع المحل".', is_admin: true, created_at: new Date(now - 36e5).toISOString() }],
    chat_rate: [],
    support_threads: [],
    support_messages: [],
    custom_request_devices: [],
    sync_queue: [],
    _order_no: 1000,
  };
}
