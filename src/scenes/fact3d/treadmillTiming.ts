// Beat timing for FactTreadmill (videos/treadmill-prison): the start (seconds) of the WORD each beat
// lands on, found by text (scripts/treadmill-props.mjs), so a new take needs no code change:
//   node scripts/treadmill-props.mjs videos/treadmill-prison/timeline.json > videos/treadmill-prison/out/facttreadmill/props.json

/** defaults = placeholder timing (will be replaced from actual voice) */
export const TREADMILL_BEATS = {
  hook: 0,          // السير: open on a dark corridor, the treadwheel looms ahead
  gym: 1.0,         // الجيم: quick flash of a modern treadmill (the irony)
  not: 2.1,         // مكانش: the modern treadmill fades, back to darkness
  punish: 3.6,      // عقاب: the prison bars slam, the wheel revealed in full
  year: 4.3,        // 1818: the year appears as a neon sign
  england: 5.3,     // إنجلترا: a Union Jack ripple or British prison gate

  engineer: 7.0,    // المهندس: Cubitt appears, presents the wheel design
  wheel: 8.2,       // طاحونة: the wooden treadwheel mechanism shown close
  walk: 9.0,        // يمشوا: prisoners start walking
  six: 9.8,         // ست ساعات: «6h» counter / clock
  grind: 10.8,      // يطحنوا: wheat grain falling, mill turning
  torture: 12.0,    // تعذيب: a jolt, the camera shakes
  energy: 12.8,     // طاقة: gears glow with energy, light pulses through the wheel

  harsh: 15.0,      // قاسي: close on a prisoner's face, exhausted
  banned: 16.0,     // اتمنع: the prison bars break apart, the wheel cracks
  law: 16.5,        // قانون: a gavel / decree stamp
  year2: 17.2,      // 1902: the year as a neon sign (old one shatters)
  us: 18.5,         // نيجي إحنا: whip pan to a bright modern gym
  pay: 19.3,        // ندفع فلوس: a price tag / card appears
  run: 20.2,        // نجري: a person running on the modern treadmill
  wall: 21.5,       // الحيطة: close on the wall they stare at, zoom into boredom

  bored: 23.0,      // زهقت: start of scene 4, the runner sighs
  coin: 24.0,       // Mr. Coin walks in
  app: 25.5,        // تمرينة: the lime wave
  match: 26.5,      // ماتش: a ball bounces / a class appears
  thumb: 27.5,      // تعاقب: thumbs up from the coin
};

export const TREADMILL_DURATION = 29.0;
export type TreadmillBeats = typeof TREADMILL_BEATS;
export type TBeats = TreadmillBeats & { end: number; fps: number };

export const makeTreadmillBeats = (
  beats: Partial<TreadmillBeats> | undefined,
  fps: number,
  durationSec: number,
): TBeats => {
  const b = { ...TREADMILL_BEATS, ...(beats ?? {}) };
  const F = Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * fps)])) as TreadmillBeats;
  return { ...F, end: Math.ceil(durationSec * fps - 1e-6), fps };
};
