// Beat timing for FactAlone (videos/gym-alone): the start (seconds) of each story beat. The voice is not approved yet, so
// every beat is found by a piece of its line's text (scripts/alone-props.mjs), never by the line's number:
//   node scripts/alone-props.mjs videos/gym-alone/timeline.json > videos/gym-alone/out/factalone/props.json

/** defaults = the take of 2026-11-20 (v3, 25 lines) */
export const ALONE_BEATS = {
  hook: 0, // أكتر مكان في مصر مليان ناس: the full gym, everyone in big headphones
  alone: 2.82, // بس كل اللي فيه لوحدهم: the push lands, nobody looks at anybody
  gym: 5.68, // الجيم (whispered): the camera stops, everything freezes a beat
  forty1: 7.48, // أربعين واحد: rise to see them all, «40»
  forty2: 9.92, // وأربعين سماعة: the headphones light up in a wave
  talk: 12.01, // وأطول حوار: whip pan to the machine
  ask: 14.43, // خلصت عالماشين دي يا كوتش؟ the shy one taps his shoulder
  reply: 16.58, // لا.. لسالي مجموعة: the cold one doesn't look up
  newbie: 19.41, // واللي داخل لوحده أول مرة: over to the new guy by the door
  phone: 21.8, // بيعمل نفسه بيظبط الموبايل: he scrolls
  twenty: 24.74, // عشرين دقيقة: the wall clock runs 20 minutes
  up1: 26.85, // نبعد شوية: up out of the open roof (bird's eye)
  building: 28.43, // في العمارة اللي جنبك: the guy on the next building's balcony, same clock
  up2: 33.77, // نبعد كمان: way up over the whole area
  city: 35.45, // مليانة ناس زيه: lime rings light under people on roofs and streets
  but: 39.38, // بس..: the rings go grey
  noone: 40.94, // محدش يعرف التاني
  exists: 43.39, // البارتنر اللي بتدور عليه موجود: our two rings pulse
  apart: 46.88, // بس كل واحد في حتة: hold
  join: 49.54, // لحد ما جمعناهم: lime lines join the pairs
  app: 51.55, // قول بتتمرن إمتى وفين: down to the new guy, the real app on the phone
  coins: 55.61, // وكل تمرينة تحضروها سوا: the neighbour walks in, +1 coin over each
  secret: 60.56, // بس بيني وبينك: towards the man on the machine
  hour: 62.27, // ما يقعدش على الماشين ساعة: orbit, he's still there, cobwebs
  logo: 65.45, // تمرينة: the logo
};
export const ALONE_DURATION = 67.508;
export type AloneBeats = typeof ALONE_BEATS;

export type ABeats = AloneBeats & { end: number; fps: number };

export const makeAloneBeats = (beats: Partial<AloneBeats> | undefined, fps: number, durationSec: number): ABeats => {
  const b = { ...ALONE_BEATS, ...(beats ?? {}) };
  const F = Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * fps)])) as AloneBeats;
  return { ...F, end: Math.ceil(durationSec * fps - 1e-6), fps };
};
