// Shared data model. timeline.json (built by scripts/make.mjs) is the single input of the Reel composition.

export type Word = {
  w: string;        // the word as spoken (marks stripped)
  start: number;    // seconds, absolute in the final voice track
  end: number;
  emph?: boolean;   // was wrapped in *asterisks* in the script -> red italic + motion event
};

export type EventKind = "zoomKick" | "whipPan" | "pop" | "shake" | "flash";
export type MotionEvent = { t: number; kind: EventKind; strength?: number; dir?: 1 | -1 };

export type Visual = { type: string; props?: Record<string, any> };

export type Scene = {
  id: string;              // "01"
  index: number;
  label: string;           // "the account"  -> rendered as "// 01 · the account"
  counter?: { key: string; from?: number | string; to?: number | string; suffix?: string };
  start: number;           // seconds
  end: number;
  say: string;             // narration with *emphasis* marks
  words: Word[];           // words of this scene (absolute times)
  visual: Visual;
  events: MotionEvent[];   // scene-local motion events (absolute times)
  pose?: string;           // presenter hand pose override
  gesture?: "point" | "thumb" | "hip" | "wave" | "none"; // coin hand gesture for this scene (default: auto)
  speaker?: string;        // who says this scene: "mr" | "mrs" (duo) or a cast id (cast of copies)  // duo videos: who says this scene (voice, mouth, accent colour)
  accent?: string;         // duo videos: the speaker's accent for this scene's headline + visual
  place?: string | Record<string, string>; // coin placement: preset name, or per character {"mr": "left", "mrs": "zoom"}
  turn?: number;           // coin: degrees to turn this scene (+ = toward screen right, 180 = back to the camera), eases from the last scene's angle
  fly?: boolean | { dur?: number; arc?: number }; // false = slide to the new place instead of flying there; {dur, arc} = a slower / higher flight (s, px)
  sign?: string;           // {sign}: the text on the sign the coin holds up, or a picture: a path under public/ (1024x440)
  behind?: boolean | number; // the card covers the coin this scene (a number = only its first N s: he jumps out from behind it) (hides him behind a logo); back from "off" he is already in place, no flight
  peekEdge?: number;       // {peek}: the x (frame px) of the edge he hides behind (default 965 = a card's right edge; a logo: its right edge)
  freeze?: string;         // {freeze}: the meme label shown on the freeze frame
  headline?: false;        // false = this line is heard but not written (no headline / karaoke for this scene)
  seam?: "cut";            // hard cut INTO this scene instead of the sliding seam (bursts, the end card)
  fade?: number;           // script "seam": "fade": a fade through black into this scene (a time skip); total seconds, half out + half in, the cut sits under the black
  creep?: number;          // slow creep zoom: the picture (footage + coins, not the text) eases to this zoom by the scene's end (1.03-1.12); the next scene without it eases back
  // a named edit from reel Dfm3n64k4-K (src/components/Edits.tsx EDITS): script "edit": "orbit" or { "type": "orbit", ...props };
  // one per scene, eases in / out with the scene. An unknown type draws nothing
  edit?: { type: string; [prop: string]: any };
  slowmo?: { t0: number; t1: number; rate: number }; // one slow-motion beat (absolute s): slowest (rate) in the middle, on real time again at both ends
  look?: "none" | "silent" | "gameshow"; // film look for this scene (overrides the video's look), see src/lib/looks.ts
  judge?: string;          // gameshow look: the word {judge} stamps (default "PERFECT!")
  outfit?: string[] | Record<string, string[]>; // this scene's outfit (overrides presenter.outfit)
  kit?: KitSpec;           // this scene's jersey kit (overrides presenter.kit), e.g. { "color": "#E23B3B", "number": 5 }
  seated?: boolean | Record<string, boolean>;  // this scene: sits / stands (per coin {"mr": false}), overrides the cast "seated"
  ride?: Record<string, RideCfg>;  // this scene: a coin rides a moving part of the footage (per coin {"mrs": {...}}), see RideCfg
  floor?: boolean;                 // false = no floor under the coins this scene: no contact shadow, no glow (he sits on something above the ground, like Instagram's like button)
  dumbbell?: number | Record<string, number>;  // this scene's dumbbell size (per coin {"mr": 2.4}), overrides the cast "dumbbell"
  hinge?: number | Record<string, number>;     // outfit "barbell": how far he bends over with it, 0 = standing .. 1 = bar at the shins (per coin {"mr": 0.6}); kept until a later scene sets it, eases in over 0.7 s
  // real video/photo behind the scene (file under public/): from/dur in s (no "from" = continue the previous scene's clip), caption = the real person's line,
  // light: false = don't light the coin like this footage (graphics, maps), probe = light + face measured by make.mjs
  footage?: { src: string; band?: false /* no dark band at the top (a plain white set) */; hold?: boolean /* a photo that does not drift, so the coin stays planted and the picture never jumps between scenes */; from?: number; dur?: number; caption?: string; volume?: number; light?: boolean; probe?: { plate?: { sat: number; lum: number; sharp: number } /* the picture's median saturation and brightness (0..1) and edge strength */; light?: { x: number; color: string; level: number }; face?: { x: number; y: number; w: number } } };
  watch?: string[];        // coin: points in the footage ("x,y" reel px) his eyes dart to while he is silent; "x,y,t" = timed: from t s after the scene start his eyes go there even while he talks ("-1,0,t" = back to the camera)
  lookAt?: string;         // coin: "x,y" (reel px) to look at, or "camera"; default = the face found in the footage
  // cast: where each coin looks (script "look": {...}, an object; a string "look" is the film look): {"red5": "red6", "captain": "camera"}
  // target = a cast id | "speaker" | "camera" | "ball" | "x,y". Unset coins react on their own (Coin3D castAim)
  gaze?: Record<string, string>;
  // cast: the scene camera. "wide" = off, "speaker" / a cast id = push in on that coin, or {on, zoom, dur}. Default in a cast: the speaker
  camera?: "wide" | string | { on?: string; zoom?: number; dur?: number };
  moods?: { t: number; mood: Mood; temp?: boolean }[];  // temp = a {face} cue: lasts until the scene ends
  cues?: { t: number; name: string }[];   // {cue} animations: gestures, actions, fx (absolute times)   // presenter face from [tags] in `say` / scene "mood" (absolute times)
};

export type Mood = "neutral" | "happy" | "laugh" | "excited" | "surprised" | "curious"
  | "sad" | "cry" | "angry" | "annoyed" | "smug" | "shocked" | "love" | "starry" | "sleepy" | "dizzy" | "shy" | "nervous" | "wink"
  | "determined" | "proud" | "bored" | "relieved" | "disgusted" | "zen" | "peek" | "resigned";

/** a football kit for the "jersey" outfit: shirt colour, the number on chest and back, a captain's armband */
export type Kit = { color?: string; number?: number | string; captain?: boolean };
/** one kit for whichever coin is on screen, or one per coin by id ({ mr: {...}, mrs: {...}, captain: {...} }), like "outfit" */
export type KitSpec = Kit | Record<string, Kit>;

/**
 * One coin in a cast of copies (presenter.cast / script.cast): the base coin ("plain") or a preset ("mr", "mrs"), with
 * overrides. Everything else (body, rig, moods, moves, life layer, lip-sync, outfits, jersey) is the same component.
 */
export type CastMember = {
  mocap?: { src: string; person?: "left" | "right" | number; offset?: number }; // copy a real person from a video: scripts/mocap.py -> public/<src>; offset = s added to the clip time (PLAYBOOK §3.1)
  dangle?: boolean;                // with "seated": the legs hang below the seat and swing in turn (a kid on a swing)
  /** the leg press: px "x,y". "push" lies on the bench with his feet on the sled, "ride" sits on the sled (his place = where he sits when the sled is at "low"). Both coins carry the same low / high / bench */
  press?: { role: "push" | "ride"; low: string; high: string; bench: string; floor?: number; period?: number; lean?: number /* radians, + = head to the left */; leg?: number /* leg length, shorter = less knee */; mesh?: boolean /* false = the machine is in the photo: nothing drawn; low = high keeps it still */ };
  id: string;                      // the name scenes and cues use: "speaker": "captain", {captain:bored}
  from?: "mr" | "mrs" | "plain";   // what it is a copy of (default: "mr" / "mrs" for those ids, else "plain")
  color?: string;                  // body colour
  scale?: number;                  // size, multiplies the video's presenter.scale
  lashes?: boolean; ponytail?: boolean; brows?: "mr" | "mrs"; eyes?: number; // face traits (eyes = eye size, 1 = normal)
  outfit?: string[]; kit?: KitSpec;
  place?: string;                  // where it stands: a place name, "x,y,size" in px, or fractions "0.7,0.62,0.5"
  turn?: number;                   // degrees, + = toward screen right (default: toward whoever is speaking)
  voice?: string;                  // ElevenLabs voice id when it speaks (default: its preset's voice)
  entrance?: "pop" | "fly" | "none";
  seated?: boolean;                // true = sits where it is (legs dangling) the whole video; moves and gestures play on top (scene "seated" overrides)
  dumbbell?: number;               // size of its dumbbells (1 = normal, 2.4 = the 40 kg one); outfit item "dumbbell" = carries one in the left hand
};

export type PresenterConfig = {
  press?: CastMember["press"];
  dangle?: boolean;
  type: "builtin" | "image" | "none" | "coin";
  name?: string;                   // builtin preset, image folder under public/presenter/<name>, or coin variant "mr" | "mrs"
  colors?: Partial<{
    skin: string; beanie: string; jacket: string; shirt: string; hair: string; glasses: string; label: string;
    coin: string; ink: string; glove: string;   // coin presenter: body colour (mr lime / mrs pink), features, gloves+shoes
  }>;
  render?: "2d" | "3d";
  outfit?: string[];              // worn the whole video: sunglasses, cap, headband, towel, lantern, jersey...
  kit?: KitSpec;                   // the "jersey" outfit's colour / number / captain armband for the whole video
  flip?: boolean;                  // false = no automatic "$" flip in this video (scenes with pose "flip" still flip)
  cast?: (string | CastMember)[];  // ["mr", "mrs"] = the duo; objects = a cast of copies (3D only), scenes say who speaks
  // set per coin by the cast (not by hand): its kind, id, de-twin seed and face / place overrides
  kind?: "mr" | "mrs" | "plain"; id?: string; seed?: number;
  lashes?: boolean; ponytail?: boolean; brows?: "mr" | "mrs"; eyes?: number; place?: string; turn?: number;
  seated?: boolean; dumbbell?: number; // seated on the spot (legs dangling, moves on top); dumbbell size (see CastMember)
  look?: Partial<{ moodHold: number /* seconds a face must stay before the next change (default 1.0); lower it for fast back-and-forth lines */; shadow: boolean; blur: boolean; rim: boolean; grain: boolean; light: boolean; emit: boolean; match: boolean /* opt-in: saturation / brightness / sharpness a little toward the footage he stands in */; weight: boolean /* on by default (the owner picked it in a blind A/B, 2026-11-11; false = the old movement): wide steps with a real bob, a readable sit, a hop that crouches first, landings on the legs, a deeper squat, a walk that follows the mood */; life: boolean; volume: boolean; human: boolean }>; // human = the human layer (src/lib/human.ts: noise idle, head + brows + gestures follow the voice, listener nods); life = batch 3 lean / trailing hands / landing ring-out / effort; volume = face shading + cheek warmth + sky/ground light; // render look, all on by default: contact shadow, motion blur, rim light + glow, film grain on footage
  rim?: "light" | "line" | "dark";  // 3D coin: raised rim polished (light), dark line where rim meets the face (line), or all dark (dark)            // coin: "3d" = Coin3D (toon-shaded 3D body, same face/moods), default 2d
  entrance?: "pop" | "fly" | "none"; // coin: how it enters (default mr "pop", mrs "fly"; "none" = a cast coin already standing at frame 0, 3D only); it leaves the same way in the last 0.6 s
  exit?: boolean;                  // coin: false = stays on screen at the end
  beard?: boolean;
  glasses?: boolean;
  beanie?: boolean;
  scale?: number;
  x?: number;        // horizontal offset in px
};

export type CaptionsConfig = {
  mode: "headline" | "karaoke" | "both" | "none" | "chunk"; // chunk = 2-3 big words at a time, white with a dark edge (reels on real footage)
  y?: number;        // chunk: centre of the words in px (script "captionY", default 820)
  lead: number;      // seconds a key word lands BEFORE it is said (reel: 0.15)
};

export type Theme = {
  paper: string; ink: string; accent: string; muted: string; panel: string; card: string; dots: string;
  line: string;        // borders
  shadow: string;      // big panel shadow (css box-shadow)
  shadowSoft: string;  // chips / pills
  onAccent: string;    // text/icons on an accent fill
  onInk: string;       // text/icons on an ink fill
  onPanel: string;     // text on a dark panel
  mutedPanel: string;  // secondary text on a dark panel
  fill: string;        // bar tracks, quiet fills
  soft: string;        // accent-tinted highlight row
  faint: string;       // dashed / not-yet borders
  danger: string;      // ✗, LIVE, rejections (never the accent)
  gold: string;        // Premium only
  blend: "multiply" | "normal";  // stamp ink blend (multiply vanishes on dark)
  bg: "paper" | "volt";          // background style
  accent2?: string;              // duo videos: second colour (Mrs. Coin pink) for the background
};

export type SfxCue = { t: number; src: string; dur: number; volume: number; key?: string };

export type Timeline = {
  slug: string;
  title?: string;
  lang: string;              // "en" | "ar" | ...
  dir: "ltr" | "rtl";
  fps: number;
  width: number;
  height: number;
  durationSec: number;
  audio: string | null;      // staticFile path, e.g. "v/<slug>/voice.mp3"
  music?: { src: string; volume: number; duck?: boolean | number /* dip under every sound effect: true = 5 dB, or the dB */ } | null;
  loop?: boolean;            // the last 0.4 s dissolves into frame 0 (the replay has no seam); "ghost" = that frame-0 copy (silent), set by Reel itself
  ghost?: boolean;
  presenter: PresenterConfig;
  captions: CaptionsConfig;
  theme?: Partial<Theme>;
  brand?: string | null;     // "tamrina" -> Volt × Varsity look, calm motion, brand fonts
  seam?: false;              // false = hard cuts between all scenes (no sliding seam)
  text?: false;              // false = no on-screen text at all: no label row, headline, karaoke or footage caption (TikTok-style remakes; the owner writes one fixed caption in the app)
  // one fixed TikTok-style caption for the whole video (shown even with text: false): *marks* take the accent colour,
  // handle = a thin line above it, y = centre of the text (px, default 600), size = font px (default 64)
  front?: string; // a full-frame transparent PNG (under public/) drawn OVER the coins the whole video: the part of a still set that stands in front of him (a steering wheel, a desk edge); cut it from the set photo, same size
  caption?: { text: string; handle?: string; y?: number; size?: number; color?: string /* the *marked* words; default: the accent */ };
  look?: "none" | "silent" | "gameshow"; // film look for the whole video (a scene can override it)
  // the ball (scripts/timeline.mjs): where it starts, named spots, its legs (coin ids / spots + times), sound moments
  ball?: { start: string; spots: Record<string, string>; legs: { t0: number; t1: number; kind: string; from: string; to: string; toCoin: boolean; hit: boolean }[]; events: { t: number; key: string }[] };
  // companion (scripts/companion.mjs): the coin's own path through a handheld clip, one entry per clip frame from t0
  companion?: Companion;
  companions?: Companion[];
  // scene "ride": the moving parts' tracks, inlined by make.mjs from the anchors files (key "<track>#<anchor>", reel px per frame from t0)
  rides?: Record<string, { t0: number; fps: number; x: number[]; y: number[] }>;
  pool?: "male" | "female" | null;
  handle?: string;           // shown on the varsity label row when the scene has no counter
  motion?: "reel" | "calm";  // motion profile (mechanics.ts)
  env?: { fps: number; v: number[] } | null; // voice loudness per frame 0..1 (mouth opening, talking beats), set by make.mjs
  pros?: { fps: number; p: number[]; acc: { t: number; s: number }[] } | null; // voice pitch (semitones from the speaker median) + syllable accents, set by make.mjs (human layer)
  hear?: { nods: number[] };
  acting?: Record<string, unknown>; // per coin id: the acting director's choices (scripts/director.mjs, played by src/lib/acting.ts)
  mocap?: Record<string, { fps: number; f: number[][] }>; // per cast id: the coin copying a real person (scripts/mocap.mjs, src/lib/mocap.ts) // per coin (viewFor): the other speaker's pauses, where a listener nods
  mouth?: { t: number; v: string }[]; // Rhubarb mouth shapes (A-H, X) from the voice, set by make.mjs
  sfx?: SfxCue[];            // one sound per movement, never overlapping (built by timeline.mjs)
  scenes: Scene[];
  events: MotionEvent[];     // global events (added by the self-scoring fix pass)
  tail: number;              // seconds of hold after the last word
};

/** scene "ride" (2026-11-17, FactPilates): the coin's place moves with a tracked part (a Reformer carriage) by as much as the
 * part moved from its FIRST sample (so the scene "place" = where the coin sits when the part is at rest). With "on" the coin
 * first stands at place + "from" (px: the floor beside the machine, where a walkIn ends), then hops on in "dur" s and sits;
 * without "on" it is seated and riding from the scene start. Track t = reel seconds (a film playing from 0 under the reel). */
export type RideCfg = { track: string; anchor: string; on?: number; dur?: number; from?: [number, number]; height?: number };
export type Companion = { t0: number; from?: number; to?: number; fps: number; frames: { t: number; x: number; y: number; s: number; vx: number; vy: number; air: number; walk: number; ww: number; run: number; mode: string }[] };
