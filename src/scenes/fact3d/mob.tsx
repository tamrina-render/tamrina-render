import React, { useMemo } from "react";
import * as THREE from "three";
import { PAL, Part, box, circle, cyl, ico, rbox, sphere, torusArc } from "./parts";
import { clamp, easeOut, hash, lerp } from "./anim";

// Set pieces for FactMob (medieval mob football -> a modern five-a-side pitch). Pure functions of their props.

export type V3 = [number, number, number];

export const MPAL = {
  meadow: "#9CCB62",
  meadowDark: "#86B955",
  pitchA: "#7CC456",
  pitchB: "#6DB64C",
  line: "#FFFFFF",
  dirt: "#B98A58",
  road: "#D8B27A",
  wheat: "#EBC65C",
  wheatDark: "#D9AE45",
  field2: "#A9D46A",
  field3: "#78B652",
  plough: "#C79A63",
  hedge: "#4F8F3E",
  thatch: "#D9B15A",
  thatchDark: "#B98F3E",
  wallWhite: "#F6EBD6",
  timber: "#6E4A30",
  stone: "#D9CDB6",
  stoneDark: "#B9AC94",
  roofBlue: "#3F6FB0",
  roofRed: "#C8553D",
  parchment: "#F3E3BE",
  parchShade: "#E2CB9A",
  red: "#D7262B",
  bladder: "#E9D2A4",
  bladderShade: "#CDAE78",
  pig: "#F4A9B4",
  pigDark: "#E2848F",
  turfA: "#3DAE4F",
  turfB: "#35A247",
  fence: "#24533A",
  pole: "#5A6270",
  flood: "#FFFBEA",
  gold: "#F2B630",
  goldDark: "#C68A12",
  robe: "#B5283A",
  ermine: "#FFF8EE",
};

// ---------------------------------------------------------------- camera track (same maths as FactTitanic)
export type Key = { f: number; p: V3; l: V3; fov: number; still?: boolean };
/** Non-uniform Catmull-Rom (cubic Hermite with time-scaled tangents): velocity carries through every key, no cuts. */
export const sampleTrack = (keys: Key[], f: number) => {
  const n = keys.length;
  if (f <= keys[0].f) {
    const a = keys[0];
    const b = keys[1];
    const t = (f - a.f) / (b.f - a.f);
    return { p: a.p.map((v, i) => v + (b.p[i] - v) * t) as V3, l: a.l.map((v, i) => v + (b.l[i] - v) * t) as V3, fov: a.fov };
  }
  if (f >= keys[n - 1].f) return { p: keys[n - 1].p, l: keys[n - 1].l, fov: keys[n - 1].fov };
  let i = 0;
  while (keys[i + 1].f < f) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(n - 1, i + 2)];
  const h = k2.f - k1.f;
  const t = (f - k1.f) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  const tan = (a: number, b: number, fa: number, fb: number) => (fb === fa ? 0 : (b - a) / (fb - fa));
  const comp = (get: (k: Key) => number) => {
    const m1 = k1.still ? 0 : i === 0 ? tan(get(k1), get(k2), k1.f, k2.f) : tan(get(k0), get(k2), k0.f, k2.f);
    const m2 = k2.still ? 0 : i + 2 >= n ? tan(get(k1), get(k2), k1.f, k2.f) : tan(get(k1), get(k3), k1.f, k3.f);
    return h00 * get(k1) + h10 * h * m1 + h01 * get(k2) + h11 * h * m2;
  };
  return {
    p: [0, 1, 2].map((j) => comp((k) => k.p[j])) as V3,
    l: [0, 1, 2].map((j) => comp((k) => k.l[j])) as V3,
    fov: comp((k) => k.fov),
  };
};

// ---------------------------------------------------------------- geometry helpers
const gcache = new Map<string, THREE.BufferGeometry>();
/** Triangular prism (thatched roof): base w, height h, ridge along z, length len; base at y 0. */
export const prismGeo = (w: number, h: number, len: number) => {
  const k = `pr:${w}:${h}:${len}`;
  let g = gcache.get(k);
  if (!g) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.lineTo(-w / 2, 0);
    g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
    g.translate(0, 0, -len / 2);
    g.computeVertexNormals();
    gcache.set(k, g);
  }
  return g;
};
export const cone = (r: number, h: number, seg = 12) => cyl(0.001, r, h, seg);

// ---------------------------------------------------------------- the instanced crowd ("mini" villagers, ~17 parts each)
export type MiniLook = { skin: string; tunic: string; legs: string; hair: string; shoes: string; hat?: string };
export type MiniPose = {
  hipL: number;
  hipR: number;
  armL: number; // x rotation, negative = forward / up
  armR: number;
  outL: number; // spread away from the body
  outR: number;
  lean: number;
  roll: number;
  bob: number;
  headPitch: number;
  headTilt: number;
  mouth: number; // 0 smile line .. 1 wide "o"
  eye: number; // 1 open, ~0.2 shut
  tumbleX: number; // whole-body flips (pivot at the waist)
  tumbleZ: number;
  lift: number; // whole body up (hops)
};
export const miniRest = (): MiniPose => ({ hipL: 0, hipR: 0, armL: 0, armR: 0, outL: 0.12, outR: 0.12, lean: 0, roll: 0, bob: 0, headPitch: 0, headTilt: 0, mouth: 0, eye: 1, tumbleX: 0, tumbleZ: 0, lift: 0 });
/** Running: phase radians, amp 1 = sprint. */
export const miniRun = (phase: number, amp = 1): MiniPose => {
  const s = Math.sin(phase);
  return {
    ...miniRest(),
    hipL: 0.85 * amp * s,
    hipR: -0.85 * amp * s,
    armL: -0.95 * amp * s,
    armR: 0.95 * amp * s,
    outL: 0.2,
    outR: 0.2,
    lean: 0.2 * amp,
    bob: 0.09 * amp * Math.abs(Math.cos(phase)),
    roll: 0.05 * amp * s,
    mouth: 0.8,
  };
};
/** Waving both arms over the head (cheering, chaos). */
export const miniFlail = (f: number, seed: number, amp = 1): MiniPose => ({
  ...miniRest(),
  armL: -2.7 + Math.sin(f * 0.5 + seed) * 0.45 * amp,
  armR: -2.7 + Math.sin(f * 0.5 + seed + 2) * 0.45 * amp,
  outL: 0.35,
  outR: 0.35,
  hipL: Math.sin(f * 0.4 + seed) * 0.3 * amp,
  hipR: -Math.sin(f * 0.4 + seed) * 0.3 * amp,
  bob: 0.08 * Math.abs(Math.sin(f * 0.4 + seed)) * amp,
  headTilt: Math.sin(f * 0.21 + seed) * 0.15,
  mouth: 1,
});

export type CrowdItem = { pos: V3; rot: number; scale?: number; pose: MiniPose; look: MiniLook; blob?: boolean };

type PartSpec = { key: string; geo: THREE.BufferGeometry; basic?: boolean; color: (l: MiniLook) => string };
const PARTS: PartSpec[] = [
  { key: "legL", geo: rbox(0.25, 0.68, 0.27, 0.07), color: (l) => l.legs },
  { key: "legR", geo: rbox(0.25, 0.68, 0.27, 0.07), color: (l) => l.legs },
  { key: "shoeL", geo: rbox(0.28, 0.13, 0.38, 0.05), color: (l) => l.shoes },
  { key: "shoeR", geo: rbox(0.28, 0.13, 0.38, 0.05), color: (l) => l.shoes },
  { key: "tunic", geo: rbox(0.7, 0.8, 0.46, 0.12), color: (l) => l.tunic },
  { key: "hem", geo: cyl(0.4, 0.46, 0.26, 10), color: (l) => l.tunic },
  { key: "belt", geo: rbox(0.72, 0.09, 0.48, 0.03), color: () => "#5A3B28" },
  { key: "armL", geo: rbox(0.19, 0.56, 0.2, 0.07), color: (l) => l.tunic },
  { key: "armR", geo: rbox(0.19, 0.56, 0.2, 0.07), color: (l) => l.tunic },
  { key: "handL", geo: rbox(0.2, 0.17, 0.2, 0.07), color: (l) => l.skin },
  { key: "handR", geo: rbox(0.2, 0.17, 0.2, 0.07), color: (l) => l.skin },
  { key: "head", geo: rbox(0.62, 0.58, 0.56, 0.12), color: (l) => l.skin },
  { key: "hair", geo: rbox(0.66, 0.18, 0.6, 0.08), color: (l) => l.hair },
  { key: "hairB", geo: rbox(0.66, 0.32, 0.14, 0.06), color: (l) => l.hair },
  { key: "hat", geo: cyl(0.2, 0.36, 0.26, 10), color: (l) => l.hat ?? l.hair },
  { key: "eyeL", geo: circle(0.065, 14), basic: true, color: () => PAL.ink },
  { key: "eyeR", geo: circle(0.065, 14), basic: true, color: () => PAL.ink },
  { key: "mouth", geo: circle(0.06, 14), basic: true, color: () => "#6B2A22" },
];

type Rig = { root: THREE.Object3D; tumble: THREE.Object3D; body: THREE.Object3D; nodes: Record<string, THREE.Object3D>; joints: Record<string, THREE.Object3D> };
const makeRig = (): Rig => {
  const o = () => new THREE.Object3D();
  const root = o();
  const tumble = o();
  tumble.position.set(0, 1.0, 0);
  root.add(tumble);
  const body = o();
  tumble.add(body);
  const nodes: Record<string, THREE.Object3D> = {};
  const joints: Record<string, THREE.Object3D> = {};
  const at = (parent: THREE.Object3D, key: string, x: number, y: number, z: number) => {
    const n = o();
    n.position.set(x, y, z);
    parent.add(n);
    nodes[key] = n;
    return n;
  };
  for (const [side, s] of [["L", 1], ["R", -1]] as const) {
    const j = o();
    j.position.set(s * 0.17, 0.72, 0);
    body.add(j);
    joints[`leg${side}`] = j;
    at(j, `leg${side}`, 0, -0.34, 0);
    at(j, `shoe${side}`, 0, -0.68, 0.06);
  }
  const torso = o();
  torso.position.set(0, 0.72, 0);
  body.add(torso);
  joints.torso = torso;
  at(torso, "tunic", 0, 0.36, 0);
  at(torso, "hem", 0, 0.02, 0);
  at(torso, "belt", 0, 0.16, 0);
  for (const [side, s] of [["L", 1], ["R", -1]] as const) {
    const j = o();
    j.position.set(s * 0.44, 0.68, 0);
    torso.add(j);
    joints[`arm${side}`] = j;
    at(j, `arm${side}`, 0, -0.25, 0);
    at(j, `hand${side}`, 0, -0.58, 0);
  }
  const head = o();
  head.position.set(0, 0.76, 0);
  torso.add(head);
  joints.head = head;
  at(head, "head", 0, 0.3, 0);
  at(head, "hair", 0, 0.56, -0.01);
  at(head, "hairB", 0, 0.42, -0.24);
  at(head, "hat", 0, 0.72, -0.02);
  at(head, "eyeL", 0.14, 0.34, 0.282);
  at(head, "eyeR", -0.14, 0.34, 0.282);
  at(head, "mouth", 0, 0.16, 0.282);
  return { root, tumble, body, nodes, joints };
};

/** Up to `cap` mini villagers drawn with one InstancedMesh per body part (one draw call each). Blob shadows only. */
export const Crowd: React.FC<{ items: CrowdItem[]; cap?: number }> = ({ items, cap = 160 }) => {
  const rig = useMemo(makeRig, []);
  const built = useMemo(() => {
    const group = new THREE.Group();
    const meshes = PARTS.map((p) => {
      const mat = p.basic ? new THREE.MeshBasicMaterial({ color: "#FFFFFF", toneMapped: false }) : new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.8, metalness: 0 });
      const m = new THREE.InstancedMesh(p.geo, mat, cap);
      m.frustumCulled = false;
      m.receiveShadow = !p.basic;
      for (let i = 0; i < cap; i++) m.setColorAt(i, new THREE.Color("#FFFFFF"));
      group.add(m);
      return m;
    });
    const blob = new THREE.InstancedMesh(circle(0.5, 20), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false }), cap);
    blob.frustumCulled = false;
    group.add(blob);
    return { group, meshes, blob };
  }, [cap]);
  const col = useMemo(() => new THREE.Color(), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const zero = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);
  const n = Math.min(cap, items.length);
  for (let i = 0; i < n; i++) {
    const it = items[i];
    const p = it.pose;
    const s = it.scale ?? 1;
    const { root, tumble, body, joints, nodes } = rig;
    root.position.set(it.pos[0], it.pos[1] + p.lift * s, it.pos[2]);
    root.rotation.set(0, it.rot, 0);
    root.scale.setScalar(s);
    tumble.rotation.set(p.tumbleX, 0, p.tumbleZ);
    body.position.set(0, -1.0 + p.bob, 0);
    joints.legL.rotation.set(p.hipL, 0, 0.03);
    joints.legR.rotation.set(p.hipR, 0, -0.03);
    joints.torso.rotation.set(p.lean, 0, p.roll);
    joints.armL.rotation.set(p.armL, 0, p.outL, "XZY");
    joints.armR.rotation.set(p.armR, 0, -p.outR, "XZY");
    joints.head.rotation.set(p.headPitch, 0, p.headTilt);
    nodes.mouth.scale.set(lerp(1.1, 0.9, p.mouth), lerp(0.25, 1.1, p.mouth), 1);
    nodes.eyeL.scale.set(1, Math.max(0.15, p.eye), 1);
    nodes.eyeR.scale.set(1, Math.max(0.15, p.eye), 1);
    nodes.hat.visible = !!it.look.hat;
    root.updateMatrixWorld(true);
    PARTS.forEach((part, k) => {
      const node = nodes[part.key];
      built.meshes[k].setMatrixAt(i, part.key === "hat" && !it.look.hat ? zero : node.matrixWorld);
      built.meshes[k].setColorAt(i, col.set(part.color(it.look)));
    });
    // blob shadow on the ground under the feet (does not tumble), shrinks as the body hops
    const hop = clamp(1 - p.lift * 0.5, 0.4, 1);
    m4.makeRotationX(-Math.PI / 2).premultiply(new THREE.Matrix4().makeScale(s * hop, 1, s * hop * 0.8)).setPosition(it.pos[0], it.pos[1] + 0.02, it.pos[2]);
    built.blob.setMatrixAt(i, it.blob === false ? zero : m4);
  }
  for (const m of [...built.meshes, built.blob]) {
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  return <primitive object={built.group} />;
};

const SKIN = ["#EDBE97", "#D9A27A", "#C98A63", "#F1C9A6", "#B9805B"];
const TUNIC_RED = ["#C8553D", "#D9693F", "#B23A2E", "#E3A93B", "#C98F57", "#A8453A", "#E07A52"];
const TUNIC_BLUE = ["#3F6FB0", "#2F8C86", "#5E9CC4", "#4F7B4A", "#6A5AA0", "#2F5F8F", "#3E9AA8"];
const LEGS = ["#6B4A35", "#4A3A2E", "#5A5048", "#7A5A3A", "#3E4660"];
const HAIR = ["#3B2A20", "#5A3B28", "#2C211D", "#A8642E", "#D9B25A", "#8A5A30"];
const HATS = ["#7A4A28", "#5E7A3A", "#8A2F2A", "#3E4660"];
/** Deterministic look; side -1 = the red village, +1 = the blue one, 0 = mixed. */
export const lookFor = (i: number, side: number): MiniLook => {
  const h = (k: number) => hash(i * 13.7 + k * 3.1 + side * 101.3);
  const pal = side < 0 ? TUNIC_RED : side > 0 ? TUNIC_BLUE : h(9) < 0.5 ? TUNIC_RED : TUNIC_BLUE;
  return {
    skin: SKIN[Math.floor(h(1) * SKIN.length)],
    tunic: pal[Math.floor(h(2) * pal.length)],
    legs: LEGS[Math.floor(h(3) * LEGS.length)],
    hair: HAIR[Math.floor(h(4) * HAIR.length)],
    shoes: "#4A2E22",
    hat: h(5) < 0.3 ? HATS[Math.floor(h(6) * HATS.length)] : undefined,
  };
};

// ---------------------------------------------------------------- village
/** Thatched cottage: white walls, dark timbers, a golden thatch roof; door faces +z. */
export const Cottage: React.FC<{ position?: V3; rotationY?: number; s?: number; seed?: number; sink?: number }> = ({ position, rotationY = 0, s = 1, seed = 1 }) => {
  const w = 3.2 + hash(seed) * 0.8;
  const d = 2.6;
  const h = 2.0;
  const roof = hash(seed * 2) < 0.5 ? MPAL.thatch : MPAL.thatchDark;
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={s}>
      <Part geo={rbox(w, h, d, 0.08)} color={MPAL.wallWhite} position={[0, h / 2, 0]} />
      {/* timbers */}
      {[-1, 0, 1].map((k) => (
        <Part key={k} geo={box(0.14, h, 0.06)} color={MPAL.timber} position={[(k * w) / 2.15, h / 2, d / 2 + 0.01]} shadow={false} />
      ))}
      <Part geo={box(w, 0.14, 0.06)} color={MPAL.timber} position={[0, h - 0.07, d / 2 + 0.01]} shadow={false} />
      {/* door + window */}
      <Part geo={rbox(0.7, 1.25, 0.08, 0.04)} color="#7A4A28" position={[-w * 0.18, 0.63, d / 2 + 0.02]} shadow={false} />
      <Part geo={rbox(0.6, 0.55, 0.06, 0.03)} color="#5A86A8" position={[w * 0.22, 1.2, d / 2 + 0.02]} shadow={false} />
      <Part geo={box(0.66, 0.08, 0.1)} color={MPAL.timber} position={[w * 0.22, 0.9, d / 2 + 0.04]} shadow={false} />
      {/* thatch roof (overhangs), ridge along x */}
      <group position={[0, h - 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Part geo={prismGeo(d + 0.9, 1.7, w + 0.6)} color={roof} flat />
      </group>
      <Part geo={rbox(w + 0.7, 0.18, 0.3, 0.08)} color={MPAL.thatchDark} position={[0, h + 1.62, 0]} />
      {/* chimney */}
      {hash(seed * 5) < 0.6 && <Part geo={rbox(0.42, 1.1, 0.42, 0.05)} color={MPAL.stoneDark} position={[w * 0.3, h + 1.2, -0.3]} />}
    </group>
  );
};

/** Round toy tree (oak-ish): trunk + 3 faceted blobs. */
export const RoundTree: React.FC<{ position?: V3; s?: number; seed?: number; frame: number }> = ({ position, s = 1, seed = 1, frame }) => {
  const sway = Math.sin(frame * 0.05 + seed) * 0.02;
  const g = hash(seed * 3.3) < 0.5 ? PAL.olive : "#6FAE4C";
  const g2 = hash(seed * 4.1) < 0.5 ? PAL.oliveDark : "#5E9A40";
  return (
    <group position={position} scale={s}>
      <Part geo={circle(1.3, 20)} color="#000000" basic opacity={0.1} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} shadow={false} />
      <Part geo={rbox(0.36, 1.8, 0.36, 0.08)} color={PAL.bark} position={[0, 0.9, 0]} />
      <group position={[0, 2.5, 0]} rotation={[0, 0, sway]}>
        <Part geo={ico(1.25, 1)} color={g} flat position={[0, 0.3, 0]} rotation={[seed, seed * 2, 0]} />
        <Part geo={ico(0.85, 1)} color={g2} flat position={[0.75, -0.1, 0.25]} rotation={[seed * 3, 0, 0]} />
        <Part geo={ico(0.8, 1)} color={g} flat position={[-0.7, 0.0, -0.2]} rotation={[0, seed, 0]} />
      </group>
    </group>
  );
};

/** Pine tree: trunk + three stacked cones. */
export const PineTree: React.FC<{ position?: V3; s?: number; seed?: number }> = ({ position, s = 1, seed = 1 }) => {
  const c = hash(seed * 7.7) < 0.5 ? "#3F8A4A" : "#4E9A50";
  return (
    <group position={position} scale={s}>
      <Part geo={rbox(0.32, 1.2, 0.32, 0.06)} color={PAL.bark} position={[0, 0.6, 0]} />
      <Part geo={cone(1.5, 2.0, 8)} color={c} flat position={[0, 2.0, 0]} rotation={[0, seed, 0]} />
      <Part geo={cone(1.15, 1.7, 8)} color={c} flat position={[0, 3.0, 0]} rotation={[0, seed * 2, 0]} />
      <Part geo={cone(0.8, 1.4, 8)} color={c} flat position={[0, 3.9, 0]} rotation={[0, seed * 3, 0]} />
    </group>
  );
};

export const Haystack: React.FC<{ position?: V3; s?: number }> = ({ position, s = 1 }) => (
  <group position={position} scale={s}>
    <Part geo={cyl(0.9, 1.0, 1.0, 12)} color={MPAL.wheat} flat position={[0, 0.5, 0]} />
    <Part geo={cone(1.0, 1.0, 12)} color={MPAL.wheatDark} flat position={[0, 1.5, 0]} />
  </group>
);

/** Patchwork fields both sides of the road (road along x 0, from z0 to z1 < z0). */
export const Fields: React.FC<{ z0: number; z1: number }> = ({ z0, z1 }) => {
  const items = useMemo(() => {
    const out: React.ReactNode[] = [];
    const L = 11;
    let r = 0;
    for (let z = z0; z > z1; z -= L, r++) {
      for (const side of [-1, 1]) {
        for (let c = 0; c < 3; c++) {
          const x0 = 3 + c * 11;
          const w = 10.4;
          const hcol = hash(r * 7.1 + c * 3.3 + side * 1.7);
          const color = hcol < 0.3 ? MPAL.wheat : hcol < 0.5 ? MPAL.field2 : hcol < 0.75 ? MPAL.field3 : MPAL.plough;
          const cx = side * (x0 + w / 2);
          const cz = z - L / 2;
          out.push(<Part key={`f${r}${side}${c}`} geo={box(w, 0.06, L - 0.6)} color={color} position={[cx, 0.03, cz]} shadow={false} />);
          // furrow stripes on ploughed / wheat fields
          if (hcol < 0.3 || hcol >= 0.75)
            for (let q = 0; q < 4; q++)
              out.push(<Part key={`s${r}${side}${c}${q}`} geo={box(w - 0.6, 0.02, 0.35)} color={hcol < 0.3 ? MPAL.wheatDark : "#AE8250"} position={[cx, 0.07, cz - 3.6 + q * 2.4]} shadow={false} />);
          if (hcol < 0.3 && hash(r + c * 9 + side) < 0.7) out.push(<Haystack key={`h${r}${side}${c}`} position={[cx + (hash(r * 2 + c) - 0.5) * 5, 0, cz + (hash(r * 3 + c) - 0.5) * 5]} s={0.9} />);
        }
        // hedge between the road verge and the fields
        out.push(<Part key={`hg${r}${side}`} geo={rbox(0.7, 0.75, L - 1.2, 0.25)} color={MPAL.hedge} position={[side * 2.6, 0.37, z - L / 2]} shadow={false} />);
      }
    }
    return out;
  }, [z0, z1]);
  return <>{items}</>;
};

// ---------------------------------------------------------------- the far goal: two posts + crossbar (a mill gate) and a windmill
export const MillGoal: React.FC<{ position?: V3 }> = ({ position }) => (
  <group position={position}>
    {[-1, 1].map((k) => (
      <React.Fragment key={k}>
        <Part geo={rbox(0.5, 5.2, 0.5, 0.08)} color={PAL.wood} position={[k * 3.6, 2.6, 0]} />
        <Part geo={rbox(0.7, 0.3, 0.7, 0.06)} color={MPAL.timber} position={[k * 3.6, 5.3, 0]} />
        <Part geo={rbox(0.9, 0.4, 0.9, 0.06)} color={MPAL.stoneDark} position={[k * 3.6, 0.2, 0]} />
      </React.Fragment>
    ))}
    <Part geo={rbox(7.8, 0.4, 0.42, 0.08)} color={MPAL.timber} position={[0, 4.6, 0]} />
    <Part geo={rbox(7.6, 0.22, 0.3, 0.06)} color={PAL.wood} position={[0, 3.9, 0]} rotation={[0, 0, 0.0]} />
    {/* a pennant on top of each post */}
    {[-1, 1].map((k) => (
      <Part key={`p${k}`} geo={box(0.9, 0.55, 0.04)} color={k < 0 ? MPAL.roofRed : MPAL.roofBlue} position={[k * 3.6 + 0.5, 5.95, 0]} />
    ))}
    {[-1, 1].map((k) => (
      <Part key={`m${k}`} geo={rbox(0.08, 1.2, 0.08, 0.03)} color={MPAL.timber} position={[k * 3.6, 5.95, 0]} />
    ))}
  </group>
);

export const Windmill: React.FC<{ position?: V3; angle: number; s?: number }> = ({ position, angle, s = 1 }) => (
  <group position={position} scale={s}>
    <Part geo={cyl(1.3, 2.0, 6.5, 10)} color={MPAL.wallWhite} position={[0, 3.25, 0]} />
    <Part geo={cone(1.7, 2.0, 10)} color={MPAL.roofRed} flat position={[0, 7.4, 0]} />
    <Part geo={rbox(0.8, 1.3, 0.1, 0.04)} color="#7A4A28" position={[0, 0.65, 1.85]} />
    <group position={[0, 6.0, 1.5]} rotation={[0, 0, angle]}>
      <Part geo={cyl(0.3, 0.3, 0.5, 10)} color={MPAL.timber} rotation={[Math.PI / 2, 0, 0]} />
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
          <Part geo={box(0.16, 4.2, 0.1)} color={MPAL.timber} position={[0, 2.2, 0.2]} />
          <Part geo={box(0.9, 3.4, 0.05)} color={MPAL.parchment} position={[0.5, 2.5, 0.24]} />
        </group>
      ))}
    </group>
  </group>
);

// ---------------------------------------------------------------- the ball, the pig, the cart
/** Inflated pig's bladder: beige, lumpy, not quite round, a tied knot. `deflate` 0..1 squashes it flat and wrinkled. */
export const BladderBall: React.FC<{ position?: V3; spin?: number; s?: number; deflate?: number; squash?: number }> = ({ position, spin = 0, s = 1, deflate = 0, squash = 1 }) => {
  const d = clamp(deflate);
  const sy = lerp(1, 0.28, d) * squash;
  const sxz = lerp(1, 1.35, d) / Math.sqrt(squash);
  return (
    <group position={position} scale={s}>
      <group position={[0, -0.55 * (1 - sy), 0]} scale={[sxz, sy, sxz]}>
        <group rotation={[spin, spin * 0.6, 0]}>
          <Part geo={sphere(0.55, 18)} color={MPAL.bladder} rough={0.55} scale={[1.08, 0.94, 1]} />
          <Part geo={sphere(0.3, 12)} color={MPAL.bladder} rough={0.55} position={[0.3, 0.22, 0.2]} />
          <Part geo={sphere(0.28, 12)} color={MPAL.bladderShade} rough={0.6} position={[-0.32, -0.15, 0.22]} />
          <Part geo={sphere(0.26, 12)} color={MPAL.bladder} rough={0.55} position={[0.05, -0.3, -0.3]} />
          {/* the tied knot + string */}
          <Part geo={cyl(0.07, 0.14, 0.2, 8)} color={MPAL.bladderShade} position={[0, 0.6, 0]} />
          <Part geo={torusArc(0.08, 0.025, Math.PI * 1.6)} color="#8A6A4E" position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]} />
          {/* seam lines */}
          <Part geo={torusArc(0.555, 0.012, Math.PI)} color={MPAL.bladderShade} rotation={[0, 0.4, 0]} shadow={false} />
        </group>
      </group>
    </group>
  );
};

/** Small pink pig facing +z; head tilt and blink are props. */
export const Pig: React.FC<{ position?: V3; rotationY?: number; tilt?: number; pitch?: number; blink?: number; earFlick?: number; s?: number }> = ({ position, rotationY = 0, tilt = 0, pitch = 0, blink = 1, earFlick = 0, s = 1 }) => (
  <group position={position} rotation={[0, rotationY, 0]} scale={s}>
    <Part geo={circle(0.9, 20)} color="#000000" basic opacity={0.13} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[0.8, 1.1, 1]} shadow={false} />
    <Part geo={rbox(1.05, 0.85, 1.45, 0.3)} color={MPAL.pig} position={[0, 0.85, -0.1]} />
    {[
      [0.3, 0.4],
      [-0.3, 0.4],
      [0.3, -0.6],
      [-0.3, -0.6],
    ].map(([x, z], i) => (
      <Part key={i} geo={rbox(0.24, 0.5, 0.24, 0.07)} color={MPAL.pigDark} position={[x, 0.25, z]} />
    ))}
    <Part geo={torusArc(0.12, 0.035, Math.PI * 1.7)} color={MPAL.pigDark} position={[0, 1.05, -0.88]} rotation={[0, Math.PI / 2, 0]} />
    <group position={[0, 1.05, 0.62]} rotation={[pitch, 0, tilt, "YXZ"]}>
      <Part geo={rbox(0.85, 0.78, 0.7, 0.26)} color={MPAL.pig} position={[0, 0.08, 0.1]} />
      <Part geo={cyl(0.2, 0.22, 0.2, 14)} color={MPAL.pigDark} position={[0, -0.02, 0.5]} rotation={[Math.PI / 2, 0, 0]} />
      {[1, -1].map((k) => (
        <React.Fragment key={k}>
          <Part geo={circle(0.045, 10)} color="#7A3340" basic position={[k * 0.07, -0.02, 0.605]} shadow={false} />
          <group position={[k * 0.3, 0.46, 0.0]} rotation={[0.5 + (k > 0 ? earFlick : 0), 0, k * -0.35]}>
            <Part geo={rbox(0.26, 0.3, 0.06, 0.03)} color={MPAL.pigDark} position={[0, 0.12, 0]} />
          </group>
          <group position={[k * 0.2, 0.22, 0.455]}>
            <Part geo={circle(0.1, 14)} color="#FFFFFF" basic scale={[1, Math.max(0.08, blink), 1]} shadow={false} />
            <Part geo={circle(0.06, 12)} color={PAL.ink} basic position={[0, 0.02 * blink, 0.004]} scale={[1, Math.max(0.08, blink), 1]} shadow={false} />
          </group>
        </React.Fragment>
      ))}
    </group>
  </group>
);

/** Wooden vegetable cart along x: two wheels, a box of cabbages, carrots and apples. */
export const VegCart: React.FC<{ position?: V3; rotationY?: number; jolt?: number }> = ({ position, rotationY = 0, jolt = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    {[-1, 1].map((k) => (
      <group key={k} position={[0, 0.55, k * 0.85]}>
        <Part geo={cyl(0.55, 0.55, 0.12, 14)} color={MPAL.timber} rotation={[Math.PI / 2, 0, 0]} />
        <Part geo={cyl(0.14, 0.14, 0.18, 10)} color={PAL.wood} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    ))}
    <group position={[0, jolt * 0.12, 0]} rotation={[jolt * 0.06, 0, 0]}>
      <Part geo={rbox(2.6, 0.5, 1.6, 0.06)} color={PAL.wood} position={[0, 1.05, 0]} />
      <Part geo={rbox(2.7, 0.08, 1.7, 0.03)} color={MPAL.timber} position={[0, 1.31, 0]} />
      <Part geo={rbox(1.6, 0.1, 0.1, 0.03)} color={MPAL.timber} position={[-2.0, 0.95, 0.4]} />
      <Part geo={rbox(1.6, 0.1, 0.1, 0.03)} color={MPAL.timber} position={[-2.0, 0.95, -0.4]} />
      {Array.from({ length: 9 }, (_, i) => {
        const kind = i % 3;
        const x = -0.9 + (i % 5) * 0.45;
        const z = i < 5 ? -0.35 : 0.35;
        return kind === 0 ? (
          <Part key={i} geo={sphere(0.27, 10)} color="#7DBE4E" position={[x, 1.48 + jolt * 0.1 * hash(i), z]} flat />
        ) : kind === 1 ? (
          <Part key={i} geo={cone(0.1, 0.5, 6)} color="#EE8A2E" position={[x, 1.55 + jolt * 0.15 * hash(i + 3), z]} rotation={[0.8, i, 1.4]} />
        ) : (
          <Part key={i} geo={sphere(0.18, 10)} color="#D7262B" position={[x, 1.45 + jolt * 0.2 * hash(i + 5), z]} />
        );
      })}
    </group>
  </group>
);

// ---------------------------------------------------------------- the castle + the king
/** Castle front (faces +z) with two round towers, a central keep with a balcony at y BALCONY_Y. */
export const BALCONY_Y = 5.2;
export const Castle: React.FC<{ position?: V3; frame: number }> = ({ position, frame }) => {
  const W = 15;
  const H = 8;
  return (
    <group position={position}>
      {/* curtain wall */}
      <Part geo={rbox(W, H - 2, 3, 0.1)} color={MPAL.stone} position={[0, (H - 2) / 2, -1]} />
      {Array.from({ length: 9 }, (_, i) => (
        <Part key={`c${i}`} geo={rbox(0.9, 0.8, 0.8, 0.05)} color={MPAL.stone} position={[-W / 2 + 0.8 + i * ((W - 1.6) / 8), H - 2 + 0.4, 0.1]} />
      ))}
      {/* stone courses */}
      {[1.6, 3.4, 5.2].map((y) => (
        <Part key={y} geo={box(W, 0.08, 0.05)} color={MPAL.stoneDark} position={[0, y, 0.52]} shadow={false} />
      ))}
      {/* keep (centre) */}
      <Part geo={rbox(5.4, H + 1.5, 3.4, 0.1)} color={MPAL.stone} position={[0, (H + 1.5) / 2, -0.6]} />
      {Array.from({ length: 5 }, (_, i) => (
        <Part key={`k${i}`} geo={rbox(0.8, 0.8, 0.8, 0.05)} color={MPAL.stone} position={[-2.2 + i * 1.1, H + 1.9, 0.7]} />
      ))}
      {/* the doorway behind the balcony */}
      <Part geo={rbox(1.6, 2.4, 0.1, 0.05)} color="#3E2C22" position={[0, BALCONY_Y + 1.2, 1.12]} shadow={false} />
      <Part geo={cyl(0.8, 0.8, 0.1, 16)} color="#3E2C22" position={[0, BALCONY_Y + 2.4, 1.12]} rotation={[Math.PI / 2, 0, 0]} shadow={false} />
      {/* balcony slab + rail */}
      <Part geo={rbox(3.6, 0.35, 1.8, 0.06)} color={MPAL.stoneDark} position={[0, BALCONY_Y - 0.17, 1.9]} />
      <Part geo={rbox(3.6, 0.2, 0.25, 0.05)} color={MPAL.stoneDark} position={[0, BALCONY_Y + 1.0, 2.7]} />
      {[-1.6, -0.8, 0, 0.8, 1.6].map((x) => (
        <Part key={x} geo={rbox(0.16, 1.0, 0.16, 0.04)} color={MPAL.stone} position={[x, BALCONY_Y + 0.5, 2.7]} />
      ))}
      {/* banner under the balcony */}
      <Part geo={box(1.5, 2.6, 0.05)} color={MPAL.robe} position={[0, BALCONY_Y - 1.7, 1.13]} />
      <Part geo={box(0.5, 0.5, 0.06)} color={MPAL.gold} position={[0, BALCONY_Y - 1.4, 1.17]} rotation={[0, 0, Math.PI / 4]} />
      {/* gate */}
      <Part geo={rbox(2.8, 3.2, 0.1, 0.06)} color="#6E4A30" position={[0, 1.6, 1.12]} />
      {[-0.9, -0.3, 0.3, 0.9].map((x) => (
        <Part key={`g${x}`} geo={box(0.08, 3.1, 0.06)} color="#4A3020" position={[x, 1.6, 1.18]} shadow={false} />
      ))}
      {/* towers */}
      {[-1, 1].map((k) => (
        <group key={k} position={[k * (W / 2), 0, 0]}>
          <Part geo={cyl(1.9, 2.1, H + 2.5, 16)} color={MPAL.stone} position={[0, (H + 2.5) / 2, 0]} />
          <Part geo={cyl(2.2, 2.2, 0.6, 16)} color={MPAL.stoneDark} position={[0, H + 2.8, 0]} />
          <Part geo={cone(2.5, 3.6, 16)} color={k < 0 ? MPAL.roofRed : MPAL.roofBlue} position={[0, H + 4.9, 0]} />
          <Part geo={rbox(0.5, 0.9, 0.1, 0.04)} color="#3E2C22" position={[0, H - 1.0, 2.05]} shadow={false} />
          {/* flag */}
          <Part geo={rbox(0.08, 2.0, 0.08, 0.03)} color={MPAL.timber} position={[0, H + 7.4, 0]} />
          <group position={[0, H + 7.9, 0]} rotation={[0, Math.sin(frame * 0.12 + k) * 0.25, 0]}>
            <Part geo={box(1.4, 0.8, 0.04)} color={k < 0 ? MPAL.gold : MPAL.robe} position={[0.72, 0, 0]} rotation={[0, Math.sin(frame * 0.2 + k) * 0.15, 0]} />
          </group>
        </group>
      ))}
    </group>
  );
};

/** Crown (Blocky headgear, head-local: crown top y 0.87). */
export const Crown: React.FC = () => (
  <group position={[0, 0.86, -0.02]}>
    <Part geo={cyl(0.4, 0.4, 0.22, 16)} color={MPAL.gold} rough={0.35} emissive={MPAL.goldDark} emissiveIntensity={0.25} position={[0, 0.06, 0]} />
    {Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      return <Part key={i} geo={cone(0.1, 0.26, 4)} color={MPAL.gold} rough={0.35} emissive={MPAL.goldDark} emissiveIntensity={0.25} position={[Math.sin(a) * 0.36, 0.29, Math.cos(a) * 0.36]} />;
    })}
    <Part geo={sphere(0.06, 8)} color={MPAL.red} position={[0, 0.08, 0.41]} />
  </group>
);
/** Short white beard + moustache (head-local). */
export const Beard: React.FC<{ color?: string }> = ({ color = "#F2EEE6" }) => (
  <group position={[0, 0.1, 0.36]}>
    <Part geo={rbox(0.62, 0.36, 0.14, 0.07)} color={color} position={[0, -0.02, 0]} />
    <Part geo={rbox(0.36, 0.09, 0.08, 0.03)} color={color} position={[0, 0.17, 0.06]} />
  </group>
);
/** Soft felt cap (head-local). */
export const Cap: React.FC<{ color: string }> = ({ color }) => (
  <group position={[0, 0.84, -0.04]}>
    <Part geo={cyl(0.32, 0.46, 0.22, 14)} color={color} />
    <Part geo={sphere(0.16, 10)} color={color} position={[0.05, 0.16, -0.12]} />
  </group>
);
/** Tunic belt on the Blocky torso (torso-local). */
export const Belt: React.FC = () => <Part geo={rbox(0.88, 0.1, 0.54, 0.03)} color="#5A3B28" position={[0, 0.06, 0]} />;

// ---------------------------------------------------------------- the rules scroll
/**
 * A long scroll held at its top roll (local origin = the top roll's centre, faces +z). `unroll` 0..1 drops the paper to
 * the ground (`drop` below the roll) and then runs it along the ground toward +z (`run`). `stamp` 0..1+ = the red cross.
 */
export const Scroll: React.FC<{ unroll: number; drop: number; run: number; stamp: number; w?: number }> = ({ unroll, drop, run, stamp, w = 1.25 }) => {
  const u = clamp(unroll);
  const hangLen = Math.min(1, u / 0.55) * drop;
  const runLen = clamp((u - 0.55) / 0.45) * run;
  const endY = -hangLen;
  return (
    <group>
      <Part geo={cyl(0.1, 0.1, w + 0.25, 12)} color={PAL.wood} rotation={[0, 0, Math.PI / 2]} />
      {[1, -1].map((k) => (
        <Part key={k} geo={sphere(0.12, 10)} color={MPAL.timber} position={[(k * (w + 0.3)) / 2, 0, 0]} />
      ))}
      {hangLen > 0.01 && (
        <>
          <Part geo={box(w, hangLen, 0.02)} color={MPAL.parchment} rough={0.9} position={[0, -hangLen / 2, 0.06]} />
          {/* the one line: a dark bar + a red cross (blank everywhere else) */}
          {hangLen > 0.55 && (
            <group position={[0, -0.42, 0.075]}>
              <Part geo={rbox(0.62, 0.09, 0.012, 0.02)} color="#4A3A30" position={[-0.18, 0, 0]} shadow={false} />
              {stamp > 0 && (
                <group position={[0.36, 0, 0.004]} scale={Math.max(0.001, stamp)}>
                  <Part geo={rbox(0.36, 0.08, 0.012, 0.03)} color={MPAL.red} rotation={[0, 0, Math.PI / 4]} shadow={false} />
                  <Part geo={rbox(0.36, 0.08, 0.012, 0.03)} color={MPAL.red} rotation={[0, 0, -Math.PI / 4]} shadow={false} />
                </group>
              )}
            </group>
          )}
        </>
      )}
      {/* the lower roll: falls, then rolls along the ground */}
      {u > 0.001 && u < 0.999 && <Part geo={cyl(0.09, 0.09, w + 0.1, 12)} color={MPAL.parchShade} position={[0, endY, 0.06 + runLen]} rotation={[runLen * 6, 0, Math.PI / 2]} />}
      {runLen > 0.01 && <Part geo={box(w, 0.02, runLen)} color={MPAL.parchment} rough={0.9} position={[0, -drop + 0.01, 0.06 + runLen / 2]} />}
      {u >= 0.999 && <Part geo={cyl(0.08, 0.08, w + 0.1, 12)} color={MPAL.parchShade} position={[0, -drop + 0.08, 0.06 + run]} rotation={[0, 0, Math.PI / 2]} />}
    </group>
  );
};

// ---------------------------------------------------------------- dust cloud (the scrum)
export const DustCloud: React.FC<{ frame: number; at: V3; r?: number; amount?: number; color?: string; seed?: number }> = ({ frame, at, r = 2.2, amount = 1, color = "#F0E2C4", seed = 0 }) => {
  if (amount <= 0.001) return null;
  return (
    <group position={at}>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2 + seed;
        const cyc = (frame * 0.07 + hash(i * 3.1 + seed) * 6) % 1;
        const rr = r * (0.75 + 0.35 * hash(i + seed));
        const puff = 0.6 + 0.5 * Math.sin(cyc * Math.PI);
        const y = 0.5 + (i % 3) * 0.55 + cyc * 0.4;
        return (
          <Part
            key={i}
            geo={ico(0.56, 1)}
            color={i % 4 === 0 ? "#E4D2AE" : color}
            flat
            rough={1}
            position={[Math.cos(a) * rr, y, Math.sin(a) * rr * 0.8]}
            scale={puff * amount * (0.9 + 0.4 * hash(i * 7 + seed))}
            rotation={[i, frame * 0.02 + i, 0]}
            shadow={false}
          />
        );
      })}
    </group>
  );
};

/** One drifting puff (dust kick / swap). */
export const Puff: React.FC<{ at: V3; age: number; life?: number; s?: number; color?: string }> = ({ at: p0, age, life = 18, s = 1, color = "#F5EBD8" }) => {
  if (age < 0 || age > life) return null;
  const a = age / life;
  return <Part geo={ico(0.3, 1)} color={color} flat rough={1} opacity={0.9 * (1 - a) * (1 - a)} position={[p0[0], p0[1] + a * 0.5, p0[2]]} scale={(0.6 + easeOut(a) * 1.6) * s} shadow={false} />;
};
export const PuffRing: React.FC<{ at: V3; age: number; n?: number; r?: number; s?: number; color?: string; life?: number }> = ({ at: p0, age, n = 7, r = 0.8, s = 1, color, life = 18 }) => {
  if (age < 0 || age > life + 4) return null;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const rr = r * (0.5 + easeOut(clamp(age / 16)) * 0.8);
        return <Puff key={i} at={[p0[0] + Math.cos(a) * rr, p0[1] + (i % 2) * 0.35, p0[2] + Math.sin(a) * rr]} age={age - (i % 3)} life={life} s={s} color={color} />;
      })}
    </>
  );
};

// ---------------------------------------------------------------- modern five-a-side pitch
export const Floodlight: React.FC<{ position?: V3; rotationY?: number; h?: number; on: number }> = ({ position, rotationY = 0, h = 9, on }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <Part geo={cyl(0.14, 0.2, h, 10)} color={MPAL.pole} position={[0, h / 2, 0]} />
    <group position={[0, h + 0.3, 0.2]} rotation={[0.45, 0, 0]}>
      <Part geo={rbox(2.4, 1.1, 0.3, 0.06)} color="#3A404A" />
      {[-0.75, 0, 0.75].map((x) =>
        [-0.25, 0.25].map((y) => <Part key={`${x}${y}`} geo={circle(0.24, 16)} color={on > 0.5 ? MPAL.flood : "#8A919C"} basic position={[x, y, 0.16]} shadow={false} />),
      )}
      {on > 0.01 && (
        <>
          <Part geo={circle(2.0, 28)} color="#FFF6D8" basic opacity={0.28 * on} position={[0, 0, 0.2]} shadow={false} />
          <Part geo={circle(3.6, 28)} color="#FFF6D8" basic opacity={0.12 * on} position={[0, 0, 0.18]} shadow={false} />
        </>
      )}
    </group>
  </group>
);

/** Small goal facing +z (posts, crossbar, a white net box). */
export const SmallGoal: React.FC<{ position?: V3; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    {[-1, 1].map((k) => (
      <Part key={k} geo={cyl(0.07, 0.07, 1.6, 10)} color="#FFFFFF" position={[k * 1.6, 0.8, 0]} />
    ))}
    <Part geo={cyl(0.07, 0.07, 3.3, 10)} color="#FFFFFF" position={[0, 1.6, 0]} rotation={[0, 0, Math.PI / 2]} />
    <Part geo={box(3.2, 1.6, 0.02)} color="#FFFFFF" opacity={0.35} position={[0, 0.8, -1.0]} shadow={false} />
    {[-1, 1].map((k) => (
      <Part key={`s${k}`} geo={box(0.02, 1.6, 1.0)} color="#FFFFFF" opacity={0.3} position={[k * 1.6, 0.8, -0.5]} shadow={false} />
    ))}
    <Part geo={box(3.2, 0.02, 1.0)} color="#FFFFFF" opacity={0.3} position={[0, 1.6, -0.5]} shadow={false} />
  </group>
);

/** A modern football (white with dark patches). */
export const ModernBall: React.FC<{ position?: V3; spin?: number; s?: number }> = ({ position, spin = 0, s = 1 }) => (
  <group position={position} scale={s} rotation={[spin, spin * 0.7, 0]}>
    <Part geo={sphere(0.3, 16)} color="#FFFFFF" rough={0.5} />
    {[
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
      [-0.7, -0.7, 0],
      [0, -0.6, -0.8],
      [0.6, 0, -0.8],
    ].map((d, i) => {
      const v = new THREE.Vector3(...(d as V3)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), v);
      const e = new THREE.Euler().setFromQuaternion(q);
      return <Part key={i} geo={circle(0.1, 5)} color="#2A2E36" basic position={[v.x * 0.302, v.y * 0.302, v.z * 0.302]} rotation={[e.x, e.y, e.z]} shadow={false} />;
    })}
  </group>
);

/** Wrist watch (Blocky hand-local). */
export const Watch: React.FC = () => (
  <group position={[0, 0.14, 0]}>
    <Part geo={rbox(0.27, 0.08, 0.27, 0.03)} color="#2A2E36" />
    <Part geo={rbox(0.14, 0.1, 0.14, 0.03)} color="#DFF53A" position={[0, 0, 0.13]} />
  </group>
);

/** Sun disc + halo for the sky (unlit). */
export const SunDisc: React.FC<{ position: V3; r: number; color?: string }> = ({ position, r, color = "#FFE58A" }) => (
  <group position={position}>
    <mesh geometry={sphere(r, 24)}>
      <meshBasicMaterial color={color} fog={false} toneMapped={false} />
    </mesh>
    <mesh geometry={sphere(r * 1.7, 24)}>
      <meshBasicMaterial color={color} fog={false} transparent opacity={0.25} depthWrite={false} toneMapped={false} />
    </mesh>
  </group>
);

/** A small grazing sheep (faces +z); `graze` 0..1 lowers the head. */
export const Sheep: React.FC<{ position?: V3; rotationY?: number; graze?: number; s?: number }> = ({ position, rotationY = 0, graze = 0, s = 1 }) => (
  <group position={position} rotation={[0, rotationY, 0]} scale={s}>
    <Part geo={circle(0.75, 16)} color="#000000" basic opacity={0.12} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} shadow={false} />
    {[
      [0.22, 0.35],
      [-0.22, 0.35],
      [0.22, -0.35],
      [-0.22, -0.35],
    ].map(([x, z], i) => (
      <Part key={i} geo={rbox(0.14, 0.45, 0.14, 0.05)} color="#3A2E2A" position={[x, 0.22, z]} />
    ))}
    <Part geo={ico(0.55, 1)} color="#F7F3EA" flat rough={1} position={[0, 0.72, 0]} scale={[0.9, 0.8, 1.2]} />
    <Part geo={ico(0.3, 1)} color="#FFFFFF" flat rough={1} position={[0, 0.98, 0.1]} />
    <group position={[0, 0.8, 0.6]} rotation={[0.3 + graze * 0.7, 0, 0]}>
      <Part geo={rbox(0.32, 0.36, 0.42, 0.12)} color="#3A2E2A" position={[0, 0, 0.2]} />
      {[1, -1].map((k) => (
        <Part key={k} geo={rbox(0.2, 0.08, 0.1, 0.03)} color="#3A2E2A" position={[k * 0.22, 0.08, 0.1]} rotation={[0, 0, k * 0.4]} />
      ))}
      {[1, -1].map((k) => (
        <Part key={`e${k}`} geo={circle(0.04, 10)} color="#FFFFFF" basic position={[k * 0.1, 0.06, 0.415]} shadow={false} />
      ))}
    </group>
  </group>
);
