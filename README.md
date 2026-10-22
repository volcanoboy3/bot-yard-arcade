# Bot Yard Arcade

A browser arcade with 23 robot-and-bee games.

## Robots and bees

- **Honey Island:** an untimed, saved 225-tile island with six regions, 30 missions, five building types (10 levels each), tools and bee-helper research, and four hours of offline production. Move with WASD/arrows or tap to walk; hold Space or Gather for resources. Select a shore tile to reclaim it.
- **Robot & Bee Factory:** the existing clicker now has 100 permanent upgrades, 12 machine types, a honey resource, bee helpers, and eight hours of offline production. Original factory saves carry forward.
- **Bee Volley:** first to five points, best of three rounds. Move with A/D or arrows and jump with Space; touch controls are available.
- **Nectar Derby:** three 30-second rounds against Bee-Bot. Gather flowers and bank nectar at the cyan hive. Use WASD/arrows or drag to steer.

Saves stay in the current browser. Run the progression tests with `node --test tests/*.test.cjs`.

## Run locally

Run `python3 -m http.server 8000` in this directory and open http://localhost:8000.

## Deploy

This is a static site. Deploy the repository root on Vercel using the Other framework preset, no build command, and `.` as the output directory.
