# Sound effects (copied from GymBros social-media/partner-wheel/render/assets/sfx-lib, owner-approved set 2026-10-23)
- el-* : crafter-station/elements (CC0)
- k-*  : Kenney.nl packs (CC0)
- the rest (mx-*, check-click, coin-*, msg-pop, whoosh-fast): Mixkit free license (no credit needed)
Trimmed to start at the onset, max 1.4 s, peak-limited. Mapping: brands/tamrina/brand.json -> "sfx".
- trend/ (owner-approved "trending" set, 2026-10-28): 01-08 and 15-20 are Mixkit free license (no credit needed; the
  -cut / -1s files are trims). 09-14 (vine boom, record scratch, sad trombone, bruh, metal pipe, crowd ooh) are meme
  sounds from myinstants.com: origin and licence unknown, used everywhere on TikTok / Reels; the owner chose to use them.
- candidates/: generated with ElevenLabs sound effects (owner's account), 2026-10-28. Not used yet.
- whistle, bonk: made for this project with ffmpeg (a sine with vibrato / a falling sine), 2026-10-28. Own work, CC0.
- trend/07-impact-deep-phone, trend/08-impact-big-phone (2026-11-14): the same two Mixkit impacts with a quiet 0.9-2.6 kHz layer that follows the bass, made with ffmpeg, so the hit is heard on a phone speaker (the originals are almost all below 150 Hz). Not owner-approved yet: he judges them by ear on a phone.

## iba-zumba (2026-11-16)
- `iba-zumba/clap-a.mp3`, `clap-b.mp3`: Mixkit "One clap" (sfx 481, https://mixkit.co/free-sound-effects/clapping/), Mixkit Sound Effects Free License (free for commercial use, no attribution). Trimmed to the single stroke; `-b` is the same recording resampled 7 % lower. earshot: "a single hand clap" z +3.9 strong; realness "uncertain" (p_real 0.18 on a 48 ms stroke with padding, kept: it is a library recording).
- `iba-zumba/clack.mp3`: earshot bank `knock/wood`, made in code (not a recording).

## zander-gym (2026-11-16)
- `zander-gym/flash.mp3` (= `poof` + `shutter` 60 ms later), `poof.mp3`, `shutter.mp3`, `tick.mp3`, `door.mp3`, `clank.mp3`: earshot bank (`pro_pop_in/deep`, `shutter/film`, `fit/tick/domino`, `knock/wood` at C4, `impact/metal` trimmed to 0.7 s), made in code, not recordings. `frame.mp3` = `iba-zumba/clack.mp3`. Not owner-approved yet; a real old flash-powder / door-creak recording was not sourced.

## waffarha-tunnel (2026-11-19)
Library sound effects only (no code-made sounds), trimmed (scratchpad tool, numpy), mono, peak -1 dBFS, 48 kHz mp3 192k. "-N st" = resampled N semitones (pitch + speed). Not owner-approved yet. Most are field / foley recordings; the whooshes, pops, `energy-swell` and `courts-rise` ("Magical stone slide") are designed library sounds. earshot realness on the final files: "uncertain" for `bed-rush-a` (0.30), `pull-back` (0.47), `pop-question` (0.56), `flyby-b` (0.71), `gate-impact` (0.74); "likely code-synthesized" for `bed-rush-b` (0.17, steady wind noise, high-passed); every other file "real or pro-produced".
Mixkit (Mixkit Sound Effects Free License: free for commercial use, no attribution; https://mixkit.co/license/#sfxFree), source page = https://mixkit.co/free-sound-effects/ item id below:
- `bed-rush-a`, `bed-rush-b`: Mixkit 2658 "Wind blowing ambience" (5.0-9.6 s / 10.0-18.6 s, high-pass 120 Hz). Broadband wind reads close to synthetic noise for earshot; kept as a library recording, no better real tunnel-rush recording found.
- `flyby-a`, `swish-low` (-4 st): Mixkit 1469 "Flying fast swoosh". `flyby-b`: Mixkit 1489 "Air woosh". `flyby-c`, `dive-whoosh` (-2 st): Mixkit 2625 "Fast air zoom". `pull-back` (-3 st): Mixkit 167 "Long sweeping air swoosh". `up-whoosh` (-3 st): Mixkit 2632 "Whoosh wind sweep".
- `gate-impact`: Mixkit 2980 "Factory metal hard hit". `pile-clatter`: Mixkit 397 "Plastic rubbish objects falling". `card-slap`: Mixkit 2167 "Short slap or clap".
- `pop-shop-1/2/3` (0/+2/+4 st), `pop-question` (-5 st): Mixkit 2358 "Long pop". `pop-tag-1/2/3` (0/+2/+4 st), `pop-mark-1/2` (-3/-1 st): Mixkit 2356 "Dry pop up notification alert".
- `energy-swell`: Mixkit 2589 "Shot light energy flowing". `glass-shatter`: Mixkit 759 "Glass break with hammer thud". `shatter-rebuild`: Mixkit 1551 "Car window breaking", reversed. `lock-in`: Mixkit 2858 "Gear metallic lock sound".
- `door-slide`: Mixkit 1908 "Cupboard soft sliding door". `gate-glide-1/2` (+2/+4 st): Mixkit 182 "Lightweight sliding door close" (the slide, before the close). `courts-rise`: Mixkit 1528 "Magical stone slide".
- `paper-swish`: Mixkit 2380 "Paper quick movement". `ball-kick`: Mixkit 2112 "Hitting soccer ball". `pin-drop`: Mixkit 2070 "Light impact on the ground".
Freesound, Creative Commons 0 (checked on each sound's page: creativecommons.org/publicdomain/zero/1.0/; no attribution required, credited here anyway):
- `tyre-squeal`: "Tires Squeaking.aif" by RutgerMuller, https://freesound.org/s/104026/ (earshot realness "uncertain" p_real 0.60, a tonal squeal; kept: a field recording).
- `chain-sway`: "Chain Rattling - 1" by Roxis_Boy, https://freesound.org/s/401622/
- `padlock-rattle`, `padlock-clink-1/2/3` (0/-2/-4 st): "Lock rattle 5.wav" by deleted_user_2104797, https://freesound.org/s/164670/
- `paper-tear`: "TearingPaper11" by falcospizaetus, https://freesound.org/s/489968/
- `padel-hit`: "padel 2 edit" by Luisa_Sanchez, https://freesound.org/s/816833/
- `footsteps`: "Footsteps, Tile, Male Sneakers, Slow Pace.wav" by SpliceSound, https://freesound.org/s/170506/ (two steps layered 0.32 s apart, soft-limited +9 dB).
