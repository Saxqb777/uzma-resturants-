# UZMA restaurant: plan & decisions

This file is the project's memory. Any new chat should read it first.

## Goal
- A 3D restaurant for a sister's project, showing her restaurant business: the space, the staff, the menu and people eating.
- Shown like a **presentation**: `Enter` moves to the next scene.
- `V` switches to a free **look-around** mode (spectator camera).

## Decisions so far
- **Tech:** three.js in the browser. Nothing to install, it opens from a link and runs on a normal laptop.
- **Look:** stylized but warm and moody, matched to her 4 reference photos (retro Korean BBQ / pocha).
  - Inside: dark open ceiling, wooden high-back booths, little rusty tin roofs over the booths, hand-painted retro signs, bare bulbs, a grill in every table. (v1: no alcohol, so no bottle shelves.)
  - Outside: a mix of her two storefront photos. Wooden front, brick, rusty tin awning, painted billboard, black tiled hanok eave, vertical lightbox sign, lantern, steps, menu boards.
  - The street around it is "little vibes" only.
- **Signs:** all original wording. No real brands or logos copied from the photos.
- **Name:** Seoulicious (v1). Change it in `src/config.js`.
- **Workflow rule:** show visuals before big work. Never make big changes without a final OK from the user.

## Status
- **v1 is LIVE** (deployed 2026-11-16, commit `0dc859c`):
  - Public website (Vercel): https://korean-resturant-proj-uni.vercel.app
  - Preview of all 12 slides: `docs/v1-preview-a.jpg` (1–6), `docs/v1-preview-b.jpg` (7–12).
- **v0 (old):** preview in `docs/v0-preview.jpg`. Private Claude link: https://claude.ai/artifact/7VsVhKtA44W7rnQExD1TKk

## v1 — client feedback (Nov 15) → decisions
- **Name:** Seoulicious, English + Arabic سيوليشس on all signs. No Korean shop name.
- **Location:** Abu Dhabi. Prices in AED.
- **Food rules:** no alcohol anywhere. No pork: chicken and beef only.
- **Signs:** English + Korean so everyone understands.
- **Meal deal (offer boards, menus, grill table):** AED 59.
  - Includes spicy chicken BBQ, steamed rice, kimchi, cucumber salad and signature sauce.
  - Optional polaroid: AED 5.
- **Layout:** 30 booths of 4. Building 15 m × 27 m, symmetric, wide aisles.
  - Booths have cushions and wooden armrests.
- **Front zone:** photo-spot mural wall (left), entrance, cute pink/teal cashier (right).
  - Polaroid wall behind the cashier.
  - Separated 2-seat nook by the window.
- **Back of house:** live cooking station (head chef, sous chef, 2 assistants, waiter pickup).
  - Behind it, a clean white main kitchen: fridges, microwave, prep, staff.
- **Realism, "no AI slop":**
  - Photo-scanned CC0 textures and plants (Poly Haven).
  - Realistic rigged people (Microsoft Rocketbox, MIT license).
  - Higgsfield AI for photos and poster art only. All lettering is drawn by code.
- **Higgsfield budget:** account had 69 credits.
  - Images 0.25 cr each.
  - 3D models 9 cr each (Tripo), saved for hero food only.
- **Slides (13):**
  1. Street
  2. Offer-board zoom (whole poster readable)
  3. Entrance (title only)
  4. Inside
  5. Photo spot (3 friends posing / taking a picture at the mural)
  6. Booths
  7. Grill table (meal deal + polaroid)
  8. Cashier
  9. Polaroid taken (flash)
  10. Polaroid pinned (the print is a real render of that table)
  11. Live cooking station
  12. Main kitchen (with the dish station)
  13. Floor plan
- **Nov 15 follow-up feedback:**
  - Two cashiers.
  - Shop-name sign more vibrant (brand fonts: Lilita One + Lalezar, neon/channel-letter look).
  - People must look alive: expressions, blinking, eye contact, warm skin.
  - Better graphics: ambient occlusion, SMAA, real HDR lighting.
- **Nov 16 feedback (done):**
  - Cashier corner: no pink/teal decorations. Plain, in the shop's own look: dark wood, cream paper, sign red, brass.
    - Lanterns, bunting, scalloped trim, rainbow rug, plush toys and candy jar removed.
    - "PAY HERE · 계산대 · الدفع هنا" wooden sign board instead.
    - Menus restyled the same way (easel, counter, table tents).
    - Front-of-house aprons (cashiers + servers): one plain deep green.
  - Main kitchen: proper dish station (two-bowl sink with pre-rinse spray, hood dishwasher, plate racks, sign), with a cook washing up.
  - Offer slide zoomed out so the whole poster reads.
  - New photo-spot slide (#5).
- **Still waiting on her:** real menu items + prices (placeholders in `src/config.js` → `MENU`).
- **Staff names:** Korean name tags, editable in `config.js` → `STAFF`.

## Waiting on / next
- Her real menu items + prices (`src/config.js` → `MENU`).
- Her feedback on the v1 previews, then "deploy".
- Ideas not done yet: grill smoke, steam, optional ambient sound.

## Tour scenes (v0)
1. Street
2. Entrance
3. Step inside: glides in through the front door, which swings open
4. Booths
5. Grill at the table
6. Soju bar & counter
7. Kitchen pass with the menu plaques
8. Floor plan: the camera rises up and the roof lifts off, with room labels

## How to edit
- **Name, sign words, scene titles and text, camera spots:** `src/config.js`.
- **Inside:**
  - `src/interior.js`: shell, booths, tables.
  - `src/cashier.js`: cashier corner + polaroid wall.
  - `src/kitchen.js`: live station + main kitchen.
  - `src/decor.js`: posters, neon, signs, greenery.
  - `src/crowd.js`: people + polaroid story.
  - `src/food.js`: dishes.
- **Outside:** `src/exterior.js`.
- **Colors and materials:** `src/materials.js`.
- **Procedural textures and signs:** `src/textures.js`.
- **Presentation logic:** `src/director.js`.
- **Look-around camera:** `src/spectator.js`.

## Performance (smoothness)
- **Auto quality** (`src/quality.js`): watches the frame rate and lowers or raises render resolution.
  - The bottom-bar button cycles **Auto / High / Low**. The choice is remembered per browser.
  - `?dpr=1` in the URL forces a fixed resolution (used for screenshots).
- **Edge smoothing:** SMAA instead of 4× MSAA, which was ~45% of every frame.
- **Auto quality** lowers resolution first; if still slow it turns ambient occlusion off (halves the draw work).
- **Lighter models:** prop/plant models decimated offline (352K → 150K triangles, same look).
- **No glare:** bloom only on real light sources (bulbs, neon, flames), capped so shiny steel never blows out.
  Kitchen steel is satin, not mirror.
- **Area lighting** (`src/lighting.js`): only lights near the camera are on, with a 0.6 s fade.
  - Street: street lights + the front-window interior lights.
  - Inside: interior lights only.
  - Floor plan: all lights.
- **Preloading:** textures, shaders for each lighting area, shadows and a warm-up draw of every scene all happen on the loading screen, so nothing stutters the first time.
  - It runs in small steps with breaks, waiting for the graphics chip without blocking. This fixed "Page unresponsive" (seen on a 2025 iPad, Nov 16).
  - The bar keeps moving with messages ("Preparing the street…", "Drawing the shadows…", "Final touches 3/12").
  - Loading also keeps going if the tab is in the background.
- **Lighter start** on iPads/phones and built-in laptop graphics: Auto starts at a lower resolution without ambient occlusion, then steps up if fast.
- **Lighter models:** simpler bottles, bowls and bulbs (225K → 140K triangles). The outside's static parts are merged.
- **Result:** same resolution, about half the frame time (measured in a software renderer).

## Deploying (Vercel)
- **Project:** `korean-resturant-proj-uni` (team "saxqb777's projects"), linked to this GitHub repo.
- **Auto-deploy is OFF** (`vercel.json` → `git.deploymentEnabled: false`).
  - Pushing code does **not** change the live site.
  - To update it, start a production deployment of the latest commit on purpose, only after the user says "deploy".
- `.vercelignore` keeps `PLAN.md`, `README.md` and `docs/` off the website.

## Run locally
Run a static file server from the repo folder. For example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Useful links:
- `?scene=3` opens on scene 3
- `?dpr=1` lowers resolution for slow laptops

## Changelog
- **2026-11-14:** v0 built.
  - Interior, exterior, tour + look-around.
  - Published as a private link for review.
- **2026-11-14:** v0 deployed to Vercel at https://korean-resturant-proj-uni.vercel.app (auto-deploy off).
- **2026-11-14:** smoothness pass (auto quality, FXAA, area lighting, preloading, lighter models).
  - Committed, **not yet deployed**. Waiting for the user's "deploy".
- **2026-11-15:** v1 built from her feedback (Seoulicious, 12 slides, 30 booths, cashier + polaroid story, live station, main kitchen, realistic people).
- **2026-11-16:** polish pass.
  - Glare fix (kitchen pass, steel counters), glass-look bulbs.
  - Livelier people (expressions, blinking, eye contact), 12 new avatars.
  - "Say Kimchi!" polaroid corner next to the polaroid wall.
  - Floor plan: every label visible.
  - Smoother: lighter models, smarter Auto quality.
- **2026-11-16:** v1 deployed to Vercel (production) on the user's go.
- **2026-11-16:** loading fix: no more "Page unresponsive" (sliced, non-blocking preparation), lighter start on iPad/phones/integrated graphics. Deployed.
- **2026-11-16:** her feedback round: plain cashier, dish station, offer slide zoom-out, photo-spot slide (13 slides). Deployed.
