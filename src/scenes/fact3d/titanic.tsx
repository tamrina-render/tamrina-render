import React, { useMemo } from "react";
import * as THREE from "three";
import { PAL, Part, box, circle, cyl, ico, rbox, sphere, torusArc } from "./parts";
import { hash } from "./anim";

// Set pieces for FactTitanic: the ship at night on a toy sea, the 1912 gym room and its machines, the modern swap.
// Everything is a pure function of the props (no state, no useFrame).

type V3 = [number, number, number];

export const TPAL = {
  hull: "#2C313C",
  hullRed: "#9A3B2E",
  white: "#ECEFF4",
  buff: "#DDA453",
  funnelTop: "#23262C",
  winLit: "#FFD877",
  winDim: "#6B7488",
  seaDeep: "#1F3566",
  seaTop: "#4B6FAE",
  foam: "#DCE7F5",
  nightTop: "#16244D",
  nightHorizon: "#4A6AA3",
  dayTop: "#5DB3E0",
  dayHorizon: "#F6EBD6",
  oak: "#9B6236",
  oakDark: "#7A4A28",
  oakLight: "#C68B55",
  brass: "#E0B24A",
  brassDark: "#B4862E",
  iron: "#34363D",
  ironLight: "#555963",
  leather: "#7B3F26",
  plaster: "#F4E6C8",
  floorA: "#C98F57",
  floorB: "#E2B27A",
  modernWall: "#F5F1EA",
  modernFloorA: "#E9E1D2",
  modernFloorB: "#DFD5C2",
  gold: "#F2B630",
  goldDark: "#C68A12",
};

// ---------------------------------------------------------------- sky
/** Sky sphere with a gradient whose colours are set every frame (night -> day without rebuilding the material). */
export const GradientSky: React.FC<{ top: string; horizon: string; radius?: number; rotationZ?: number }> = ({ top, horizon, radius = 2400, rotationZ = 0 }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
          void main(){ float h = clamp(vDir.y*1.7+0.06, 0.0, 1.0); h = pow(h, 0.75); gl_FragColor = vec4(mix(horizon, top, h), 1.0);
          #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  mat.uniforms.top.value.set(top);
  mat.uniforms.horizon.value.set(horizon);
  return (
    <mesh material={mat} renderOrder={-1} frustumCulled={false} rotation={[0, 0, rotationZ]}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  );
};

const STAR_N = 260;
/** Twinkling stars on a dome (seeded, deterministic). */
export const Stars: React.FC<{ frame: number; radius?: number }> = ({ frame, radius = 2000 }) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: "#FFFFFF", fog: false, toneMapped: false }), STAR_N);
    m.frustumCulled = false;
    return m;
  }, []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  for (let i = 0; i < STAR_N; i++) {
    const az = hash(i * 1.37) * Math.PI * 2;
    const el = 0.08 + Math.pow(hash(i * 2.91), 0.8) * 1.35;
    const r = radius;
    tmp.position.set(Math.cos(az) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(az) * Math.cos(el) * r);
    const tw = 0.65 + 0.35 * Math.sin(frame * (0.08 + hash(i * 5.1) * 0.12) + i);
    const s = (2.2 + hash(i * 7.3) * 3.8) * tw * (radius / 2000);
    tmp.scale.setScalar(s);
    tmp.updateMatrix();
    mesh.setMatrixAt(i, tmp.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return <primitive object={mesh} />;
};

export const Moon: React.FC<{ position: V3; r?: number }> = ({ position, r = 60 }) => {
  const mats = useMemo(
    () => [
      new THREE.MeshBasicMaterial({ color: "#FFF4D6", fog: false, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: "#FFF1C9", fog: false, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }),
      new THREE.MeshBasicMaterial({ color: "#EADFC0", fog: false, toneMapped: false }),
    ],
    [],
  );
  return (
    <group position={position}>
      <mesh material={mats[0]} geometry={sphere(r, 32)} />
      <mesh material={mats[1]} geometry={sphere(r * 1.7, 32)} />
      {/* a few soft craters */}
      <mesh material={mats[2]} geometry={sphere(r * 0.2, 12)} position={[-r * 0.3, r * 0.25, r * 0.85]} scale={[1, 1, 0.3]} />
      <mesh material={mats[2]} geometry={sphere(r * 0.13, 12)} position={[r * 0.35, -r * 0.2, r * 0.88]} scale={[1, 1, 0.3]} />
    </group>
  );
};

// ---------------------------------------------------------------- sea
const SEA_NX = 64;
const SEA_NZ = 56;
const SEA_S = 7;
const SEA_X0 = -200;
const SEA_Z0 = -150;
/** Blocky animated waves: a grid of tiles that bob, scrolling past the moving ship (ship sails +x). */
export const Sea: React.FC<{ frame: number; y?: number }> = ({ frame, y = -17 }) => {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(SEA_S * 0.94, 1.2, SEA_S * 0.94), new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0, flatShading: true }), SEA_NX * SEA_NZ);
    m.frustumCulled = false;
    return m;
  }, []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const cDeep = useMemo(() => new THREE.Color(TPAL.seaDeep), []);
  const cTop = useMemo(() => new THREE.Color(TPAL.seaTop), []);
  const cFoam = useMemo(() => new THREE.Color(TPAL.foam), []);
  const t = frame / 30;
  let k = 0;
  for (let i = 0; i < SEA_NX; i++) {
    for (let j = 0; j < SEA_NZ; j++) {
      const x = SEA_X0 + i * SEA_S;
      const z = SEA_Z0 + j * SEA_S;
      const xs = x + t * 9; // the water streams toward -x relative to the ship
      const h = Math.sin(xs * 0.055 + z * 0.03) * 0.55 + Math.sin(xs * 0.021 - z * 0.071 + t * 0.9) * 0.45 + Math.sin(z * 0.11 + t * 1.7 + xs * 0.04) * 0.25;
      // foam along the hull and the bow wave
      const dz = Math.abs(z) - 11;
      const nearHull = x > -66 && x < 68 && dz > -2 && dz < 8 ? 1 - Math.min(1, Math.max(0, dz) / 8) : 0;
      const bow = x > 50 && x < 78 && Math.abs(z) < 16 ? 1 - Math.min(1, Math.abs(x - 64) / 14) : 0;
      const wake = x < -60 && x > -170 && Math.abs(z) < 5 + (-60 - x) * 0.12 ? (1 - (-60 - x) / 110) * (0.6 + 0.4 * Math.sin(xs * 0.3)) : 0;
      const foam = Math.min(1, Math.max(nearHull * (0.55 + 0.45 * Math.sin(xs * 0.4 + z)), bow, wake));
      tmp.position.set(x, y + h * 0.9 + foam * 0.3, z);
      tmp.scale.set(1, 1 + foam * 0.4, 1);
      tmp.updateMatrix();
      mesh.setMatrixAt(k, tmp.matrix);
      col.copy(cDeep).lerp(cTop, Math.min(1, Math.max(0, h * 0.5 + 0.45)));
      col.lerp(cFoam, foam * 0.85);
      mesh.setColorAt(k, col);
      k++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return (
    <>
      <primitive object={mesh} />
      <Part geo={circle(2600, 48)} color={TPAL.seaDeep} rough={0.6} rotation={[-Math.PI / 2, 0, 0]} position={[0, y - 0.4, 0]} shadow={false} />
    </>
  );
};

export const Iceberg: React.FC<{ position: V3; s?: number }> = ({ position, s = 1 }) => (
  <group position={position} scale={s}>
    <Part geo={ico(6, 0)} color="#E9F3FB" flat rough={0.5} position={[0, 2, 0]} scale={[1.2, 1.1, 1]} shadow={false} />
    <Part geo={ico(4, 0)} color="#D2E5F3" flat rough={0.5} position={[4.5, 4.5, 1]} rotation={[0.4, 1, 0]} shadow={false} />
    <Part geo={ico(3.4, 0)} color="#F4FAFF" flat rough={0.5} position={[-3.8, 1.5, 2]} rotation={[1, 0.3, 0]} shadow={false} />
    <Part geo={ico(2.6, 0)} color="#DDEBF6" flat rough={0.5} position={[1.5, 8.2, -0.5]} rotation={[0.2, 0.6, 0.4]} shadow={false} />
  </group>
);

// ---------------------------------------------------------------- arched openings
/** An arch outline (rectangle + half circle) as a hole path or a shape. */
const archPath = <T extends THREE.Path>(p: T, cx: number, w: number, yb: number, ys: number) => {
  const r = w / 2;
  p.moveTo(cx - r, yb);
  p.lineTo(cx + r, yb);
  p.lineTo(cx + r, ys);
  p.absarc(cx, ys, r, 0, Math.PI, false);
  p.lineTo(cx - r, yb);
  return p;
};
export type Arch = { cx: number; w: number; yb: number; ys: number; rect?: boolean };
/** Flat wall (x from -w/2..w/2, y 0..h) with arched / rectangular holes, extruded `d` along +z. */
export const wallGeo = (w: number, h: number, holes: Arch[], d: number) => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.lineTo(-w / 2, 0);
  for (const a of holes) {
    if (a.rect) {
      const p = new THREE.Path();
      p.moveTo(a.cx - a.w / 2, a.yb);
      p.lineTo(a.cx + a.w / 2, a.yb);
      p.lineTo(a.cx + a.w / 2, a.ys);
      p.lineTo(a.cx - a.w / 2, a.ys);
      p.lineTo(a.cx - a.w / 2, a.yb);
      s.holes.push(p);
    } else s.holes.push(archPath(new THREE.Path(), a.cx, a.w, a.yb, a.ys));
  }
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 20 });
};
export const archGeo = (a: Arch) => new THREE.ShapeGeometry(archPath(new THREE.Shape(), a.cx, a.w, a.yb, a.ys), 20);

/** Window frame for an arch (posts, sill, arched head, a thin cross bar up in the fan light, kept out of the centre). */
export const ArchFrame: React.FC<{ a: Arch; color?: string; z?: number }> = ({ a, color = TPAL.brass, z = 0 }) => {
  const r = a.w / 2;
  return (
    <group position={[a.cx, 0, z]}>
      {[-1, 1].map((k) => (
        <Part key={k} geo={rbox(0.16, a.ys - a.yb + 0.05, 0.2, 0.04)} color={color} position={[k * (r + 0.02), (a.yb + a.ys) / 2, 0]} shadow={false} />
      ))}
      <Part geo={rbox(a.w + 0.4, 0.16, 0.34, 0.05)} color={color} position={[0, a.yb - 0.04, 0.04]} shadow={false} />
      <Part geo={torusArc(r + 0.02, 0.08, Math.PI)} color={color} position={[0, a.ys, 0]} shadow={false} />
      {/* fan light spokes */}
      {[0.35, 0.5, 0.65].map((t) => {
        const ang = t * Math.PI;
        return <Part key={t} geo={box(0.04, r, 0.04)} color={color} position={[Math.cos(ang) * r * 0.5, a.ys + Math.sin(ang) * r * 0.5, 0]} rotation={[0, 0, ang - Math.PI / 2]} shadow={false} />;
      })}
      <Part geo={box(a.w, 0.04, 0.04)} color={color} position={[0, a.ys, 0]} shadow={false} />
    </group>
  );
};

// ---------------------------------------------------------------- ship
// Ship plan: length along x (bow +x), beam along z. Boat deck at y = 0 (the gym floor), waterline at y = -17.
const HULL_HALF = 11;
const hullShape = (inset = 0) => {
  const b = HULL_HALF - inset;
  const s = new THREE.Shape();
  s.moveTo(-54 + inset, -b);
  s.lineTo(36, -b);
  s.quadraticCurveTo(58 - inset, -b * 0.85, 66 - inset * 1.5, 0);
  s.quadraticCurveTo(58 - inset, b * 0.85, 36, b);
  s.lineTo(-54 + inset, b);
  s.quadraticCurveTo(-64 + inset, b * 0.9, -64 + inset, 0);
  s.quadraticCurveTo(-64 + inset, -b * 0.9, -54 + inset, -b);
  return s;
};
const HULL_GEO = new THREE.ExtrudeGeometry(hullShape(0), { depth: 13.5, bevelEnabled: false, curveSegments: 16 });
const UPPER_GEO = new THREE.ExtrudeGeometry(hullShape(0.25), { depth: 6.6, bevelEnabled: false, curveSegments: 16 });
const BOOT_GEO = new THREE.ExtrudeGeometry(hullShape(0.05), { depth: 1.4, bevelEnabled: false, curveSegments: 16 });
const DECK_GEO = new THREE.ExtrudeGeometry(hullShape(0.1), { depth: 0.4, bevelEnabled: false, curveSegments: 16 });

/** Static windows on the starboard (+z) side: an instanced set, some lit, some dim. */
const ShipWindows: React.FC = () => {
  const meshes = useMemo(() => {
    const lit: THREE.Matrix4[] = [];
    const dim: THREE.Matrix4[] = [];
    const o = new THREE.Object3D();
    const rows: { y: number; w: number; h: number; z: number; x0: number; x1: number; step: number }[] = [
      { y: -14.2, w: 0.55, h: 0.55, z: HULL_HALF + 0.06, x0: -50, x1: 34, step: 2.1 },
      { y: -11.6, w: 0.6, h: 0.6, z: HULL_HALF + 0.06, x0: -50, x1: 36, step: 2.1 },
      { y: -9.0, w: 0.65, h: 0.65, z: HULL_HALF + 0.06, x0: -52, x1: 38, step: 2.1 },
      { y: -5.6, w: 1.0, h: 0.8, z: HULL_HALF - 0.25 + 0.06, x0: -50, x1: 36, step: 1.8 },
      { y: -2.6, w: 1.1, h: 0.9, z: HULL_HALF - 0.25 + 0.06, x0: -50, x1: 36, step: 1.8 },
      { y: 3.0, w: 0.9, h: 1.0, z: 5.36, x0: -40, x1: -8.5, step: 2.0 },
      { y: 3.0, w: 0.9, h: 1.0, z: 5.36, x0: 8.5, x1: 34, step: 2.0 },
    ];
    for (const r of rows) {
      let i = 0;
      for (let x = r.x0; x <= r.x1; x += r.step, i++) {
        o.position.set(x, r.y, r.z);
        o.scale.set(r.w, r.h, 1);
        o.updateMatrix();
        (hash(x * 3.1 + r.y * 7.7) > 0.22 ? lit : dim).push(o.matrix.clone());
      }
    }
    const geo = new THREE.PlaneGeometry(1, 1);
    const mk = (list: THREE.Matrix4[], color: string) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false }), list.length);
      list.forEach((mm, i) => m.setMatrixAt(i, mm));
      m.frustumCulled = false;
      return m;
    };
    return [mk(lit, TPAL.winLit), mk(dim, TPAL.winDim)];
  }, []);
  return (
    <>
      <primitive object={meshes[0]} />
      <primitive object={meshes[1]} />
    </>
  );
};

const FUNNEL_X = [31, 12, -12, -31];
/** One smoke puff stream per funnel: puffs are born on a schedule and drift aft (-x) and up. */
const Smoke: React.FC<{ frame: number; x: number; top: number; seed: number }> = ({ frame, x, top, seed }) => {
  const period = 9;
  const life = 80;
  const out: React.ReactNode[] = [];
  const first = Math.floor((frame - life) / period);
  for (let n = first; n <= Math.floor(frame / period); n++) {
    const age = frame - n * period - (hash(n + seed) * 4);
    if (age < 0 || age > life) continue;
    const a = age / life;
    const s = 1.8 + a * 5.5;
    out.push(
      <Part
        key={n}
        geo={ico(1, 1)}
        color={a < 0.15 ? "#8C93A3" : "#A9B3C6"}
        flat
        rough={1}
        opacity={0.85 * (1 - a) * Math.min(1, age / 5)}
        position={[x - 2 - age * 0.38, top + 1 + age * 0.16 + Math.sin(n * 1.7) * 0.8, (hash(n * 3 + seed) - 0.5) * 4]}
        rotation={[n, n * 0.7, 0]}
        scale={s}
        shadow={false}
      />,
    );
  }
  return <>{out}</>;
};

const Funnel: React.FC<{ x: number }> = ({ x }) => (
  <group position={[x, 6.4, 0]} rotation={[0, 0, 0.1]}>
    <group scale={[1.35, 1, 1]}>
      <Part geo={cyl(3.0, 3.1, 17, 24)} color={TPAL.buff} position={[0, 8.5, 0]} shadow={false} />
      <Part geo={cyl(3.04, 3.04, 3.2, 24)} color={TPAL.funnelTop} position={[0, 15.4, 0]} shadow={false} />
      <Part geo={cyl(3.15, 3.15, 0.4, 24)} color={TPAL.funnelTop} position={[0, 2.2, 0]} shadow={false} />
    </group>
  </group>
);

const Lifeboat: React.FC<{ x: number; z: number }> = ({ x, z }) => (
  <group position={[x, 0, z]}>
    {[-1.2, 1.2].map((k) => (
      <Part key={k} geo={box(0.18, 2.6, 0.18)} color={TPAL.white} position={[k, 1.3, 0]} shadow={false} />
    ))}
    <Part geo={rbox(3.2, 0.9, 1.3, 0.4)} color="#F7F7F5" position={[0, 1.8, 0]} shadow={false} />
    <Part geo={box(3.0, 0.08, 1.1)} color="#9A7550" position={[0, 2.26, 0]} shadow={false} />
  </group>
);

/** The Titanic around the gym room (the room itself, x -6.5..6.5 / z -5..5 on the boat deck, is drawn elsewhere). */
export const Ship: React.FC<{ frame: number }> = ({ frame }) => (
  <group>
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -21, 0]}>
      <mesh geometry={HULL_GEO}>
        <meshStandardMaterial color={TPAL.hull} roughness={0.55} />
      </mesh>
    </group>
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -18.2, 0]}>
      <mesh geometry={BOOT_GEO}>
        <meshStandardMaterial color={TPAL.hullRed} roughness={0.7} />
      </mesh>
    </group>
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -7.4, 0]}>
      <mesh geometry={UPPER_GEO}>
        <meshStandardMaterial color={TPAL.white} roughness={0.6} />
      </mesh>
    </group>
    {/* gold line between the black and the white */}
    <Part geo={box(88, 0.22, 0.05)} color={TPAL.brass} basic position={[-9, -7.55, HULL_HALF + 0.04]} shadow={false} />
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
      <mesh geometry={DECK_GEO}>
        <meshStandardMaterial color="#C9B48E" roughness={0.8} />
      </mesh>
    </group>
    {/* deckhouses before and after the gym (the gym room is the gap between them) */}
    <Part geo={box(34, 6.8, 10.6)} color={TPAL.white} position={[-23.65, 3.0, 0]} shadow={false} />
    <Part geo={box(28, 6.8, 10.6)} color={TPAL.white} position={[20.65, 3.0, 0]} shadow={false} />
    <Part geo={box(76, 0.4, 11.4)} color="#D9DDE4" position={[-2, 6.6, 0]} shadow={false} />
    {/* bridge */}
    <Part geo={box(6, 3, 14)} color={TPAL.white} position={[36, 8.2, 0]} shadow={false} />
    <Part geo={box(5, 0.3, 15)} color="#D9DDE4" position={[36, 9.8, 0]} shadow={false} />
    {/* railing along the boat deck edge */}
    <Part geo={box(96, 0.12, 0.12)} color={TPAL.white} position={[-8, 1.1, HULL_HALF - 0.3]} shadow={false} />
    <Part geo={box(96, 0.1, 0.1)} color={TPAL.white} position={[-8, 0.55, HULL_HALF - 0.3]} shadow={false} />
    {FUNNEL_X.map((x) => (
      <Funnel key={x} x={x} />
    ))}
    {FUNNEL_X.map((x, i) => (
      <Smoke key={x} frame={frame} x={x + 2.4} top={6.4 + 17.5} seed={i * 11} />
    ))}
    {/* masts + the wire between them */}
    <Part geo={cyl(0.35, 0.45, 40, 8)} color="#B59A70" position={[52, 14, 0]} rotation={[0, 0, 0.06]} shadow={false} />
    <Part geo={cyl(0.35, 0.45, 38, 8)} color="#B59A70" position={[-50, 13, 0]} rotation={[0, 0, 0.06]} shadow={false} />
    <Part geo={box(103, 0.12, 0.12)} color="#7C8496" position={[0.5, 31.5, 0]} rotation={[0, 0, 0.01]} shadow={false} />
    {[-44, -38, -32, -26, -20, 16, 22, 28].map((x) => (
      <Lifeboat key={x} x={x} z={HULL_HALF - 1.6} />
    ))}
    <ShipWindows />
    {/* bow and stern lights */}
    <Part geo={sphere(0.5, 10)} color="#FFF3C4" basic position={[52, 34.5, 0]} shadow={false} />
    <Part geo={sphere(0.45, 10)} color="#9BFF9B" basic position={[37, 9.4, 7.6]} shadow={false} />
  </group>
);

// ---------------------------------------------------------------- the gym's furniture
/** A spur gear facing +z (teeth around the rim), turning by `angle`. */
export const Gear: React.FC<{ r: number; teeth?: number; angle: number; color?: string; t?: number; position?: V3; rotation?: V3 }> = ({ r, teeth = 10, angle, color = TPAL.brass, t = 0.1, position, rotation }) => (
  <group position={position} rotation={rotation}>
    <group rotation={[0, 0, angle]}>
      <Part geo={cyl(r, r, t, 22)} color={color} rough={0.35} rotation={[Math.PI / 2, 0, 0]} />
      <Part geo={cyl(r * 0.3, r * 0.3, t + 0.04, 12)} color={TPAL.iron} rotation={[Math.PI / 2, 0, 0]} />
      {Array.from({ length: teeth }, (_, i) => {
        const a = (i / teeth) * Math.PI * 2;
        return <Part key={i} geo={box(r * 0.32, r * 0.26, t)} color={color} rough={0.35} position={[Math.cos(a) * (r + r * 0.1), Math.sin(a) * (r + r * 0.1), 0]} rotation={[0, 0, a]} />;
      })}
      {[0, 1, 2].map((i) => (
        <Part key={`h${i}`} geo={sphere(r * 0.14, 8)} color={TPAL.brassDark} position={[Math.cos((i * Math.PI * 2) / 3) * r * 0.6, Math.sin((i * Math.PI * 2) / 3) * r * 0.6, t / 2]} scale={[1, 1, 0.3]} />
      ))}
    </group>
  </group>
);

/** Spoked flywheel facing +x (spins about x). */
export const Flywheel: React.FC<{ r: number; angle: number; position?: V3; color?: string; glow?: number }> = ({ r, angle, position, color = TPAL.iron, glow = 0 }) => (
  <group position={position} rotation={[angle, 0, 0]}>
    <Part geo={torusArc(1, 0.1, Math.PI * 2)} color={color} rough={0.35} rotation={[0, Math.PI / 2, 0]} scale={r} emissive={TPAL.brass} emissiveIntensity={glow * 0.5} />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <Part key={i} geo={box(0.05, r * 2, 0.05)} color={TPAL.brass} rough={0.35} rotation={[(i * Math.PI) / 6, 0, 0]} emissive={TPAL.brass} emissiveIntensity={glow * 0.5} />
    ))}
    <Part geo={cyl(r * 0.18, r * 0.18, 0.16, 12)} color={TPAL.brass} rotation={[0, 0, Math.PI / 2]} />
  </group>
);

/** 1912 stationary bicycle facing +z (rider sits at y SEAT_Y, crank centre at BIKE_CRANK). */
export const BIKE_SEAT: V3 = [0, 1.18, -0.35];
export const BIKE_CRANK: V3 = [0, 0.85, 0.0];
export const PEDAL_R = 0.22;
export const OldBike: React.FC<{ crank: number; glow?: number }> = ({ crank, glow = 0 }) => {
  const g = glow * 0.7;
  const em = { emissive: "#FFB347", emissiveIntensity: g };
  return (
    <group>
      {/* iron stand */}
      <Part geo={rbox(0.9, 0.1, 2.0, 0.04)} color={TPAL.iron} position={[0, 0.05, 0.1]} {...em} />
      <Part geo={rbox(0.12, 1.05, 0.12, 0.03)} color={TPAL.iron} position={[0, 0.55, -0.35]} rotation={[-0.15, 0, 0]} {...em} />
      <Part geo={rbox(0.12, 1.45, 0.12, 0.03)} color={TPAL.iron} position={[0, 0.75, 0.7]} rotation={[0.2, 0, 0]} {...em} />
      <Part geo={rbox(0.1, 0.1, 1.1, 0.03)} color={TPAL.iron} position={[0, 0.9, 0.2]} rotation={[0.15, 0, 0]} {...em} />
      {/* big front flywheel (the wheel spins with the pedals) */}
      <group position={[0, 0.85, 0.75]}>
        <Flywheel r={0.62} angle={crank * 2.2} glow={glow} />
      </group>
      {/* saddle */}
      <Part geo={rbox(0.36, 0.12, 0.44, 0.06)} color={TPAL.leather} position={[BIKE_SEAT[0], BIKE_SEAT[1] - 0.06, BIKE_SEAT[2]]} {...em} />
      {/* handlebars: a curved moustache bar */}
      <group position={[0, 1.55, 0.55]}>
        <Part geo={rbox(1.0, 0.07, 0.07, 0.03)} color={TPAL.brass} rough={0.3} {...em} />
        {[-1, 1].map((k) => (
          <Part key={k} geo={rbox(0.1, 0.1, 0.24, 0.04)} color={TPAL.leather} position={[k * 0.5, 0, -0.08]} />
        ))}
      </group>
      {/* crank + pedals */}
      <group position={BIKE_CRANK} rotation={[crank, 0, 0]}>
        <Part geo={cyl(0.12, 0.12, 0.3, 12)} color={TPAL.brass} rotation={[0, 0, Math.PI / 2]} />
        {[-1, 1].map((k) => (
          <group key={k} rotation={[k > 0 ? 0 : Math.PI, 0, 0]}>
            <Part geo={box(0.05, PEDAL_R, 0.06)} color={TPAL.ironLight} position={[k * 0.2, PEDAL_R / 2, 0]} />
            <group position={[k * 0.3, PEDAL_R, 0]} rotation={[k > 0 ? -crank : -crank - Math.PI, 0, 0]}>
              <Part geo={rbox(0.24, 0.05, 0.16, 0.02)} color={TPAL.iron} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
};

/** The distance dial: a two-faced brass dial on a stand (face toward ±z), the hand turns with the pedalling. */
export const Dial: React.FC<{ angle: number; glow?: number }> = ({ angle, glow = 0 }) => (
  <group>
    <Part geo={rbox(0.7, 0.1, 0.5, 0.04)} color={TPAL.iron} position={[0, 0.05, 0]} />
    <Part geo={cyl(0.06, 0.08, 1.7, 10)} color={TPAL.iron} position={[0, 0.9, 0]} />
    <group position={[0, 2.25, 0]}>
      <Part geo={cyl(0.68, 0.68, 0.2, 32)} color={TPAL.brass} rough={0.3} rotation={[Math.PI / 2, 0, 0]} emissive="#FFB347" emissiveIntensity={glow * 0.6} />
      {[1, -1].map((side) => (
        <group key={side} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
          <Part geo={circle(0.58, 32)} color="#FFF6E2" basic position={[0, 0, 0.105]} shadow={false} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <Part key={i} geo={box(i % 3 === 0 ? 0.05 : 0.03, i % 3 === 0 ? 0.13 : 0.08, 0.01)} color={PAL.ink} basic position={[Math.sin(a) * 0.48, Math.cos(a) * 0.48, 0.11]} rotation={[0, 0, -a]} shadow={false} />;
          })}
          <group position={[0, 0, 0.12]} rotation={[0, 0, -angle * side]}>
            <Part geo={box(0.05, 0.46, 0.01)} color={PAL.terracotta} basic position={[0, 0.2, 0]} shadow={false} />
          </group>
          <Part geo={circle(0.05, 12)} color={PAL.ink} basic position={[0, 0, 0.125]} shadow={false} />
        </group>
      ))}
    </group>
  </group>
);

/** Rowing machine along +z (rower faces +z). `t` 0..1 through the stroke (0 = catch, 0.4 = finish). */
export const ROW_SEAT_Y = 0.55;
export const Rower: React.FC<{ seatZ: number; oar: number; wheel: number; glow?: number }> = ({ seatZ, oar, wheel, glow = 0 }) => {
  const em = { emissive: "#FFB347", emissiveIntensity: glow * 0.7 };
  return (
    <group>
      <Part geo={rbox(0.5, 0.12, 2.8, 0.04)} color={TPAL.oakDark} position={[0, 0.3, 0]} {...em} />
      {[-1.25, 1.25].map((z) => (
        <Part key={z} geo={rbox(0.9, 0.3, 0.16, 0.04)} color={TPAL.iron} position={[0, 0.15, z]} {...em} />
      ))}
      {/* sliding seat */}
      <Part geo={rbox(0.5, 0.12, 0.5, 0.05)} color={TPAL.leather} position={[0, ROW_SEAT_Y - 0.06, seatZ]} {...em} />
      {/* foot stretcher */}
      <Part geo={rbox(0.7, 0.36, 0.08, 0.03)} color={TPAL.oak} position={[0, 0.48, 1.25]} rotation={[-0.5, 0, 0]} {...em} />
      {/* outriggers + oar levers (they swing with the stroke) */}
      {[-1, 1].map((k) => (
        <group key={k}>
          <Part geo={rbox(0.7, 0.06, 0.06, 0.02)} color={TPAL.brass} position={[k * 0.55, 0.62, 0.55]} />
          <group position={[k * 0.88, 0.66, 0.55]} rotation={[oar, 0, 0]}>
            <Part geo={cyl(0.035, 0.035, 1.25, 8)} color={TPAL.oakLight} position={[0, 0.6, 0]} {...em} />
            <Part geo={rbox(0.08, 0.2, 0.08, 0.03)} color={TPAL.leather} position={[0, 1.2, 0]} />
          </group>
        </group>
      ))}
      {/* the electric motor box + flywheel at the front */}
      <Part geo={rbox(0.7, 0.55, 0.55, 0.06)} color={TPAL.oakDark} position={[0, 0.4, 1.7]} {...em} />
      <Part geo={rbox(0.5, 0.14, 0.4, 0.04)} color={TPAL.brass} position={[0, 0.72, 1.7]} />
      <group position={[0.42, 0.45, 1.7]}>
        <Flywheel r={0.32} angle={wheel} glow={glow} />
      </group>
    </group>
  );
};

/** Mechanical horse on a gear pedestal, facing +z. `rock` = body pitch, `gear` = gear angle. */
export const HORSE_SADDLE_Y = 1.75;
export const MechHorse: React.FC<{ rock: number; bounce: number; gear: number; glow?: number; children?: React.ReactNode }> = ({ rock, bounce, gear, glow = 0, children }) => {
  const em = { emissive: "#FFB347", emissiveIntensity: glow * 0.7 };
  const hide = "#A9744A";
  return (
    <group>
      {/* pedestal with visible gears */}
      <Part geo={rbox(1.1, 0.14, 1.9, 0.04)} color={TPAL.iron} position={[0, 0.07, 0]} {...em} />
      <Part geo={rbox(0.7, 0.85, 1.1, 0.06)} color={TPAL.oakDark} position={[0, 0.55, 0]} {...em} />
      <Gear r={0.3} teeth={10} angle={gear} position={[0.37, 0.58, 0.12]} rotation={[0, Math.PI / 2, 0]} />
      <Gear r={0.18} teeth={8} angle={-gear * 1.67 + 0.3} position={[0.37, 0.78, -0.34]} rotation={[0, Math.PI / 2, 0]} color={TPAL.brassDark} />
      <Gear r={0.3} teeth={10} angle={-gear} position={[-0.37, 0.58, 0.12]} rotation={[0, Math.PI / 2, 0]} />
      <Part geo={cyl(0.1, 0.12, 0.5, 10)} color={TPAL.brass} position={[0, 1.12, 0]} />
      {/* the horse body rocks on the pivot */}
      <group position={[0, 1.3 + bounce, 0]} rotation={[rock, 0, 0]}>
        <Part geo={rbox(0.72, 0.62, 1.6, 0.25)} color={hide} position={[0, 0.12, 0]} {...em} />
        {/* neck + head */}
        <group position={[0, 0.35, 0.75]} rotation={[-0.55 + rock * 0.4, 0, 0]}>
          <Part geo={rbox(0.42, 0.95, 0.46, 0.15)} color={hide} position={[0, 0.4, 0]} {...em} />
          <group position={[0, 0.88, 0.12]} rotation={[1.05, 0, 0]}>
            <Part geo={rbox(0.38, 0.72, 0.4, 0.14)} color={hide} position={[0, 0.2, 0]} {...em} />
            <Part geo={rbox(0.32, 0.16, 0.36, 0.06)} color="#5C3A22" position={[0, 0.55, 0.0]} />
            {[-1, 1].map((k) => (
              <Part key={k} geo={sphere(0.055, 10)} color={PAL.ink} position={[k * 0.2, 0.06, 0.12]} />
            ))}
            {[-1, 1].map((k) => (
              <Part key={`e${k}`} geo={rbox(0.08, 0.1, 0.18, 0.03)} color={hide} position={[k * 0.12, -0.12, -0.2]} rotation={[-0.4, 0, 0]} />
            ))}
          </group>
          {/* mane */}
          <Part geo={rbox(0.1, 0.9, 0.16, 0.04)} color="#4A2E1C" position={[0, 0.42, -0.25]} />
        </group>
        {/* tail */}
        <Part geo={rbox(0.14, 0.62, 0.14, 0.05)} color="#4A2E1C" position={[0, -0.05, -0.85]} rotation={[0.5 + Math.sin(rock * 8) * 0.1, 0, 0]} />
        {/* saddle */}
        <Part geo={rbox(0.78, 0.12, 0.62, 0.05)} color="#5A2D1C" position={[0, HORSE_SADDLE_Y - 1.3 - 0.06, -0.05]} />
        <Part geo={rbox(0.3, 0.16, 0.12, 0.05)} color="#5A2D1C" position={[0, HORSE_SADDLE_Y - 1.3, 0.24]} />
        {/* stirrups */}
        {[-1, 1].map((k) => (
          <Part key={`s${k}`} geo={box(0.03, 0.55, 0.03)} color={TPAL.brass} position={[k * 0.42, -0.05, 0.05]} />
        ))}
        {children}
      </group>
    </group>
  );
};

/** Mechanical camel: the same pedestal, a long-legged body with a hump. */
export const CAMEL_SADDLE_Y = 2.1;
export const MechCamel: React.FC<{ rock: number; bounce: number; gear: number; glow?: number; children?: React.ReactNode }> = ({ rock, bounce, gear, glow = 0, children }) => {
  const em = { emissive: "#FFB347", emissiveIntensity: glow * 0.7 };
  const fur = "#D2A86E";
  return (
    <group>
      <Part geo={rbox(1.1, 0.14, 2.1, 0.04)} color={TPAL.iron} position={[0, 0.07, 0]} />
      <Part geo={rbox(0.7, 1.15, 1.1, 0.06)} color={TPAL.oakDark} position={[0, 0.7, 0]} />
      <Gear r={0.34} teeth={12} angle={gear} position={[0.37, 0.75, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Gear r={0.34} teeth={12} angle={-gear} position={[-0.37, 0.75, 0]} rotation={[0, Math.PI / 2, 0]} />
      <group position={[0, 1.6 + bounce, 0]} rotation={[rock, 0, 0]}>
        <Part geo={rbox(0.76, 0.6, 1.7, 0.25)} color={fur} position={[0, 0.1, 0]} {...em} />
        <Part geo={sphere(0.42, 14)} color={fur} position={[0, 0.42, -0.3]} scale={[0.9, 0.9, 1.1]} {...em} />
        <group position={[0, 0.2, 0.8]} rotation={[-0.25, 0, 0]}>
          <Part geo={rbox(0.32, 1.1, 0.36, 0.13)} color={fur} position={[0, 0.5, 0.15]} rotation={[0.5, 0, 0]} {...em} />
          <group position={[0, 1.05, 0.5]}>
            <Part geo={rbox(0.36, 0.36, 0.62, 0.14)} color={fur} position={[0, 0, 0.12]} {...em} />
            {[-1, 1].map((k) => (
              <Part key={k} geo={sphere(0.05, 10)} color={PAL.ink} position={[k * 0.19, 0.08, 0.2]} />
            ))}
            {[-1, 1].map((k) => (
              <Part key={`e${k}`} geo={rbox(0.07, 0.08, 0.12, 0.03)} color={fur} position={[k * 0.15, 0.2, -0.12]} />
            ))}
          </group>
        </group>
        {/* saddle blanket */}
        <Part geo={rbox(0.82, 0.1, 0.6, 0.04)} color={PAL.terracotta} position={[0, CAMEL_SADDLE_Y - 1.6 - 0.05, 0.25]} />
        <Part geo={rbox(0.84, 0.3, 0.06, 0.02)} color={PAL.mustard} position={[0, CAMEL_SADDLE_Y - 1.6 - 0.18, 0.25]} />
        {children}
      </group>
    </group>
  );
};

/** Brass chandelier hanging from its pivot (origin = ceiling point); `swing` = rotation about z (world-vertical when tilted). */
export const Chandelier: React.FC<{ swing: number; swingX?: number; lit?: number; drop?: number }> = ({ swing, swingX = 0, lit = 1, drop = 1.15 }) => (
  <group rotation={[swingX, 0, swing]}>
    <Part geo={cyl(0.03, 0.03, drop, 6)} color={TPAL.brassDark} position={[0, -drop / 2, 0]} shadow={false} />
    <group position={[0, -drop, 0]}>
      <Part geo={sphere(0.18, 12)} color={TPAL.brass} rough={0.3} shadow={false} />
      <Part geo={torusArc(0.62, 0.035, Math.PI * 2)} color={TPAL.brass} rough={0.3} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.18, 0]} shadow={false} />
      <Part geo={torusArc(0.36, 0.03, Math.PI * 2)} color={TPAL.brass} rough={0.3} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.36, 0]} shadow={false} />
      <Part geo={sphere(0.1, 10)} color={TPAL.brass} position={[0, -0.5, 0]} shadow={false} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 0.62, -0.18, Math.sin(a) * 0.62]}>
            <Part geo={cyl(0.05, 0.04, 0.12, 8)} color={TPAL.brass} position={[0, 0.06, 0]} shadow={false} />
            <Part geo={sphere(0.085, 10)} color="#FFF1C2" emissive="#FFD27A" emissiveIntensity={1.4 * lit} position={[0, 0.2, 0]} scale={[0.8, 1.2, 0.8]} shadow={false} />
            <Part geo={ico(0.05, 0)} color="#DDF2FF" emissive="#BFE3FF" emissiveIntensity={0.5} rough={0.1} position={[0, -0.14, 0]} scale={[0.7, 1.4, 0.7]} shadow={false} />
          </group>
        );
      })}
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        return <Part key={`c${i}`} geo={ico(0.045, 0)} color="#DDF2FF" emissive="#BFE3FF" emissiveIntensity={0.5} position={[Math.cos(a) * 0.36, -0.48, Math.sin(a) * 0.36]} scale={[0.7, 1.5, 0.7]} shadow={false} />;
      })}
      {/* warm halo */}
      <Part geo={sphere(0.95, 16)} color="#FFD58A" basic opacity={0.1 * lit} position={[0, -0.1, 0]} shadow={false} />
    </group>
  </group>
);

/** Old wall clock (brass rim, cream face). Hands in radians (clockwise from 12). */
export const OldClock: React.FC<{ hour: number; minute: number; position?: V3; blur?: number }> = ({ hour, minute, position, blur = 0 }) => (
  <group position={position}>
    <Part geo={cyl(0.62, 0.62, 0.12, 32)} color={TPAL.brass} rough={0.3} rotation={[Math.PI / 2, 0, 0]} shadow={false} />
    <Part geo={circle(0.52, 32)} color="#FFF6E2" basic position={[0, 0, 0.065]} shadow={false} />
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return <Part key={i} geo={box(0.04, i % 3 === 0 ? 0.12 : 0.07, 0.01)} color={PAL.ink} basic position={[Math.sin(a) * 0.43, Math.cos(a) * 0.43, 0.07]} rotation={[0, 0, -a]} shadow={false} />;
    })}
    {/* a faint motion disc when the minute hand races */}
    {blur > 0.02 && <Part geo={circle(0.4, 32)} color="#E9D9B6" basic opacity={Math.min(0.7, blur)} position={[0, 0, 0.071]} shadow={false} />}
    <group position={[0, 0, 0.075]} rotation={[0, 0, -hour]}>
      <Part geo={box(0.06, 0.26, 0.01)} color={PAL.ink} basic position={[0, 0.11, 0]} shadow={false} />
    </group>
    <group position={[0, 0, 0.08]} rotation={[0, 0, -minute]}>
      <Part geo={box(0.04, 0.4, 0.01)} color={PAL.ink} basic position={[0, 0.17, 0]} shadow={false} />
    </group>
    <Part geo={circle(0.045, 12)} color={TPAL.brassDark} basic position={[0, 0, 0.09]} shadow={false} />
  </group>
);

// seven-segment glyphs built from rounded bars: a b c d e f g
const SEGS: Record<string, string> = { "1": "bc", "9": "abcdfg", "2": "abged" };
/** One blocky gold digit (0.9 wide, 1.5 tall), origin at its centre. */
export const Digit: React.FC<{ d: string; color?: string; t?: number }> = ({ d, color = TPAL.gold, t = 0.16 }) => {
  const W = 0.8;
  const H = 1.4;
  const segs = SEGS[d] ?? "";
  const hz = (y: number) => <Part geo={rbox(W, t, t, t / 2.2)} color={color} rough={0.3} emissive={TPAL.goldDark} emissiveIntensity={0.25} position={[0, y, 0]} />;
  const vt = (x: number, y: number) => <Part geo={rbox(t, H / 2 + t * 0.2, t, t / 2.2)} color={color} rough={0.3} emissive={TPAL.goldDark} emissiveIntensity={0.25} position={[x, y, 0]} />;
  return (
    <group>
      {segs.includes("a") && hz(H / 2)}
      {segs.includes("g") && hz(0)}
      {segs.includes("d") && hz(-H / 2)}
      {segs.includes("b") && vt(W / 2, H / 4)}
      {segs.includes("c") && vt(W / 2, -H / 4)}
      {segs.includes("f") && vt(-W / 2, H / 4)}
      {segs.includes("e") && vt(-W / 2, -H / 4)}
      {d === "1" && (
        <>
          <Part geo={rbox(0.38, t, t, t / 2.2)} color={color} rough={0.3} position={[W / 2 - 0.16, H / 2 - 0.12, 0]} rotation={[0, 0, -0.6]} />
          <Part geo={rbox(0.5, t, t, t / 2.2)} color={color} rough={0.3} position={[W / 2, -H / 2, 0]} />
        </>
      )}
    </group>
  );
};

/** The 1912 plaque: dark oak board with a gold frame; each digit pops in with its own scale `pops[i]`. */
export const Plaque1912: React.FC<{ pops: number[]; shine?: number }> = ({ pops, shine = 0 }) => (
  <group>
    <Part geo={rbox(4.3, 2.1, 0.14, 0.05)} color={TPAL.oakDark} shadow={false} />
    <Part geo={rbox(4.5, 0.12, 0.18, 0.04)} color={TPAL.brass} position={[0, 1.1, 0.02]} shadow={false} />
    <Part geo={rbox(4.5, 0.12, 0.18, 0.04)} color={TPAL.brass} position={[0, -1.1, 0.02]} shadow={false} />
    {[-1, 1].map((k) => (
      <Part key={k} geo={rbox(0.12, 2.3, 0.18, 0.04)} color={TPAL.brass} position={[k * 2.2, 0, 0.02]} shadow={false} />
    ))}
    {["1", "9", "1", "2"].map((d, i) => (
      <group key={i} position={[-1.5 + i * 1.0 + (d === "1" ? -0.12 : 0), 0, 0.14]} scale={Math.max(0.001, pops[i] ?? 1)}>
        <Digit d={d} />
      </group>
    ))}
    {shine > 0 && <Part geo={box(0.5, 2.0, 0.01)} color="#FFFFFF" basic opacity={0.28 * Math.sin(Math.PI * Math.min(1, shine))} position={[-2 + shine * 4, 0, 0.26]} rotation={[0, 0, 0.35]} shadow={false} />}
  </group>
);

// ---------------------------------------------------------------- hats + clothes (Blocky headgear / chest nodes)
export const Bowler: React.FC<{ color?: string }> = ({ color = "#222326" }) => (
  <group position={[0, 0.86, -0.02]}>
    <Part geo={cyl(0.6, 0.6, 0.05, 24)} color={color} position={[0, 0.02, 0]} />
    <Part geo={sphere(0.4, 18)} color={color} position={[0, 0.06, 0]} scale={[1.05, 0.85, 1]} />
    <Part geo={cyl(0.405, 0.405, 0.07, 24)} color="#5A2E2E" position={[0, 0.1, 0]} />
  </group>
);
export const FlatCap: React.FC<{ color?: string }> = ({ color = "#7D6A52" }) => (
  <group position={[0, 0.86, 0]}>
    <Part geo={rbox(0.92, 0.16, 0.84, 0.07)} color={color} position={[0, 0.05, -0.02]} />
    <Part geo={rbox(0.72, 0.05, 0.3, 0.02)} color={color} position={[0, -0.02, 0.48]} rotation={[0.15, 0, 0]} />
  </group>
);
export const Boater: React.FC<{ ribbon?: string }> = ({ ribbon = "#2F3E66" }) => (
  <group position={[0, 0.86, -0.02]}>
    <Part geo={cyl(0.66, 0.66, 0.05, 24)} color="#F0D795" position={[0, 0.02, 0]} />
    <Part geo={cyl(0.42, 0.42, 0.26, 24)} color="#F0D795" position={[0, 0.16, 0]} />
    <Part geo={cyl(0.425, 0.425, 0.09, 24)} color={ribbon} position={[0, 0.08, 0]} />
  </group>
);
export const LadyHat: React.FC<{ color?: string; flower?: string }> = ({ color = "#F3E6D2", flower = PAL.blush }) => (
  <group position={[0, 0.86, -0.04]} rotation={[-0.08, 0, 0.08]}>
    <Part geo={cyl(0.78, 0.8, 0.05, 28)} color={color} position={[0, 0.02, 0]} />
    <Part geo={cyl(0.4, 0.44, 0.28, 24)} color={color} position={[0, 0.17, 0]} />
    <Part geo={cyl(0.445, 0.445, 0.08, 24)} color={flower} position={[0, 0.08, 0]} />
    <Part geo={sphere(0.13, 12)} color={flower} position={[0.38, 0.16, 0.18]} />
    <Part geo={sphere(0.1, 12)} color="#FFFFFF" position={[0.5, 0.14, 0.04]} />
  </group>
);
export const Moustache: React.FC<{ color?: string }> = ({ color = "#3B2A20" }) => (
  <group position={[0, 0.24, 0.4]}>
    {[-1, 1].map((k) => (
      <Part key={k} geo={rbox(0.17, 0.07, 0.05, 0.03)} color={color} position={[k * 0.08, 0, 0]} rotation={[0, 0, k * 0.22]} />
    ))}
  </group>
);
export const Bun: React.FC<{ color: string }> = ({ color }) => <Part geo={sphere(0.2, 14)} color={color} position={[0, 0.72, -0.42]} />;

/** Suit front: white shirt V, tie, lapels (torso-local). */
export const SuitFront: React.FC<{ tie?: string; jacket: string }> = ({ tie = "#A8322B", jacket }) => (
  <group position={[0, 0.62, 0.252]}>
    <Part geo={box(0.3, 0.34, 0.01)} color="#FFFFFF" position={[0, 0.02, 0]} shadow={false} />
    <Part geo={box(0.08, 0.3, 0.012)} color={tie} position={[0, 0.0, 0.003]} shadow={false} />
    {[-1, 1].map((k) => (
      <Part key={k} geo={box(0.12, 0.42, 0.014)} color={jacket} position={[k * 0.16, -0.02, 0.004]} rotation={[0, 0, k * 0.32]} shadow={false} />
    ))}
    {[0, 1].map((i) => (
      <Part key={`b${i}`} geo={circle(0.025, 10)} color={TPAL.brass} basic position={[0, -0.3 - i * 0.14, 0.008]} shadow={false} />
    ))}
  </group>
);
/** Dress bodice front: a lace collar and a brooch. */
export const DressFront: React.FC<{ lace?: string }> = ({ lace = "#FFF7EC" }) => (
  <group position={[0, 0.7, 0.252]}>
    <Part geo={rbox(0.5, 0.14, 0.02, 0.05)} color={lace} position={[0, 0.06, 0]} shadow={false} />
    <Part geo={circle(0.05, 12)} color={TPAL.gold} basic position={[0, -0.04, 0.012]} shadow={false} />
    <Part geo={box(0.8, 0.06, 0.012)} color={lace} position={[0, -0.62, 0]} shadow={false} />
  </group>
);

// ---------------------------------------------------------------- modern set
/** Modern spin bike facing +z (same seat height as the old one so the rider swap is a pure scale pop). */
export const ModernBike: React.FC<{ crank: number }> = ({ crank }) => (
  <group>
    <Part geo={rbox(0.8, 0.1, 1.7, 0.05)} color={PAL.ink} position={[0, 0.05, 0.1]} />
    <Part geo={rbox(0.16, 1.2, 0.2, 0.06)} color={PAL.teal} position={[0, 0.62, -0.25]} rotation={[-0.25, 0, 0]} />
    <Part geo={rbox(0.16, 1.4, 0.2, 0.06)} color={PAL.teal} position={[0, 0.72, 0.65]} rotation={[0.3, 0, 0]} />
    <Part geo={rbox(0.14, 0.14, 1.0, 0.05)} color={PAL.teal} position={[0, 0.7, 0.25]} />
    {/* covered flywheel */}
    <group position={[0, 0.62, 0.78]}>
      <Part geo={cyl(0.4, 0.4, 0.16, 28)} color={PAL.terracotta} rotation={[0, 0, Math.PI / 2]} />
      <group rotation={[crank * 2, 0, 0]}>
        {[0, 1].map((i) => (
          <Part key={i} geo={box(0.18, 0.06, 0.6)} color={PAL.cream} rotation={[(i * Math.PI) / 2, 0, 0]} />
        ))}
      </group>
    </group>
    <Part geo={rbox(0.36, 0.1, 0.46, 0.05)} color={PAL.ink} position={[BIKE_SEAT[0], BIKE_SEAT[1] - 0.06, BIKE_SEAT[2]]} />
    <group position={[0, 1.5, 0.55]}>
      <Part geo={rbox(0.7, 0.08, 0.08, 0.04)} color={PAL.ink} />
      <Part geo={rbox(0.36, 0.24, 0.06, 0.04)} color={PAL.ink} position={[0, 0.14, 0.04]} rotation={[-0.4, 0, 0]} />
      <Part geo={box(0.28, 0.16, 0.01)} color="#7FE3D6" basic position={[0, 0.155, 0.075]} rotation={[-0.4, 0, 0]} shadow={false} />
    </group>
    <group position={BIKE_CRANK} rotation={[crank, 0, 0]}>
      {[-1, 1].map((k) => (
        <group key={k} rotation={[k > 0 ? 0 : Math.PI, 0, 0]}>
          <Part geo={box(0.05, PEDAL_R, 0.06)} color={PAL.steel} position={[k * 0.2, PEDAL_R / 2, 0]} />
          <group position={[k * 0.3, PEDAL_R, 0]} rotation={[k > 0 ? -crank : -crank - Math.PI, 0, 0]}>
            <Part geo={rbox(0.24, 0.05, 0.16, 0.02)} color={PAL.ink} />
          </group>
        </group>
      ))}
    </group>
  </group>
);

/** A bright modern wall segment (x from -w/2..w/2, y 0..h, face +z) with big daylight windows. */
export const ModernWall: React.FC<{ w: number; h: number; windows: { cx: number; w: number }[]; frame: number }> = ({ w, h, windows, frame }) => (
  <group>
    <Part geo={box(w, h, 0.2)} color={TPAL.modernWall} position={[0, h / 2, 0]} shadow={false} />
    <Part geo={box(w, 0.5, 0.04)} color={PAL.teal} position={[0, 0.25, 0.11]} shadow={false} />
    <Part geo={box(w, 0.08, 0.04)} color={PAL.mustard} position={[0, 1.6, 0.11]} shadow={false} />
    {windows.map((win, i) => (
      <group key={i} position={[win.cx, 3.5, 0.11]}>
        <Part geo={rbox(win.w + 0.2, 2.9, 0.06, 0.05)} color={PAL.ink} shadow={false} />
        <Part geo={box(win.w, 2.7, 0.01)} color="#9ED7EE" basic position={[0, 0, 0.035]} shadow={false} />
        {/* soft clouds drifting in the glass */}
        {[0, 1].map((c) => (
          <Part key={c} geo={rbox(0.9, 0.28, 0.01, 0.14)} color="#FFFFFF" basic position={[-win.w / 2 + 0.5 + (((frame * 0.006 + c * 0.55 + i * 0.3) % 1) * (win.w - 1)), 0.6 - c * 0.7, 0.042]} shadow={false} />
        ))}
        <Part geo={box(0.06, 2.7, 0.03)} color={PAL.ink} position={[0, 0, 0.05]} shadow={false} />
      </group>
    ))}
  </group>
);

/** Plain gold coin facing +z (a disc with a raised rim), spinning about y by `spin`. */
export const GoldCoin: React.FC<{ spin: number; s?: number }> = ({ spin, s = 1 }) => (
  <group rotation={[0, spin, 0]} scale={s}>
    <Part geo={cyl(0.36, 0.36, 0.08, 32)} color={TPAL.gold} rough={0.25} emissive={TPAL.goldDark} emissiveIntensity={0.45} rotation={[Math.PI / 2, 0, 0]} />
    <Part geo={torusArc(0.33, 0.035, Math.PI * 2)} color="#FFD45E" rough={0.25} emissive={TPAL.goldDark} emissiveIntensity={0.5} position={[0, 0, 0.04]} />
    <Part geo={torusArc(0.33, 0.035, Math.PI * 2)} color="#FFD45E" rough={0.25} emissive={TPAL.goldDark} emissiveIntensity={0.5} position={[0, 0, -0.04]} />
    <Part geo={cyl(0.22, 0.22, 0.1, 28)} color="#FFCB3D" rough={0.25} emissive={TPAL.goldDark} emissiveIntensity={0.35} rotation={[Math.PI / 2, 0, 0]} />
  </group>
);

const PIN_TAIL = new THREE.CircleGeometry(0.16, 3, -Math.PI / 2 - 0.55, 1.1);
/** Phone screen with a simple map (no text): roads, a river, a park and pins that pop by `pins[i]` (0..1+). */
export const MapScreen: React.FC<{ pins: number[]; frame: number }> = ({ pins, frame }) => (
  <group>
    <Part geo={rbox(1.5, 3.0, 0.01, 0.1)} color="#EDE6D6" basic shadow={false} />
    <Part geo={rbox(0.7, 0.6, 0.01, 0.1)} color="#BFE0A8" basic position={[-0.32, 0.75, 0.004]} shadow={false} />
    <Part geo={rbox(0.5, 0.45, 0.01, 0.1)} color="#BFE0A8" basic position={[0.4, -0.95, 0.004]} shadow={false} />
    <Part geo={box(0.28, 3.1, 0.01)} color="#9ED0EE" basic position={[0.45, 0, 0.005]} rotation={[0, 0, 0.35]} shadow={false} />
    {[
      [0, 0.25, 1.5, 0.09, 0],
      [0, -0.45, 1.5, 0.07, 0],
      [-0.2, 0, 0.09, 3.0, 0],
      [0.25, 0.55, 1.4, 0.06, -0.5],
      [0.1, -1.05, 1.4, 0.06, 0.2],
    ].map(([x, y, w, h, r], i) => (
      <Part key={i} geo={box(w, h, 0.01)} color="#FFFFFF" basic position={[x, y, 0.008]} rotation={[0, 0, r]} shadow={false} />
    ))}
    {/* you are here */}
    <Part geo={circle(0.11, 20)} color="#FFFFFF" basic position={[-0.2, -0.45, 0.012]} shadow={false} />
    <Part geo={circle(0.075, 20)} color="#3A86FF" basic position={[-0.2, -0.45, 0.014]} scale={1 + 0.15 * Math.sin(frame * 0.25)} shadow={false} />
    {[
      [-0.5, 0.45],
      [0.35, 0.95],
      [0.15, -0.25],
    ].map(([x, y], i) => {
      const p = Math.max(0, pins[i] ?? 0);
      if (p <= 0.001) return null;
      return (
        <group key={`p${i}`} position={[x, y, 0.02]} scale={p}>
          <Part geo={circle(0.17, 20)} color="#000000" basic opacity={0.18} position={[0.02, -0.02, -0.002]} shadow={false} />
          <Part geo={circle(0.16, 20)} color={PAL.terracotta} basic position={[0, 0.16, 0]} shadow={false} />
          <Part geo={PIN_TAIL} color={PAL.terracotta} basic position={[0, 0.16, 0]} scale={[1, 1.9, 1]} shadow={false} />
          <Part geo={circle(0.065, 16)} color="#FFFFFF" basic position={[0, 0.17, 0.002]} shadow={false} />
        </group>
      );
    })}
  </group>
);
