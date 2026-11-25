// Beat timing for FactBus (videos/bus-conductor): the start (seconds) of the WORD each beat lands on, found by text
// (scripts/bus-props.mjs), so a new take needs no code change:
//   node scripts/bus-props.mjs videos/bus-conductor/timeline.json > videos/bus-conductor/out/factbus/props.json

/** defaults = the approved take of 2026-11-21 */
export const BUS_BEATS = {
  hook: 0, // كمسري الأتوبيس: the conductor running up the stairs, the bus driving through night London
  driver: 2.48, // السواق: slide along the bus to the driver in his cab
  stairs: 3.86, // سلّم: whip back, the steps light up
  years: 5.24, // من أكتر من سبعين سنة: rise to the whole bus, the colour drains, «+70»
  doctor: 7.07, // دكتور: the bus pulls in at the stop, the doctor with his clipboard
  compare: 8.75, // قارن: orbit, rings under the driver and the conductor
  decks: 10.5, // أبو دورين: the two decks light up
  cond2: 11.19, // والكمسرية
  sit: 12.54, // السواق قاعد: close on the driver
  shift: 13.67, // الوردية: the cab clock runs a whole shift
  climb: 14.7, // والكمسري: whip to the stairs, up and down
  tickets: 16.22, // يقطع تذاكر: tickets fly
  result: 17.67, // والنتيجة: dolly zoom on the bus
  attacks: 18.92, // الأزمات القلبية: four red hearts over the driver
  cond3: 20.06, // عند الكمسارية: two over the conductor
  half: 21.55, // النص: «½»
  free: 24.15, // ببلاش: the conductor again, a «0 جنيه» tag
  us: 26.13, // وإحنا: whip pan to a gym today, full colour
  pay: 26.78, // اشتراك: the price card
  steps: 27.85, // سلم: the stair machine
  coin: 29.01, // the coin's line: back at the stop, Mr. Coin walks in
  likeDriver: 30.84, // زي السواق: the driver waves from the cab
  post: 33.0, // بوست: the destination sign turns into the real running post
  app: 33.77, // تمرينة: the lime wave
  near: 34.72, // قريب: a runner jogs in (2/4)
  join: 35.52, // ينزل: a second one (3/4)
  yalla: 36.72, // يلا: the bell rings, the conductor leans out
  tix: 37.6, // التذاكر: tickets burst over the runners
};
export const BUS_DURATION = 39.645;
export type BusBeats = typeof BUS_BEATS;
export type BBeats = BusBeats & { end: number; fps: number };

export const makeBusBeats = (beats: Partial<BusBeats> | undefined, fps: number, durationSec: number): BBeats => {
  const b = { ...BUS_BEATS, ...(beats ?? {}) };
  const F = Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * fps)])) as BusBeats;
  return { ...F, end: Math.ceil(durationSec * fps - 1e-6), fps };
};
