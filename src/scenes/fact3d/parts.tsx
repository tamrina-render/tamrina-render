import React from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// Palette: warm beige, sand, mustard, terracotta, teal, cream marble.
export const PAL = {
  sand: "#E9CF9F",
  sandDark: "#D9B57E",
  beige: "#F1E1C2",
  wall: "#EFD9B0",
  mustard: "#E3A93B",
  terracotta: "#D9693F",
  terraDark: "#B4502E",
  teal: "#2F8C86",
  tealDark: "#21615D",
  cream: "#FFF6E6",
  marble: "#EEF1F4", // cool marble so it separates from the warm sand
  marbleShade: "#C9D1DB",
  ink: "#3A2E2A",
  wood: "#C98F57",
  olive: "#8FA05E",
  oliveDark: "#6F8248",
  bark: "#8A6A4E",
  blush: "#F07E86",
  steel: "#5D6670",
  skyTop: "#4AA8D4",
  skyHorizon: "#FBE7C6",
};

// Geometry cache so every frame re-uses the same buffers.
const cache = new Map<string, THREE.BufferGeometry>();
const cached = (key: string, make: () => THREE.BufferGeometry) => {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
};

export const rbox = (w: number, h: number, d: number, r = 0.06) =>
  cached(`rb:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)));
export const box = (w: number, h: number, d: number) => cached(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (rt: number, rb: number, h: number, seg = 16) =>
  cached(`c:${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const sphere = (r: number, seg = 16) => cached(`s:${r}:${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75)));
export const ico = (r: number, detail = 1) => cached(`i:${r}:${detail}`, () => new THREE.IcosahedronGeometry(r, detail));
export const circle = (r: number, seg = 24) => cached(`ci:${r}:${seg}`, () => new THREE.CircleGeometry(r, seg));
export const torusArc = (r: number, tube: number, arc: number) =>
  cached(`t:${r}:${tube}:${arc}`, () => new THREE.TorusGeometry(r, tube, 8, 20, arc));

type V3 = [number, number, number];

export type PartProps = {
  geo: THREE.BufferGeometry;
  color: string;
  position?: V3;
  rotation?: V3;
  scale?: V3 | number;
  rough?: number;
  flat?: boolean;
  shadow?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  basic?: boolean;
  side?: THREE.Side;
};

/** One mesh with a standard (or unlit) material; casts and receives shadows by default. */
export const Part: React.FC<PartProps> = ({
  geo,
  color,
  position,
  rotation,
  scale,
  rough = 0.78,
  flat = false,
  shadow = true,
  emissive,
  emissiveIntensity = 0,
  opacity = 1,
  basic = false,
  side,
}) => (
  <mesh
    geometry={geo}
    position={position}
    rotation={rotation}
    scale={scale}
    castShadow={shadow && opacity > 0.99}
    receiveShadow={shadow}
  >
    {basic ? (
      <meshBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} side={side} toneMapped={false} />
    ) : (
      <meshStandardMaterial
        color={color}
        roughness={rough}
        metalness={0}
        flatShading={flat}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissiveIntensity}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
        side={side}
      />
    )}
  </mesh>
);
