# Bot Yard Arcade

A browser arcade with 23 robot-and-bee games.

## Robots and bees

All 23 arcade games have bee-themed art, tokens or characters. The Bee Boutique has 20 full character skins (including bumblebee, queen bee, ladybug, butterfly, cat, fox, bear, frog, bunny, panda, dragon, dinosaur, flower, mushroom, astronaut, knight, pirate, wizard, cactus and walking beehive), plus the classic robot. These skins change the whole silhouette and have their own colours and features. They are separate from the 50 paint styles. It also lets players preview and buy robot head/body shapes, accessories, names and custom pixel paint. Paint tiers cost 25 / 65 / 150 / 320 / 650 bee coins, with the starter cyan free. Renaming costs 20. Custom drawings are priced from their colour count and detail; owned cosmetics are free to equip again. Existing players keep their currently equipped look. Signed wallets migrate in place without spending coins. Paint, custom paint, and mechanical shape/drive choices switch to the classic robot so those changes are visible; accessories can be combined with character skins.

Random deliveries give 5–12 coins after roughly 20–35 seconds of active play. Menus, idle time, pause screens and offline factory production do not earn coins. Coin rewards are independent of score. The local wallet signs coin and inventory saves using a non-exportable Web Crypto key stored in IndexedDB, and serializes purchases across tabs using Web Locks. Basic input checks reject script-dispatched gameplay events, pause rewards for 30 seconds after excessive or mechanically regular clicking, and reject implausible scores. These are local deterrents, not authoritative server anti-cheat; a determined person controlling the browser can bypass them. No permanent bans or confiscation are applied. A failed wallet integrity check freezes earning and spending until repaired or restored. A fresh-wallet repair resets only coins and cosmetics, not game progress.

- **Honey Island:** an untimed, saved 225-tile island with six regions, 30 missions, five building types (10 levels each), tools and bee-helper research, and four hours of offline production. Move with WASD/arrows or tap to walk; hold Space or Gather for resources. Select a shore tile to reclaim it.
- **Robot & Bee Factory:** the existing clicker now has 100 permanent upgrades, 12 machine types, a honey resource, bee helpers, and eight hours of offline production. Original factory saves carry forward.
- **Bee Volley:** first to five points, best of three rounds. Move with A/D or arrows and jump with Space; touch controls are available.
- **Nectar Derby:** three 30-second rounds against Bee-Bot. Gather flowers and bank nectar at the cyan hive. Use WASD/arrows or drag to steer.

Saves stay in the current browser. Run the progression tests with `node --test tests/*.test.cjs`.

## Run locally

Run `python3 -m http.server 8000` in this directory and open http://localhost:8000.

## Deploy

This is a static site. Deploy the repository root on Vercel using the Other framework preset, no build command, and `.` as the output directory.
