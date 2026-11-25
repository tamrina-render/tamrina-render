// Beat timing for FactWaffarha: everything comes from the 5 line starts + a few word times (seconds) + the times of
// Mr. Coin's {scroll} cues. A new take (draft-timeline.json, later timeline.json) only needs new props:
// node scripts/waffarha-props.mjs <timeline.json> > videos/waffarha-story/out/factwaffarha/props.json

/** beat starts (the voiced take of 2026-11-17): 0 كنت · 1 مكان · 2 عشان · 3 ومش · 4 الأبلكيشن (the line «أبلكيشن مصري…» starts on the word app3) */
export const WAFFARHA_STARTS = [0, 6.88, 12.28, 23.6, 30.59];
export const WAFFARHA_WORDS = {
  ask: 2.53, // وسألت: the scroll stops, he looks up
  qs: 5.39, // للجيمات: a dumbbell + a ball with «؟» on the screen
  gym2: 8.11, // الجيمات: the gym pops on the screen
  acad2: 8.58, // والأكاديميات: the academy (the studio follows)
  free: 10.01, // ببلاش: the gym door opens, «أول حصة ببلاش»
  tam: 13.44, // تمرينة: the screen flips to lime; the lime screen + logo hold through the pause after the line
  app3: 15.01, // أبلكيشن: the screen comes down and becomes the street just before this word
  gyms3: 15.32, // جيمات: the street's gyms light up
  acad3: 15.75, // أكاديميات
  courts: 16.31, // ملاعب: the padel court at the end of the street lights up
  coupon: 20.17, // كوبونات: a paper coupon flies by, ✕
  padel: 23.99, // بادل: the 4th player runs into the empty spot
  lazy: 24.39, // مكسل: the camera goes to the gym door
  find: 25.97, // هتلاقيهم: the real app screen next to him
  obour: 29.99, // العبور: Obour lights lime, the pin
  now: 30.73, // دلوقتي: the «؟» marks pop one by one
  where: 32.19, // نفتح: he points at the camera
};
export const WAFFARHA_SCROLL = [0];
export const WAFFARHA_DURATION = 38.602;
/** the app screen on the floating screen (placeholder until the owner's recording) and the real Tamrina screen */
export const WAFFARHA_APP = "footage/waffarha-story/waffarha-app.mp4"; // the owner's screen recording (a .png still is panned instead)
export const WAFFARHA_FEED = "footage/waffarha-story/feed.jpg";
export const WAFFARHA_LOGO = "footage/waffarha-story/tamrina-logo.png";

export type WaffarhaWords = typeof WAFFARHA_WORDS;

/** seconds of one {scroll} cue in src/lib/speech.ts, and its flick period in Coin3D (outfit "phone") */
export const SCROLL_DUR = 2.4;
export const FLICK_T = 0.48;

export type WBeats = {
  s: number[];
  w: WaffarhaWords;
  /** frames where the thumb flicks (the app screen steps up one card) */
  flicks: number[];
  /** the screen flips to lime (12 frames), comes down and grows to the full frame, the room is swapped for the street
   *  under it, then it fades and the street is there. All done before the street's first light (gyms3) */
  flip: number;
  growA: number;
  growB: number;
  swap: number;
  revealB: number;
  /** camera: street -> padel court (line 4 start), court -> gym door (مكسل), door -> map (line 5 start) */
  t1A: number;
  t1B: number;
  t2A: number;
  t2B: number;
  riseA: number;
  riseB: number;
  /** the 4th player runs in (ends on بادل) */
  runA: number;
  runB: number;
  /** the phone card next to him */
  cardIn: number;
  cardOut: number;
  end: number;
  fps: number;
};

export const makeWaffarhaBeats = (starts: number[] | undefined, words: Partial<WaffarhaWords> | undefined, scroll: number[] | undefined, fps: number, durationSec: number): WBeats => {
  const s = WAFFARHA_STARTS.map((d, i) => Math.round((starts?.[i] ?? d) * fps));
  const ws = { ...WAFFARHA_WORDS, ...(words ?? {}) };
  const w = Object.fromEntries(Object.entries(ws).map(([k, v]) => [k, Math.round(v * fps)])) as WaffarhaWords;
  const end = Math.round(durationSec * fps);
  // thumb flicks: one per FLICK_T inside each scroll cue (a cue is cut short by the next one)
  const sc = [...(scroll ?? WAFFARHA_SCROLL)].sort((a, b) => a - b);
  const flicks: number[] = [];
  sc.forEach((t0, i) => {
    const t1 = Math.min(t0 + SCROLL_DUR, sc[i + 1] ?? Infinity);
    for (let t = t0 + FLICK_T / 4; t < t1 - 0.3; t += FLICK_T) flicks.push(Math.round(t * fps));
  });
  // the morph: starts on تمرينة, must be over before the first street light and well before line 4
  const flip = Math.max(s[2] + 2, w.tam - 3);
  const last = Math.min(w.gyms3 - 6, s[3] - 20);
  const growA = Math.min(Math.max(flip + 14, w.app3 - 16), last - 24);
  const growB = growA + 14;
  const swap = growB + 1;
  const revealB = Math.min(swap + 10, last);
  const t1A = s[3] + 3;
  const t1B = Math.min(t1A + Math.round(1.6 * fps), w.padel - 22);
  const t2A = Math.max(t1B + 4, w.lazy - 3);
  const t2B = Math.min(t2A + Math.round(1.3 * fps), w.find - 4);
  const riseA = s[4] + 1;
  const riseB = riseA + Math.round(1.5 * fps);
  return {
    s,
    w,
    flicks,
    flip,
    growA,
    growB,
    swap,
    revealB,
    t1A,
    t1B,
    t2A,
    t2B,
    riseA,
    riseB,
    runA: w.padel - 22,
    runB: w.padel + 2,
    cardIn: w.find - 3,
    cardOut: s[4] - 2,
    end,
    fps,
  };
};
