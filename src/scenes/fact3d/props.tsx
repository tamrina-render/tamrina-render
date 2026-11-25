import React, { useMemo } from "react";
import * as THREE from "three";
import { PAL, Part, box, circle, cyl, ico, rbox, sphere } from "./parts";
import { hash } from "./anim";

type V3 = [number, number, number];

/** Dumbbell lying along x, centred on the origin. */
export const Dumbbell: React.FC<{ color?: string; position?: V3; rotation?: V3; s?: number }> = ({ color = PAL.terracotta, position, rotation, s = 1 }) => (
  <group position={position} rotation={rotation} scale={s}>
    <Part geo={cyl(0.04, 0.04, 0.5, 10)} color={PAL.steel} rough={0.4} rotation={[0, 0, Math.PI / 2]} />
    {[1, -1].map((k) => (
      <Part key={k} geo={cyl(0.12, 0.12, 0.13, 6)} color={color} flat rotation={[0, 0, Math.PI / 2]} position={[k * 0.2, 0, 0]} />
    ))}
  </group>
);

export const DumbbellRack: React.FC<{ position?: V3; rotationY?: number }> = ({ position, rotationY = 0 }) => {
  const cols = [PAL.terracotta, PAL.mustard, PAL.teal, PAL.terracotta];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[-1, 1].map((k) => (
        <Part key={k} geo={rbox(0.12, 0.95, 0.5, 0.03)} color={PAL.ink} position={[k * 1.25, 0.475, 0]} />
      ))}
      <Part geo={rbox(2.6, 0.06, 0.5, 0.02)} color={PAL.ink} position={[0, 0.45, 0.05]} rotation={[0.25, 0, 0]} />
      <Part geo={rbox(2.6, 0.06, 0.5, 0.02)} color={PAL.ink} position={[0, 0.85, -0.02]} rotation={[0.25, 0, 0]} />
      {cols.map((c, i) => (
        <React.Fragment key={i}>
          <Dumbbell color={c} position={[-0.9 + i * 0.6, 0.56, 0.08]} rotation={[0, 0, 0]} s={0.9 - i * 0.04} />
          <Dumbbell color={cols[(i + 2) % 4]} position={[-0.9 + i * 0.6, 0.96, 0]} s={0.75} />
        </React.Fragment>
      ))}
    </group>
  );
};

export const Bench: React.FC<{ position?: V3; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <Part geo={rbox(0.55, 0.16, 1.6, 0.07)} color={PAL.teal} position={[0, 0.55, 0]} />
    <Part geo={rbox(0.12, 0.5, 0.12, 0.03)} color={PAL.ink} position={[0, 0.25, 0.6]} />
    <Part geo={rbox(0.12, 0.5, 0.12, 0.03)} color={PAL.ink} position={[0, 0.25, -0.6]} />
    <Part geo={rbox(0.7, 0.06, 0.14, 0.02)} color={PAL.ink} position={[0, 0.03, 0.6]} />
    <Part geo={rbox(0.7, 0.06, 0.14, 0.02)} color={PAL.ink} position={[0, 0.03, -0.6]} />
    {/* uprights + barbell */}
    {[1, -1].map((k) => (
      <Part key={k} geo={rbox(0.08, 1.25, 0.08, 0.02)} color={PAL.ink} position={[k * 0.55, 0.62, -0.7]} />
    ))}
    <group position={[0, 1.22, -0.7]}>
      <Part geo={cyl(0.035, 0.035, 2.1, 10)} color={PAL.steel} rough={0.4} rotation={[0, 0, Math.PI / 2]} />
      {[1, -1].map((k) => (
        <React.Fragment key={k}>
          <Part geo={cyl(0.3, 0.3, 0.09, 20)} color={PAL.mustard} rotation={[0, 0, Math.PI / 2]} position={[k * 0.8, 0, 0]} />
          <Part geo={cyl(0.22, 0.22, 0.07, 20)} color={PAL.terracotta} rotation={[0, 0, Math.PI / 2]} position={[k * 0.89, 0, 0]} />
        </React.Fragment>
      ))}
    </group>
  </group>
);

/** Treadmill facing +z; the belt stripes run with the frame. */
export const Treadmill: React.FC<{ position?: V3; rotationY?: number; frame: number }> = ({ position, rotationY = 0, frame }) => {
  const off = ((frame * 0.06) % 0.4 + 0.4) % 0.4;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Part geo={rbox(0.9, 0.22, 2.0, 0.08)} color={PAL.cream} position={[0, 0.11, 0]} />
      <Part geo={box(0.7, 0.02, 1.8)} color={PAL.ink} position={[0, 0.23, 0]} />
      {[0, 1, 2, 3].map((i) => (
        <Part key={i} geo={box(0.68, 0.005, 0.04)} color={PAL.steel} position={[0, 0.245, 0.8 - ((i * 0.4 + off) % 1.6)]} shadow={false} />
      ))}
      {[1, -1].map((k) => (
        <Part key={k} geo={rbox(0.07, 1.25, 0.07, 0.02)} color={PAL.ink} position={[k * 0.4, 0.75, -0.85]} rotation={[-0.18, 0, 0]} />
      ))}
      <Part geo={rbox(0.95, 0.06, 0.06, 0.02)} color={PAL.ink} position={[0, 1.15, -0.72]} />
      <Part geo={rbox(0.7, 0.32, 0.12, 0.05)} color={PAL.terracotta} position={[0, 1.38, -0.95]} rotation={[0.4, 0, 0]} />
      <Part geo={box(0.4, 0.14, 0.01)} color={PAL.teal} basic position={[0, 1.4, -0.885]} rotation={[0.4, 0, 0]} shadow={false} />
    </group>
  );
};

/** Wall clock: the second hand ticks with the frame. */
export const WallClock: React.FC<{ position?: V3; frame: number }> = ({ position, frame }) => {
  const tick = Math.floor(frame / 30);
  const sub = Math.min(1, ((frame % 30) / 30) * 6); // quick step each second
  const a = -((tick + sub) / 60) * Math.PI * 2;
  return (
    <group position={position}>
      <Part geo={cyl(0.42, 0.42, 0.08, 28)} color={PAL.terracotta} rotation={[Math.PI / 2, 0, 0]} />
      <Part geo={circle(0.34, 28)} color={PAL.cream} basic position={[0, 0, 0.045]} shadow={false} />
      <Part geo={box(0.04, 0.2, 0.01)} color={PAL.ink} basic position={[0, 0.1, 0.05]} shadow={false} />
      <Part geo={box(0.03, 0.15, 0.01)} color={PAL.ink} basic rotation={[0, 0, -2.1]} position={[0.065, -0.037, 0.05]} shadow={false} />
      <group position={[0, 0, 0.055]} rotation={[0, 0, a]}>
        <Part geo={box(0.015, 0.28, 0.01)} color={PAL.terracotta} basic position={[0, 0.12, 0]} shadow={false} />
      </group>
    </group>
  );
};

/** Doric-ish column: base, faceted (fluted-looking) shaft, capital. */
export const Column: React.FC<{ position?: V3; h?: number; broken?: boolean }> = ({ position, h = 4.2 }) => (
  <group position={position}>
    <Part geo={rbox(0.95, 0.2, 0.95, 0.04)} color={PAL.marbleShade} position={[0, 0.1, 0]} />
    <Part geo={cyl(0.38, 0.4, 0.16, 20)} color={PAL.marble} position={[0, 0.28, 0]} />
    <Part geo={cyl(0.31, 0.36, h - 0.72, 14)} color={PAL.marble} flat rough={0.6} position={[0, 0.36 + (h - 0.72) / 2, 0]} />
    <Part geo={cyl(0.44, 0.31, 0.2, 20)} color={PAL.marble} position={[0, h - 0.26, 0]} />
    <Part geo={rbox(0.98, 0.16, 0.98, 0.03)} color={PAL.marbleShade} position={[0, h - 0.08, 0]} />
  </group>
);

/** Ring of columns with a lintel on top. Open toward +z (the camera side). */
export const Colonnade: React.FC<{ position?: V3; radius?: number; count?: number; h?: number; gap?: number }> = ({
  position,
  radius = 7,
  count = 12,
  h = 4.2,
  gap = 3,
}) => {
  const items = [];
  for (let i = 0; i < count; i++) {
    if (i >= count - gap / 2 || i < gap / 2) continue; // leave the front open
    // half-step offset so no column stands straight behind the hero at the centre
    const a = ((i + 0.5) / count) * Math.PI * 2;
    const a2 = ((i + 1.5) / count) * Math.PI * 2;
    const p: V3 = [Math.sin(a) * radius, 0, Math.cos(a) * radius];
    items.push(<Column key={`c${i}`} position={p} h={h} />);
    if (!(i + 1 >= count - gap / 2)) {
      const mid = (a + a2) / 2;
      const len = 2 * radius * Math.sin(Math.PI / count) + 0.95;
      items.push(
        <Part
          key={`l${i}`}
          geo={rbox(len, 0.42, 0.85, 0.04)}
          color={PAL.marble}
          position={[Math.sin(mid) * radius * Math.cos(Math.PI / count), h + 0.21, Math.cos(mid) * radius * Math.cos(Math.PI / count)]}
          rotation={[0, mid, 0]}
        />,
      );
    }
  }
  return <group position={position}>{items}</group>;
};

/** Olive tree: crooked trunk + clustered faceted canopy that sways gently. */
export const OliveTree: React.FC<{ position?: V3; s?: number; seed?: number; frame: number }> = ({ position, s = 1, seed = 1, frame }) => {
  const sway = Math.sin(frame * 0.05 + seed) * 0.025;
  const blobs = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + hash(seed + i) * 0.8;
        const r = 0.55 + hash(seed * 3 + i) * 0.35;
        return { p: [Math.cos(a) * r, 0.1 + hash(seed * 7 + i) * 0.45, Math.sin(a) * r * 0.8] as V3, r: 0.48 + hash(seed * 11 + i) * 0.22, dark: i % 3 === 0 };
      }),
    [seed],
  );
  return (
    <group position={position} scale={s}>
      <Part geo={circle(1.2, 24)} color="#000000" basic opacity={0.1} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} shadow={false} />
      <Part geo={rbox(0.26, 1.1, 0.26, 0.06)} color={PAL.bark} position={[0, 0.55, 0]} rotation={[0, 0, 0.12]} />
      <Part geo={rbox(0.2, 0.9, 0.2, 0.05)} color={PAL.bark} position={[-0.12, 1.35, 0]} rotation={[0, 0, -0.25]} />
      <Part geo={rbox(0.16, 0.7, 0.16, 0.04)} color={PAL.bark} position={[0.3, 1.3, 0.05]} rotation={[0, 0, 0.6]} />
      <group position={[0, 2.0, 0]} rotation={[0, 0, sway]}>
        <Part geo={ico(0.7, 0)} color={PAL.olive} flat position={[0, 0.25, 0]} />
        {blobs.map((b, i) => (
          <Part key={i} geo={ico(b.r, 0)} color={b.dark ? PAL.oliveDark : PAL.olive} flat position={b.p} rotation={[i, i * 2, 0]} />
        ))}
      </group>
    </group>
  );
};

export const Pedestal: React.FC<{ position?: V3; h?: number }> = ({ position, h = 1.1 }) => (
  <group position={position}>
    <Part geo={rbox(2.0, 0.22, 1.8, 0.05)} color={PAL.marbleShade} position={[0, 0.11, 0]} />
    <Part geo={rbox(1.6, h - 0.38, 1.4, 0.05)} color={PAL.marble} position={[0, 0.22 + (h - 0.38) / 2, 0]} />
    <Part geo={rbox(1.85, 0.16, 1.65, 0.04)} color={PAL.marbleShade} position={[0, h - 0.08, 0]} />
    {/* carved panel */}
    <Part geo={rbox(1.1, (h - 0.38) * 0.6, 0.04, 0.02)} color={PAL.marbleShade} position={[0, 0.22 + (h - 0.38) / 2, 0.7]} />
  </group>
);

/** Puffy cloud. */
export const Cloud: React.FC<{ position?: V3; s?: number; seed?: number }> = ({ position, s = 1, seed = 1 }) => (
  <group position={position} scale={s}>
    {[0, 1, 2, 3, 4].map((i) => (
      <Part
        key={i}
        geo={sphere(1, 18)}
        color="#FFFFFF"
        rough={1}
        shadow={false}
        side={THREE.DoubleSide}
        position={[(i - 2) * 0.95, Math.sin(i * 1.7 + seed) * 0.25 + (i === 2 ? 0.45 : 0), Math.cos(i + seed) * 0.3]}
        scale={0.8 + hash(seed + i) * 0.5}
        emissive="#FFFFFF"
        emissiveIntensity={0.35}
      />
    ))}
  </group>
);

/** Sky dome with a vertical gradient. */
export const SkyDome: React.FC<{ top?: string; horizon?: string }> = ({ top = PAL.skyTop, horizon = PAL.skyHorizon }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
          void main(){ float h = clamp(vDir.y*1.6+0.08, 0.0, 1.0); h = pow(h, 0.8); gl_FragColor = vec4(mix(horizon, top, h), 1.0);
          #include <colorspace_fragment>
          }`,
      }),
    [top, horizon],
  );
  return (
    <mesh material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  );
};
