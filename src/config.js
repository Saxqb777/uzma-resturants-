// ============================================================
//  EDIT HERE: restaurant name, sign words, and the tour scenes.
// ============================================================

export const RESTAURANT = {
  name: 'Seoulicious',          // English name (signs, UI)
  nameAr: 'سيوليشس',            // Arabic name (signs) — confirmed by the client
  kind: 'Korean BBQ',
  kindKo: '코리안 바베큐',        // used only in bilingual decor, never as the shop name
  tagline: 'Korean BBQ for everyone',
  city: 'Abu Dhabi',
  currency: 'AED',
  // legacy keys (older code paths); the shop name is never written in Korean
  nameEn: 'Seoulicious',
  nameKo: 'Seoulicious',
};

// The meal deal shown on the sidewalk boards, menus and the grill-table slide
export const MEAL_DEAL = {
  title: 'Korean BBQ Special Meal Deal',
  price: 'AED 59',
  items: ['Korean Spicy Chicken BBQ', 'Steamed Korean rice', 'Kimchi', 'Korean cucumber salad', 'Signature Korean sauce'],
  extra: 'Add a Polaroid picture: AED 5',
};

// Fonts (loaded from Google Fonts in index.html)
export const FONTS = {
  display: '"Black Han Sans", "Do Hyeon", sans-serif',   // bold retro sign lettering (Latin + Hangul)
  retro: '"Do Hyeon", "Black Han Sans", sans-serif',
  brush: '"Nanum Brush Script", "Nanum Pen Script", cursive',
  pen: '"Nanum Pen Script", cursive',
  sans: '"IBM Plex Sans KR", system-ui, sans-serif',
  arabic: '"Noto Kufi Arabic", "IBM Plex Sans Arabic", sans-serif',
  brand: '"Lilita One", "Fredoka", sans-serif',          // the Seoulicious wordmark (Latin): bold, friendly, vibrant
  brandAr: '"Lalezar", "Noto Kufi Arabic", sans-serif',   // matching Arabic wordmark face
  neon: '"Pacifico", "Yellowtail", cursive',              // neon script
  cute: '"Jua", "Fredoka", sans-serif',                   // rounded, for menus and the cashier corner
  round: '"Fredoka", "Jua", sans-serif',
};

// Shared floor plan (meters). Interior floor is y = 0.
// x: left(-) → right(+) as seen from the street.  z: street(+) → back of the shop(-).
//
//   street ──────────────────────────────────────────────── z = +4.6 curb
//   facade (door in the middle)                             z = 0
//   front zone: photo spot (left) · entrance · cashier (right)   z 0 … -4.6
//   dining: 30 booths for 4 in four lanes                   z -5.0 … -16.5
//   live cooking station (counter across the room)          z -16.5 … -21.0
//   main kitchen (behind a wall with a pass window)         z -21.2 … -27.0
export const LAYOUT = {
  x0: -7.5, x1: 7.5,      // inside faces of the side walls (15 m wide)
  wallT: 0.3,
  zFront: 0,              // inside face of the shop front
  zFrontOut: 0.3,         // outside face of the shop front
  zBack: -27.0,           // inside face of the back wall
  ceil: 4.2,              // underside of the (black) ceiling
  slabTop: 4.6,           // top of the floor slab above the shop
  door: { x0: -0.7, x1: 0.7, h: 2.45 },
  frontWindow: { x0: -6.8, x1: -1.5, y0: 0.8, y1: 2.55 },   // left of the door
  sideWindow: { x0: 1.5, x1: 6.8, y0: 0.8, y1: 2.55 },      // right of the door
  sidewalkY: -0.45,       // street level is 3 steps below the shop floor
  curbZ: 4.6,
  roadY: -0.6,
  // dining room: booths
  dining: { z0: -5.0, pitch: 2.3, count: 5 },               // back panels at z0, z0-pitch, …
  lanes: {
    wallL: { x: -6.8, xa: -7.5, xb: -6.1 },                  // tables against the left wall
    isl1: { xL: -3.3, xR: -1.7, xa: -4.0, xb: -1.0, part: -2.5 },
    isl2: { xL: 1.7, xR: 3.3, xa: 1.0, xb: 4.0, part: 2.5 },
    wallR: { x: 6.8, xa: 6.1, xb: 7.5 },
  },
  table: { len: 1.4, wid: 0.8, top: 0.76, seat: 0.48 },
  // live cooking station
  live: { counterFront: -18.3, counterBack: -19.2, wallZ: -21.0, x0: -5.2, x1: 5.2 },
  // main kitchen
  kitchen: { z0: -21.2, z1: -27.0, pass: { x0: -1.6, x1: 1.6, y0: 1.0, y1: 2.0 }, doors: [-4.6, 4.6] },
  kitchenZ: -21.0,        // legacy name for the dividing wall
};

// ------------------------------------------------------------
//  Tour scenes. Enter / → goes forward, ← goes back.
//  cam = where the camera stands, look = what it looks at.
//  zone decides the transition: same zone glides, different zone fades.
//  glide: true → arrive by gliding from the previous scene (via = curve point).
//  story → what the photographer is doing ('photo' at the table, 'pin' at the wall).
//  dof → background blur strength (pixels at 1080p) once the camera rests; focus = sharp distance in meters.
// ------------------------------------------------------------
export const SCENES = [
  {
    id: 'street', zone: 'out', kicker: 'Outside',
    title: 'Welcome to Seoulicious',
    text: 'Korean BBQ for everyone: friends, families and first-timers, there is always a seat at our grill.',
    cam: [-3.0, 1.3, 15.0], look: [0, 3.0, 0], fov: 50,
    drift: [0.8, 0.05, -0.6],
  },
  {
    id: 'deal', zone: 'out', kicker: 'Special offer',
    title: 'Korean BBQ Meal Deal · AED 59',
    text: 'Spicy chicken BBQ, steamed rice, kimchi, cucumber salad and our signature sauce. Add a polaroid for AED 5.',
    cam: [-2.0, 0.55, 3.6], look: [-2.6, 0.2, 1.6], fov: 40,
    dof: 9, focus: 2.0,
    drift: [0.12, 0.02, -0.12],
  },
  {
    id: 'entrance', zone: 'out', kicker: 'Outside',
    title: 'The Entrance',
    text: '',
    cam: [3.6, 0.9, 6.4], look: [0, 1.5, 0.2], fov: 52,
    drift: [-0.35, 0.05, -0.25],
  },
  {
    id: 'aisle', zone: 'in', kicker: 'Inside', glide: true,
    title: 'Step Inside',
    text: 'Warm lights, tin-roof booths and Seoul street vibes, right here in Abu Dhabi.',
    cam: [0, 1.62, -1.2], look: [0, 1.5, -16], fov: 60,
    via: [0.1, 1.45, 2.0],
    drift: [0, 0, -0.6],
  },
  {
    id: 'booths', zone: 'in', kicker: 'Inside',
    title: 'The Booths',
    text: '30 cosy booths for four, a grill in every table, soft cushions and armrests for long, happy dinners.',
    cam: [-0.4, 2.15, -5.55], look: [-6.6, 0.9, -11.4], fov: 58,
    drift: [-0.1, 0.05, -0.6],
  },
  {
    id: 'grill', zone: 'in', kicker: 'At the table',
    title: 'Grill at the Table',
    text: 'The meal deal, served: spicy chicken sizzling on the grill, rice, kimchi and cucumber salad, plus a polaroid to remember it.',
    cam: [0.15, 1.55, -5.15], look: [1.65, 0.8, -6.2], fov: 50,
    dof: 8, focus: 1.9,
    drift: [0.08, 0.04, -0.15],
  },
  {
    id: 'cashier', zone: 'in', kicker: 'Pay & polaroids',
    title: 'The Cashier Corner',
    text: 'Pay with a smile, grab a menu, and meet our Seoulicious family on the polaroid wall.',
    cam: [3.0, 1.65, -1.25], look: [6.5, 1.45, -3.7], fov: 56,
    dof: 4, focus: 4.4,
    drift: [0.15, 0, -0.3],
  },
  {
    id: 'photo', zone: 'in', kicker: 'Say kimchi!', story: 'photo',
    title: 'Polaroid Time',
    text: 'Jisoo snaps a polaroid of our guests: a memory to keep for just AED 5.',
    cam: [1.1, 1.75, -7.2], look: [-1.8, 1.05, -8.5], fov: 52,
    dof: 6, focus: 3.3,
    drift: [0.1, 0.03, -0.12], flash: true,
  },
  {
    id: 'pin', zone: 'in', kicker: 'Our wall', story: 'pin',
    title: 'Onto the Polaroid Wall',
    text: 'Every polaroid joins the wall of happy customers who have eaten with us.',
    cam: [6.0, 1.7, -0.95], look: [7.42, 1.58, -2.2], fov: 50,
    dof: 8, focus: 1.9,
    drift: [0.08, 0, -0.1],
  },
  {
    id: 'live', zone: 'in', kicker: 'Back of house',
    title: 'Live Cooking Station',
    text: 'Our chefs cook fresh in front of you, and waiters pick up every dish right here.',
    cam: [-5.0, 1.8, -17.0], look: [1.6, 1.5, -19.6], fov: 62,
    dof: 4, focus: 4.5,
    drift: [0.12, 0, -0.2],
  },
  {
    id: 'kitchen', zone: 'in', kicker: 'Back of house', glide: true,
    title: 'The Main Kitchen',
    text: 'Spotless and bright: everything is prepared on site, from fresh vegetables to marinated chicken.',
    cam: [4.2, 1.85, -22.2], look: [-3.0, 1.0, -25.0], fov: 66,
    via: [-0.2, 1.6, -21.6],
    drift: [0.15, 0, -0.2],
  },
  {
    id: 'plan', zone: 'top', kicker: 'Overview', glide: true,
    title: 'The Floor Plan',
    text: 'Roof off: the street, entrance, cashier, 30 booths, the live cooking station and the main kitchen.',
    cam: [-3.2, 27, -11.2], look: [0.2, 0, -11.2], up: [-1, 0, 0], fov: 45, cutaway: true,
    drift: [0, 0.8, -0.6],
    labels: [
      { text: 'Street', at: [0, -0.4, 3.0] },
      { text: 'Entrance', at: [0, 0, -0.8] },
      { text: 'Photo spot', at: [-6.0, 1.0, -2.5] },
      { text: 'Cashier & polaroid wall', at: [6.2, 1.2, -3.0] },
      { text: 'Wall booths', at: [-6.8, 1.0, -10.75] },
      { text: 'Centre booths', at: [-2.5, 1.4, -10.75] },
      { text: 'Centre booths ', at: [2.5, 1.4, -10.75] },
      { text: 'Wall booths ', at: [6.8, 1.0, -10.75] },
      { text: 'Live cooking station', at: [0, 1.2, -18.8] },
      { text: 'Main kitchen', at: [0, 1.0, -24.5] },
    ],
  },
];

// Placeholder menu (chicken & beef only, no alcohol) — replace with her real items/prices.
export const MENU = {
  mains: [
    ['Korean BBQ Special Meal Deal', '바베큐 세트', 59, 'deal'],
    ['Spicy Chicken BBQ', '닭갈비', 45, 'spicy_chicken'],
    ['Beef Bulgogi', '소불고기', 52, 'bulgogi'],
    ['Chicken Bulgogi', '닭불고기', 42, 'chicken_bulgogi'],
    ['Bibimbap', '비빔밥', 35, 'bibimbap'],
    ['Japchae', '잡채', 30, 'japchae'],
    ['Tteokbokki', '떡볶이', 28, 'tteokbokki'],
    ['Kimchi Fried Rice', '김치볶음밥', 32, 'kimchi_fried_rice'],
    ['Korean Fried Chicken', '치킨', 38, 'fried_chicken'],
  ],
  drinks: [
    ['Peach Iced Tea', '복숭아 아이스티', 15],
    ['Strawberry Milk', '딸기 우유', 16],
    ['Soft Drinks', '음료수', 8],
    ['Water', '물', 5],
  ],
  extras: [['Polaroid picture', '폴라로이드', 5]],
};

// Staff (Korean names on the name tags)
export const STAFF = {
  cashier: '하나 Hana',
  photographer: '지수 Jisoo',
  server1: '민준 Minjun',
  server2: '서연 Seoyeon',
  headChef: '김 셰프 Chef Kim',
  sousChef: '도윤 Doyun',
  assistant1: '예준 Yejun',
  assistant2: '하윤 Hayun',
  kitchen1: '지호 Jiho',
  kitchen2: '수아 Sua',
  kitchen3: '은우 Eunwoo',
  cashier2: '유나 Yuna',
};
