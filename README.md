# Costa Mirada — Open-World Crime Story

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Humaedi95/costa-mirada/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Humaedi95/costa-mirada/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D open-world crime game built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). No Rockstar content, no real brands, no real city — everything here is invented: the sun-soaked coastal city of **Costa Mirada**, its people, and its story.

## The story

You are **Leo Marín**, a wheelman fresh out of prison, back in Costa Mirada. Your sister **Rosa** runs a small garage — and owes the wrong people money. Drive, fight and hustle through **10 story missions**, outrun the Costa Mirada police, and take back the city, one job at a time.

## Features

- **Open world, 3D (three.js):** a 480×480 m grid city — Old Town Plaza, Marina Bay beach + pier, Palm Heights, Dockside, Sunset Strip — with day/dusk/night lighting, palms, parks and streetlights.
- **10 story missions** in sequence, each with objectives, a marker beacon, dialogue, checkpoints and a cash reward: homecoming, car theft, debt collection, a car chase, a beach brawl, taxi driving, a street race, a police-evading delivery, a repo-men shootout, and the finale.
- **Drive & steal cars:** 7 car models, arcade handling, handbrake, damage. Press **E** near any car to steal it (the cops notice).
- **Living city:** AI traffic that follows the road grid, pedestrians who walk the sidewalks and flee from gunfire.
- **Wanted system:** 5 stars. Police cars chase and ram you; foot cops chase, punch and try to bust you. Lose them by breaking line of sight.
- **Combat:** punch (**F**) and hitscan shooting (mouse click) with ammo, tracers and synthesized sound.
- **HUD + minimap:** objectives, distance, wanted stars, cash, clock, health, speedometer and a live circular minimap (roads, police, traffic, enemies, mission marker).
- **Side activities:** taxi fares at Old Town Plaza and hidden cash pickups around the city.
- **Save / load:** progress, money, health, ammo and mission state autosave to localStorage.
- **Synth audio:** WebAudio music loop (bass + pads + hats), engine hum, sirens and SFX — no audio files.
- **Screens:** start menu with mission list, pause, WASTED, and a story-complete screen; free-roam mode included.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse | Look (click to lock pointer) |
| E | Enter / exit car |
| F | Punch |
| Click | Shoot |
| Shift | Sprint |
| Space | Handbrake |
| R | Unstick car |
| P | Pause |
| M | Mute |

## Play it

```bash
node serve.ts
# open http://localhost:8080
```

100% offline: three.js is vendored under `game/vendor/`, all other code is plain ES modules in `game/src/`. No network requests at runtime.

## Tech

- three.js r160 (vendored, MIT)
- Vanilla JS + WebAudio, no build step
- Screenshots staged with `?scene=cover|onfoot|mission|dusk`

## License

MIT — see [LICENSE](LICENSE).
