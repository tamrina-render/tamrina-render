// Shared pieces of the "night neon" theme (owner liked it on gym-alone v2, 2026-11-20): first used by FactAloneNight,
// then FactBus (videos/bus-conductor). Colours: NPAL / BLUE / CYAN; the turning word flips the world to Tamrina lime.
import React from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { Part, box, circle, torusArc } from "./parts";
import { lerp, seg, easeOut } from "./anim";
import { Shot } from "./cameraMoves";

type V3 = [number, number, number];
export const NBLUE = "#3D8BFF";
export const NCYAN = "#5AD2FF";
export const NPAL = { bg: "#05080F", fog: "#070C18", floor: "#0E1424", ribDark: "#111A2E", limeBg: "#07120B", limeFog: "#0A170E", limeFloor: "#122016" };

/** a round neon wall clock (face toward +z) */
export const NeonClock: React.FC<{ position: V3; minutes: number; color: string; s?: number }> = ({ position, minutes, color, s = 1 }) => {
  const mA = -(minutes / 60) * Math.PI * 2;
  const hA = -((7 * 60 + minutes) / 720) * Math.PI * 2;
  return (
    <group position={position} scale={s}>
      <Part geo={circle(0.6, 32)} color="#0B1120" basic shadow={false} />
      <Part geo={torusArc(0.6, 0.05, Math.PI * 2)} color={color} emissive={color} emissiveIntensity={1.6} shadow={false} />
      {Array.from({ length: 12 }, (_, i) => (
        <Part key={i} geo={box(0.03, 0.09, 0.01)} color={color} basic position={[Math.sin((i / 12) * Math.PI * 2) * 0.47, Math.cos((i / 12) * Math.PI * 2) * 0.47, 0.02]} rotation={[0, 0, -(i / 12) * Math.PI * 2]} shadow={false} />
      ))}
      <group position={[0, 0, 0.03]} rotation={[0, 0, hA]}>
        <Part geo={box(0.06, 0.26, 0.01)} color="#FFFFFF" basic position={[0, 0.11, 0]} shadow={false} />
      </group>
      <group position={[0, 0, 0.04]} rotation={[0, 0, mA]}>
        <Part geo={box(0.04, 0.42, 0.01)} color={color} basic position={[0, 0.18, 0]} shadow={false} />
      </group>
    </group>
  );
};

export const projector = () => {
  const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.1, 3000);
  return (c: Shot, wp: V3) => {
    cam.fov = c.fov;
    cam.position.set(...c.p);
    cam.up.set(...(c.up ?? [0, 1, 0]));
    cam.lookAt(...c.l);
    cam.rotateZ(c.roll ?? 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const v = new THREE.Vector3(...wp).project(cam);
    const depth = new THREE.Vector3(...wp).applyMatrix4(cam.matrixWorldInverse).z * -1;
    return { x: ((v.x + 1) / 2) * 1080, y: ((1 - v.y) / 2) * 1920, behind: depth <= 0.2, ppu: 960 / (Math.max(0.2, depth) * Math.tan((c.fov * Math.PI) / 360)) };
  };
};
export type Proj = ReturnType<typeof projector>;

/** the lime wave on the story's turning word (as the Waffarha gate breaking); `at` = that word's frame */
export const LimeWave: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const a = at - 2;
  if (f < a || f > a + 22) return null;
  const u = seg(f, a, a + 18, easeOut);
  const flash = Math.exp(-Math.abs(f - (a + 5)) / 3) * 0.4;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 45%, rgba(214,255,60,${flash}), rgba(214,255,60,${flash * 0.3}) 60%, rgba(214,255,60,0) 85%)` }} />
      <div style={{ position: "absolute", left: 540 - 1500 * u, top: 860 - 1500 * u, width: 3000 * u, height: 3000 * u, borderRadius: "50%", border: `${lerp(60, 10, u)}px solid rgba(214,255,60,${0.85 * (1 - u)})`, boxShadow: `0 0 80px rgba(214,255,60,${0.6 * (1 - u)})` }} />
    </AbsoluteFill>
  );
};
