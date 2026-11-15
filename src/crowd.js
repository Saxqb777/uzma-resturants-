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

const SEAT_POSES = ['sit-eat', 'sit-eat', 'sit-talk', 'sit-eat', 'sit-cheers', 'sit-talk', 'sit-phone'];

export async function buildCrowd(ctx, story) {
  const { scene, animators, renderer } = ctx;
  await loadPeople({});
  const people = listPeople();
  const g = new THREE.Group(); g.name = 'interior'; scene.add(g);
  const animated = [];

  const chef = people.find((p) => /chef/i.test(p.id));
  const kids = people.filter((p) => /child/i.test(p.ageGroup || p.id));
  const women = people.filter((p) => p !== chef && !kids.includes(p) && /^f/i.test(p.sex || ''));
  const men = people.filter((p) => !kids.includes(p) && /^m/i.test(p.sex || ''));
  const adults = people.filter((p) => p !== chef && !kids.includes(p));
  const r = T.rng(4242);
  const pickFrom = (arr, used) => {
    const pool = arr.filter((p) => !used.has(p.id));
    const p = (pool.length ? pool : arr)[Math.floor(r() * (pool.length ? pool.length : arr.length))];
    used.add(p.id);
    return p;
  };

  // staff first, so their avatars aren't reused right next to them
  const staffUsed = new Set();
  const place = (id, x, z, ry, opts, animate = true) => {
    const p = createPerson(id, { seed: Math.floor(r() * 1e6), ...opts, static: !animate });
    p.position.set(x, 0, z); p.rotation.y = ry;
    g.add(p);
    if (animate && p.userData.update) animated.push(p);
    return p;
  };
  const S = CASHIER.staff;
  place(pickFrom(women, staffUsed).id, S.x, S.z, S.ry, { pose: 'cashier', uniform: 'cashier', name: STAFF.cashier });

  // kitchen + live station
  const K = KITCHEN_SPOTS;
  if (chef) { staffUsed.add(chef.id); place(chef.id, K.headChef.x + 0.6, K.headChef.z, K.headChef.ry, { pose: K.headChef.pose, uniform: 'head-chef', name: STAFF.headChef, holding: 'pan' }); }
  place(pickFrom(men, staffUsed).id, K.sousChef.x, K.sousChef.z, K.sousChef.ry, { pose: K.sousChef.pose, uniform: 'chef', name: STAFF.sousChef });
  place(pickFrom(men, staffUsed).id, K.assistant1.x, K.assistant1.z, K.assistant1.ry, { pose: K.assistant1.pose, uniform: 'cook', name: STAFF.assistant1, holding: 'knife' });
  place(pickFrom(women, staffUsed).id, K.assistant2.x, K.assistant2.z, K.assistant2.ry, { pose: K.assistant2.pose, uniform: 'cook', name: STAFF.assistant2 });
  place(pickFrom(men, staffUsed).id, K.waiter.x, K.waiter.z, K.waiter.ry, { pose: K.waiter.pose, uniform: 'server', name: STAFF.server2, holding: 'tray' });
  place(pickFrom(women, staffUsed).id, K.kitchen1.x, K.kitchen1.z, K.kitchen1.ry, { pose: K.kitchen1.pose, uniform: 'cook', name: STAFF.kitchen1, holding: 'knife' }, false);
  place(pickFrom(men, staffUsed).id, K.kitchen2.x, K.kitchen2.z, K.kitchen2.ry, { pose: K.kitchen2.pose, uniform: 'cook', name: STAFF.kitchen2 }, false);
  place(pickFrom(adults, staffUsed).id, K.kitchen3.x, K.kitchen3.z, K.kitchen3.ry, { pose: K.kitchen3.pose, uniform: 'cook', name: STAFF.kitchen3 }, false);
  // a server bringing a tray down the centre aisle
  place(pickFrom(women, staffUsed).id, 0.2, -12.0, Math.PI * 0.9, { pose: 'carry-tray', uniform: 'server', name: STAFF.server1, holding: 'tray' });

  // the photographer: one person who moves with the story
  const photogId = pickFrom(women, staffUsed).id;
  const photoTable = BOOTHS.find((b) => b.id === PHOTO_TABLE);
  const photoAt = { x: photoTable.x + 1.05, z: photoTable.z + 0.15, ry: -Math.PI / 2 - 0.12 };      // in the centre aisle, aiming at the table
  const pinAt = CASHIER.pinStand;
  const photog = {
    photo: place(photogId, photoAt.x, photoAt.z, photoAt.ry, { pose: 'photo', uniform: 'server', name: STAFF.photographer, holding: 'camera' }),
    pin: place(photogId, pinAt.x, pinAt.z, pinAt.ry, { pose: 'pin', uniform: 'server', name: STAFF.photographer, holding: 'polaroid' }),
  };
  photog.pin.visible = false;

  // guests at the occupied tables
  for (const b of BOOTHS) {
    if (!OCCUPIED.has(b.id)) continue;
    const hero = b.id === HERO_TABLE || b.id === PHOTO_TABLE;
    const n = hero ? 4 : 2 + Math.floor(r() * 3);
    const seats = [...b.seats].sort(() => r() - 0.5).slice(0, n);
    const used = new Set(staffUsed);
    // some tables are families with a child
    const family = !hero && kids.length && r() < 0.35;
    seats.forEach((seat, k) => {
      const who = family && k === 0 ? pickFrom(kids, used) : pickFrom(adults, used);
      const pose = b.id === PHOTO_TABLE ? (k % 2 ? 'sit-cheers' : 'sit-talk') : SEAT_POSES[Math.floor(r() * SEAT_POSES.length)];
      const holding = pose === 'sit-cheers' ? 'glass' : pose === 'sit-phone' ? 'phone' : pose === 'sit-eat' ? 'chopsticks' : null;
      place(who.id, seat.x, seat.z, seat.ry, { pose, holding }, hero);
    });
  }

  animators.push((t, dt) => { for (const p of animated) if (p.visible) p.userData.update(t, dt); });

  // ---- the new polaroid: rendered from the photographer's point of view
  const rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType });
  const shot = new THREE.PerspectiveCamera(46, 1, 0.05, 40);
  shot.position.set(photoAt.x - 0.15, 1.55, photoAt.z);
  shot.lookAt(photoTable.x, 1.0, photoTable.z);
  const print = polaroidPrint(rt.texture);
  const P = CASHIER.pinSpot;
  print.position.set(P.x, P.y, P.z); print.rotation.y = -Math.PI / 2; print.rotation.z = 0.06;
  print.visible = false;
  g.add(print);
  let captured = false;
  const capture = () => {
    if (captured || !renderer) return;
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(rt); renderer.render(scene, shot); renderer.setRenderTarget(prevTarget);
    captured = true;
  };

  // story hooks (called by main.js when the tour changes scene / arrives)
  // before the pin slide Jisoo is at the table; from the pin slide on she is at the wall and the print is up
  const pinIndex = SCENES.findIndex((sc) => sc.story === 'pin');
  story.onScene = (s, i) => {
    const atWall = pinIndex >= 0 && i >= pinIndex;
    photog.photo.visible = !atWall;
    photog.pin.visible = atWall;
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
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.074, 0.074), new THREE.MeshBasicMaterial({ map: tex }));
  photo.position.set(0, 0.011, 0.0008);
  grp.add(photo);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshStandardMaterial({ color: '#e889ab', roughness: 0.3 }));
  pin.position.set(0, 0.046, 0.006); grp.add(pin);
  grp.userData.keep = true;
  return grp;
}
