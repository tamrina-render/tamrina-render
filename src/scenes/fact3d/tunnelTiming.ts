// Beat timing for FactTunnel (videos/waffarha-tunnel): everything comes from the 6 line starts + named word times
// (seconds). A new take only needs new props:
//   node scripts/tunnel-props.mjs videos/waffarha-tunnel/timeline.json > videos/waffarha-tunnel/out/facttunnel/props.json

/** line starts of the approved take (2026-11-19): 0 ليه · 1 يعني · 2 السؤال · 3 أبلكيشن · 4 ومش · 5 الأبلكيشن */
export const TUNNEL_STARTS = [0, 7.41, 17.29, 20.96, 30.13, 38.23];
export const TUNNEL_WORDS = {
  hundred: 1.61, // 100: a burst of % tags
  down: 3.89, // تنزل: the track ends at the locked gym gate, hard brake
  gym1: 4.28, // الجيم: the shake, the red card drops
  pay: 5.46, // تدفع: the card swings once more
  waff: 9.4, // وفّرها: the first open shop pops
  rest: 9.78, // للمطاعم
  outings: 10.32, // والخروجات
  gyms: 12.22, // للجيمات: the dark gym pops
  courts: 12.76, // والملاعب: the locked court
  acads: 13.33, // والأكاديميات: the dark academy
  free: 15.0, // حصة (ببلاش): the big «؟» rises
  tam: 19.27, // تمرينة: lime wave, the gate shatters, the shards build the lit gym
  gyms5: 23.4, // جيمات: a gym gate opens for us
  acad5: 23.86, // أكاديميات: an academy gate opens
  courts5: 24.77, // وملاعب: padel court + football pitch rise from the ground
  offers: 26.02, // وعروض: lime % tags pop on every venue
  coupon: 29.04, // كوبونات: a paper coupon flies at us, ✕
  ball: 32.57, // كورة: the kick on the pitch
  padel: 33.03, // بادل: the camera tilts on to the padel court
  lazy: 33.79, // مكسّل: the lonely man at the gym door
  alone: 34.78, // لوحدك
  find: 35.59, // هتلاقي: friends walk in
  people: 35.96, // ناس (the second one)
  obour: 41.09, // العبور: Obour lime + pin
  now: 41.66, // دلوقتي: the «؟» marks pop one by one
  where: 44.52, // نفتح فين
};
export const TUNNEL_DURATION = 46.611;
export type TunnelWords = typeof TUNNEL_WORDS;

export type TBeats = {
  s: number[];
  w: TunnelWords;
  /** the map shows (rise end) and the loop dive starts (the last frames fly back into frame 0) */
  riseA: number;
  riseB: number;
  loopA: number;
  end: number;
  fps: number;
};

export const makeTunnelBeats = (starts: number[] | undefined, words: Partial<TunnelWords> | undefined, fps: number, durationSec: number): TBeats => {
  const s = TUNNEL_STARTS.map((d, i) => Math.round((starts?.[i] ?? d) * fps));
  const ws = { ...TUNNEL_WORDS, ...(words ?? {}) };
  const w = Object.fromEntries(Object.entries(ws).map(([k, v]) => [k, Math.round(v * fps)])) as TunnelWords;
  const end = Math.ceil(durationSec * fps - 1e-6);
  const riseA = s[5] + 1;
  const riseB = riseA + Math.round(1.5 * fps);
  return { s, w, riseA, riseB, loopA: end - Math.round(0.6 * fps), end, fps };
};
