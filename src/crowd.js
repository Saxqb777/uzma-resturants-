// Everyone in the restaurant: guests at 16 of the 30 tables, staff at their stations, and the
// little polaroid story (Jisoo photographs a table, then pins the print on the polaroid wall —
// the print is a real render of those guests, so the story is continuous).
import * as THREE from 'three';
import { loadPeople, listPeople, createPerson } from './people.js';
import { BOOTHS, OCCUPIED, PHOTO_TABLE, HERO_TABLE } from './interior.js';
import { CASHIER } from './cashier.js';
import { KITCHEN_SPOTS } from './kitchen.js';
import { STAFF, SCENES } from './config.js';
import * as T from './textures.js';

// Staff avatars are chosen by hand: modest, tidy outfits that suit a uniform apron.
const STAFF_AVATAR = {
  cashier: 'woman-young-hoodie',
  cashier2: 'woman-hijab-olive',
  photographer: 'woman-asian-beige-suit',
  serverAisle: 'woman-black-suit',
  waiter: 'man-asian-navy-suit',
  headChef: 'chef-female',
  sousChef: 'man-asian-black-tee',
  assistant1: 'man-asian-red-track',
  assistant2: 'woman-auburn-blue',
  kitchen1: 'man-cap-tracksuit',
  kitchen2: 'woman-brown-dress',
  kitchen3: 'man-black-denim',
};

// Hand-picked guest groups for the tables the camera looks at closely; the rest are mixed at random.
const GROUPS = {
  [PHOTO_TABLE]: ['woman-blonde-pink', 'man-white-kurta', 'man-grey-beard-vest', 'man-older-tweed'],
  [HERO_TABLE]: ['woman-abaya-black', 'man-emirati-ghutra'],
};
const SEAT_POSES = ['sit-eat', 'sit-eat', 'sit-talk', 'sit-eat', 'sit-cheers', 'sit-talk', 'sit-phone'];

export async function buildCrowd(ctx, story) {
  const { scene, animators, renderer } = ctx;
  await loadPeople({});
  const all = listPeople();
  const has = (id) => all.some((p) => p.id === id);
  const g = new THREE.Group(); g.name = 'interior'; scene.add(g);
  const animated = [];
  const r = T.rng(4242);

  const place = (id, x, z, ry, opts = {}, animate = true) => {
    if (!has(id)) return null;
    const p = createPerson(id, { seed: Math.floor(r() * 1e6), ...opts, static: !animate });
    p.position.set(x, 0, z); p.rotation.y = ry;
    g.add(p);
    if (animate && p.userData.update) animated.push(p);
    return p;
  };
  // a world-space point expressed in the local space of a person standing at (x, z) with rotation ry
  const toLocal = (x, z, ry, wx, wy, wz) => new THREE.Vector3(wx - x, wy, wz - z).applyAxisAngle(new THREE.Vector3(0, 1, 0), -ry);

  // ------------------------------------------------------------ staff
  const A = STAFF_AVATAR, K = KITCHEN_SPOTS, S = CASHIER.staff;
  place(A.cashier, S.x, S.z, S.ry, { pose: 'cashier', uniform: 'cashier', name: STAFF.cashier });
  const S2 = CASHIER.staff2;
  place(A.cashier2, S2.x, S2.z, S2.ry, { pose: 'cashier', uniform: 'cashier', name: STAFF.cashier2 });
  place(A.headChef, K.headChef.x, K.headChef.z, K.headChef.ry, { pose: K.headChef.pose, uniform: 'head-chef', name: STAFF.headChef });
  place(A.sousChef, K.sousChef.x, K.sousChef.z, K.sousChef.ry, { pose: K.sousChef.pose, uniform: 'chef', name: STAFF.sousChef });
  place(A.assistant1, K.assistant1.x, K.assistant1.z, K.assistant1.ry, { pose: K.assistant1.pose, uniform: 'cook', name: STAFF.assistant1 });
  place(A.assistant2, K.assistant2.x, K.assistant2.z, K.assistant2.ry, { pose: K.assistant2.pose, uniform: 'cook', name: STAFF.assistant2 });
  place(A.waiter, K.waiter.x, K.waiter.z, K.waiter.ry, { pose: K.waiter.pose, uniform: 'server', name: STAFF.server1 });
  place(A.kitchen1, K.kitchen1.x, K.kitchen1.z, K.kitchen1.ry, { pose: K.kitchen1.pose, uniform: 'cook', name: STAFF.kitchen1 });
  place(A.kitchen2, K.kitchen2.x, K.kitchen2.z, K.kitchen2.ry, { pose: K.kitchen2.pose, uniform: 'cook', name: STAFF.kitchen2 });
  place(A.kitchen3, K.kitchen3.x, K.kitchen3.z, K.kitchen3.ry, { pose: K.kitchen3.pose, uniform: 'cook', name: STAFF.kitchen3 }, false);
  // a server bringing a tray down the centre aisle
  place(A.serverAisle, 0.25, -12.4, 0.12, { pose: 'carry-tray', uniform: 'server', name: STAFF.server2 });

  // the photographer: one person, two moments of the story
  const photoTable = BOOTHS.find((b) => b.id === PHOTO_TABLE);
  const photoAt = { x: photoTable.x + 1.25, z: photoTable.z + 0.1, ry: -Math.PI / 2 };   // in the centre aisle, aiming at the table
  const pinAt = CASHIER.pinStand, P = CASHIER.pinSpot;
  const photog = {
    photo: place(A.photographer, photoAt.x, photoAt.z, photoAt.ry, { pose: 'photo', uniform: 'server', name: STAFF.photographer }),
    pin: place(A.photographer, pinAt.x, pinAt.z, pinAt.ry, {
      pose: 'pin', uniform: 'server', name: STAFF.photographer,
      target: toLocal(pinAt.x, pinAt.z, pinAt.ry, P.x - 0.02, P.y, P.z),
    }),
  };
  if (photog.pin) photog.pin.visible = false;

  // ------------------------------------------------------------ guests
  const staffIds = new Set(Object.values(A));
  const guests = all.filter((p) => p.id !== 'chef-female' && p.id !== 'woman-asian-magenta');
  const adults = guests.filter((p) => !/child/i.test(p.ageGroup || ''));
  const kids = guests.filter((p) => /child/i.test(p.ageGroup || ''));
  let lastTable = [];
  const featured = new Set(Object.values(GROUPS).flat());   // faces at the close-up tables are kept rare elsewhere
  for (const b of BOOTHS) {
    if (!OCCUPIED.has(b.id)) continue;
    const close = b.id === HERO_TABLE || b.id === PHOTO_TABLE;
    let ids = GROUPS[b.id];
    if (!ids) {
      const n = 2 + Math.floor(r() * 3);
      // prefer people who are not staff look-alikes and who were not at the previous table
      const fresh = adults.filter((p) => !staffIds.has(p.id));
      const base = fresh.length >= 10 ? fresh : adults;
      const pool = base.filter((p) => !lastTable.includes(p.id) && !featured.has(p.id));
      const pool2 = pool.length >= n ? pool : base;
      ids = [...pool2].sort(() => r() - 0.5).slice(0, n).map((p) => p.id);
      if (kids.length && r() < 0.3) ids[ids.length - 1] = kids[Math.floor(r() * kids.length)].id;
    }
    lastTable = ids;
    // seat order: fill both benches evenly; at the hero table only the far bench, so the food stays in view
    let seats = [...b.seats];
    if (b.id === HERO_TABLE) seats = seats.filter((s) => s.side < 0);
    else seats = [seats[0], seats[3], seats[1], seats[2]];
    ids.slice(0, seats.length).forEach((id, k) => {
      const seat = seats[k];
      let pose = SEAT_POSES[Math.floor(r() * SEAT_POSES.length)];
      const opts = {};
      if (b.id === PHOTO_TABLE) {
        // posing for the camera: glasses up or mid-laugh, everyone looking at Jisoo
        pose = k % 2 ? 'sit-cheers' : 'sit-talk';
        opts.lookAt = toLocal(seat.x, seat.z, seat.ry, photoAt.x, 1.5, photoAt.z);
      } else if (b.id === HERO_TABLE) {
        pose = k ? 'sit-eat' : 'sit-talk';
      } else if (/child/i.test((all.find((p) => p.id === id) || {}).ageGroup || '')) {
        pose = 'sit-eat';
      }
      place(id, seat.x, seat.z, seat.ry, { pose, ...opts }, close || r() < 0.35);
    });
  }

  animators.push((t, dt) => { for (const p of animated) if (p.visible) p.userData.update(t, dt); });

  // ------------------------------------------------------------ the new polaroid
  // rendered from the photographer's point of view the moment the flash fires
  const rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType });
  const shot = new THREE.PerspectiveCamera(50, 1, 0.6, 40);
  shot.position.set(photoAt.x, 1.5, photoAt.z);
  shot.lookAt(photoTable.x, 1.02, photoTable.z);
  const print = polaroidPrint(rt.texture);
  print.position.set(P.x, P.y, P.z); print.rotation.y = -Math.PI / 2; print.rotation.z = 0.05;
  print.visible = false;
  g.add(print);
  let captured = false;
  const capture = () => {
    if (captured || !renderer) return;
    const prevTarget = renderer.getRenderTarget();
    const vis = photog.photo ? photog.photo.visible : false;
    if (photog.photo) photog.photo.visible = false;       // she is behind the lens
    renderer.setRenderTarget(rt); renderer.render(scene, shot); renderer.setRenderTarget(prevTarget);
    if (photog.photo) photog.photo.visible = vis;
    captured = true;
  };

  // before the pin slide Jisoo is at the table; from the pin slide on she is at the wall and the print is up
  const pinIndex = SCENES.findIndex((sc) => sc.story === 'pin');
  story.onScene = (s, i) => {
    const atWall = pinIndex >= 0 && i >= pinIndex;
    if (photog.photo) photog.photo.visible = !atWall;
    if (photog.pin) photog.pin.visible = atWall;
    print.visible = atWall;
    if (atWall) capture();
  };
  story.onArrive = (s) => { if (s.flash) capture(); };
  story.capture = capture;
  return g;
}

// White instant-film frame around a live render
function polaroidPrint(tex) {
  const grp = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.088, 0.11), new THREE.MeshStandardMaterial({ color: '#fbfaf5', roughness: 0.5 }));
  grp.add(frame);
  // a flash photo is brighter than the room it was taken in
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.074, 0.074), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.7, 1.6, 1.5) }));
  photo.position.set(0, 0.011, 0.0008);
  grp.add(photo);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshStandardMaterial({ color: '#e889ab', roughness: 0.3 }));
  pin.position.set(0, 0.046, 0.006); grp.add(pin);
  grp.userData.keep = true;
  return grp;
}
