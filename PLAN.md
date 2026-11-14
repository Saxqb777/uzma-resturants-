# UZMA restaurant: plan & decisions

This file is the project's memory. Any new chat should read it first.

## Goal
- A 3D restaurant for a sister's project, showing her restaurant business: the space, the staff, the menu and people eating.
- Shown like a **presentation**: `Enter` moves to the next scene.
- `V` switches to a free **look-around** mode (spectator camera).

## Decisions so far
- **Tech:** three.js in the browser. Nothing to install, it opens from a link and runs on a normal laptop.
- **Look:** stylized but warm and moody, matched to her 4 reference photos (retro Korean BBQ / pocha).
  - Inside: dark open ceiling, wooden high-back booths, little rusty tin roofs over the booths, yellow-framed windows, soju bottle shelves, hand-painted retro signs, bare bulbs, a grill in every table.
  - Outside: a mix of her two storefront photos. Wooden front, brick, rusty tin awning, painted billboard, black tiled hanok eave, vertical lightbox sign, lantern, steps, menu boards.
  - The street around it is "little vibes" only.
- **Signs:** all original wording. No real brands or logos copied from the photos.
- **Name:** `우즈마 / UZMA` is a placeholder taken from the repo name. Change it in `src/config.js`.
- **Workflow rule:** show visuals before big work. Never make big changes without a final OK from the user.

## Status
- **v0 (done, waiting for her feedback):**
  - Live link (private): https://claude.ai/artifact/7VsVhKtA44W7rnQExD1TKk
  - Preview of all 8 scenes: `docs/v0-preview.jpg`
  - The room, bar, kitchen and storefront are built.
  - 8 tour scenes, look-around mode, floor-plan view.
  - No people yet.

## Next (to discuss after she sees v0)
- **v1:** staff (host at the counter, cooks in the kitchen, a server in the aisle) and people eating at a few tables.
  - Simple stylized figures, with idle animation.
- **Menu:** a proper menu scene, e.g. a menu card close-up or dishes on the table.
- **Camera:** her final scene list, wording and camera angles.
- **Polish ideas:** grill smoke, steam from stews, ambient sound (optional, button to start), day/night switch.

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
- **Inside:** `src/interior.js`.
- **Outside:** `src/exterior.js`.
- **Colors and materials:** `src/materials.js`.
- **Procedural textures and signs:** `src/textures.js`.
- **Presentation logic:** `src/director.js`.
- **Look-around camera:** `src/spectator.js`.

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
