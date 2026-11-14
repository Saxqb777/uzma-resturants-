# UZMA Korean BBQ: 3D restaurant tour

A walk-through 3D restaurant that runs in the browser (three.js, no build step).

## Controls
| | |
|---|---|
| `Enter` / `→` / `Space` | next scene |
| `←` / `Backspace` | previous scene |
| `1`–`8` | jump to a scene |
| `V` | look-around mode on/off |
| `H` | hide the text |
| `F` | full screen |

In look-around mode:
- **Look:** drag
- **Fly forward or back:** scroll
- **Move:** `WASD`
- **Down / up:** `Q` / `E`
- **Fly to a spot:** double-click
- **Roof on or off:** `R`

## Run it
```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Change the name, sign words and tour scenes in `src/config.js`. See `PLAN.md` for decisions and next steps.
