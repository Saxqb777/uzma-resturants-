// ============================================================
//  EDIT HERE: restaurant name, sign words, and the tour scenes.
// ============================================================

export const RESTAURANT = {
  nameKo: '우즈마',          // Korean name on the signs
  nameEn: 'UZMA',            // English name
  kind: 'Korean BBQ',        // shown under the name
  kindKo: '숯불구이',         // "charcoal grill"
};

// Fonts (loaded from Google Fonts in index.html)
export const FONTS = {
  display: '"Black Han Sans", "Do Hyeon", sans-serif',   // bold retro sign lettering
  retro: '"Do Hyeon", "Black Han Sans", sans-serif',
  brush: '"Nanum Brush Script", "Nanum Pen Script", cursive',
  pen: '"Nanum Pen Script", cursive',
  sans: '"IBM Plex Sans KR", system-ui, sans-serif',
};

// Shared floor plan (meters). Interior floor is y = 0.
// x: left(-) → right(+) as seen from the street.  z: street(+) → back of the shop(-).
export const LAYOUT = {
  x0: -5, x1: 5,          // inside faces of the side walls
  zFront: 0,              // inside face of the shop front
  zFrontOut: 0.3,         // outside face of the shop front
  zBack: -18,             // back wall
  ceil: 4.2,              // underside of the (black) ceiling
  slabTop: 4.6,           // top of the floor slab above the shop
  door: { x0: 1.0, x1: 2.2, h: 2.45 },
  frontWindow: { x0: -4.5, x1: 0.4, y0: 0.8, y1: 2.55 },
  sideWindow: { x0: 2.9, x1: 4.5, y0: 0.9, y1: 2.55 },
  sidewalkY: -0.45,       // street level is 3 steps below the shop floor
  curbZ: 4.6,             // sidewalk runs from the shop front to here
  roadY: -0.6,
  kitchenZ: -15,          // wall between dining room and kitchen
};

// ------------------------------------------------------------
//  Tour scenes. Enter / → goes forward, ← goes back.
//  cam = where the camera stands, look = what it looks at.
//  zone decides the transition: same zone glides, different zone fades.
// ------------------------------------------------------------
export const SCENES = [
  {
    id: 'street', zone: 'out', kicker: 'Outside',
    title: 'Welcome to UZMA',
    text: 'A small retro Korean barbecue house on a quiet city street, lit up for dinner.',
    cam: [-2.4, 1.2, 12.2], look: [0.3, 2.9, 0], fov: 50,
    drift: [0.8, 0.05, -0.6],
  },
  {
    id: 'entrance', zone: 'out', kicker: 'Outside',
    title: 'The Entrance',
    text: 'Rusty tin awning, a paper lantern and menu boards out front. Three wooden steps up to the door.',
    cam: [5.2, 0.85, 6.3], look: [1.3, 1.65, 0.2], fov: 52,
    drift: [-0.35, 0.05, -0.25],
  },
  {
    id: 'aisle', zone: 'in', kicker: 'Inside', glide: true,   // glides in through the front door
    title: 'Step Inside',
    text: 'Wooden booths, little tin roofs and warm bulbs. It feels like a back-alley street in Seoul, indoors.',
    cam: [1.4, 1.62, -0.7], look: [0.6, 1.35, -12], fov: 56,
    via: [1.3, 1.45, 1.6],   // curve the glide so it goes straight through the door
    drift: [0, 0, -0.6],
  },
  {
    id: 'booths', zone: 'in', kicker: 'Inside',
    title: 'The Booths',
    text: 'High-back wooden booths for every group, each with its own grill in the middle of the table.',
    cam: [1.9, 2.05, -3.4], look: [-3.6, 1.0, -8.6], fov: 52,
    drift: [-0.1, 0.05, -0.7],
  },
  {
    id: 'grill', zone: 'in', kicker: 'At the table',
    title: 'Grill at the Table',
    text: 'Guests cook their own meat over charcoal, with small side dishes, soju and a cold steel water bottle.',
    cam: [0.85, 1.62, -4.75], look: [-0.55, 0.8, -5.75], fov: 50,
    drift: [0.1, 0.05, -0.18],
  },
  {
    id: 'bar', zone: 'in', kicker: 'Inside',
    title: 'Soju Bar & Counter',
    text: 'Where staff greet guests, take payment and pour drinks. The fridge is stocked with soju and beer.',
    cam: [0.9, 1.65, -1.6], look: [4.3, 1.3, -4.0], fov: 54,
    drift: [0.15, 0, -0.35],
  },
  {
    id: 'kitchen', zone: 'in', kicker: 'Back of house',
    title: 'The Kitchen',
    text: 'An open pass lets guests see the cooks prepare meat, stews and side dishes.',
    cam: [-0.45, 1.72, -12.35], look: [-0.7, 2.0, -15.5], fov: 58,
    drift: [-0.15, 0, -0.5],
  },
  {
    id: 'plan', zone: 'top', kicker: 'Overview', glide: true, // camera rises up through the roof
    title: 'The Floor Plan',
    text: 'Roof off: the street, the entrance, three rows of booths, the bar and the kitchen at the back.',
    cam: [-2.6, 19.5, -6.6], look: [0.2, 0, -6.6], up: [-1, 0, 0], fov: 45, cutaway: true,
    drift: [0, 0.8, -0.6],
    labels: [
      { text: 'Street', at: [0, -0.4, 3.2] },
      { text: 'Entrance', at: [1.6, 0, -0.6] },
      { text: 'Window booths', at: [-4.3, 0.8, -5.5] },
      { text: 'Center booths', at: [-1.2, 1.5, -8.6] },
      { text: 'Bar & counter', at: [3.8, 1.1, -3.2] },
      { text: 'Wall booths', at: [4.3, 0.8, -10.2] },
      { text: 'Kitchen', at: [-0.6, 1, -16.6] },
    ],
  },
];
