// A kit of five named "pro" camera moves for the three.js films. Every move is a pure function
// (t: 0..1 progress) -> Shot, so a film just maps its own frame to t and hands the Shot to <ShotRig/>.
//
//   dollyZoom  the moment it hits        orbit      the hero shot
//   whipPan    energy (+ whipBlur)       birdsEye   the big picture
//   RackFocus  move the eye (real depth of field, via three's BokehPass)
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { clamp, easeInOut, lerp, mix3 } from "./anim";

export type V3 = [number, number, number];
/** p = camera position, l = look-at point, fov = VERTICAL fov in degrees, roll = radians, up = camera up vector (default 0,1,0). */
export type Shot = { p: V3; l: V3; fov: number; roll?: number; up?: V3 };

const DEG = Math.PI / 180;
const norm = (v: V3): V3 => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

/** Straight blend of two shots (position, look-at, fov, roll, up). */
export const mixShot = (a: Shot, b: Shot, t: number): Shot => ({
  p: mix3(a.p, b.p, t),
  l: mix3(a.l, b.l, t),
  fov: lerp(a.fov, b.fov, t),
  roll: lerp(a.roll ?? 0, b.roll ?? 0, t),
  up: norm(mix3(a.up ?? [0, 1, 0], b.up ?? [0, 1, 0], t)),
});

// ---------------------------------------------------------------- dolly zoom
/**
 * The camera slides along `dir` while the lens zooms the opposite way, so the SUBJECT keeps its size and the
 * background stretches (fov up, camera closer) or compresses (fov down, camera farther).
 * `width` is the VERTICAL extent in world units that must stay the frame height at the target
 * (the horizontal extent is that times the aspect, so it is constant too).
 * Distance d = width / (2 * tan(fov / 2)), with fov in radians, vertical fov.
 * `dir` points from the target TOWARD the camera (any length). `height` lifts the look-at point above `target`.
 * Zoom + dolly are eased together with easeInOut.
 */
export const dollyZoom = (t: number, o: { target: V3; dir: V3; width: number; fovFrom: number; fovTo: number; height?: number }): Shot => {
  const e = easeInOut(clamp(t));
  const fov = lerp(o.fovFrom, o.fovTo, e);
  const d = o.width / (2 * Math.tan((fov * DEG) / 2));
  const l: V3 = [o.target[0], o.target[1] + (o.height ?? 0), o.target[2]];
  return { p: add(l, scl(norm(o.dir), d)), l, fov };
};
/** Frame height (world units) a Shot sees at its look-at point; used to check the dolly zoom. */
export const frameExtentAtTarget = (s: Shot) => 2 * Math.hypot(...sub(s.p, s.l)) * Math.tan((s.fov * DEG) / 2);

// ---------------------------------------------------------------- orbit
/** Circles `target` at `radius`, camera y = `height` (absolute), always looking at the target. 0 deg = camera on +z, 90 = on +x. */
export const orbit = (t: number, o: { target: V3; radius: number; height: number; fromDeg: number; toDeg: number; fov: number }): Shot => {
  const a = lerp(o.fromDeg, o.toDeg, easeInOut(clamp(t))) * DEG;
  return { p: [o.target[0] + Math.sin(a) * o.radius, o.height, o.target[2] + Math.cos(a) * o.radius], l: o.target, fov: o.fov };
};

// ---------------------------------------------------------------- whip pan
/** 0 -> 1 turn progress: still until `mid - turn/2`, one eased turn, still again. */
const whipProgress = (t: number, mid = 0.5, turn = 0.3) => easeInOut(clamp((t - (mid - turn / 2)) / turn));

const yawPitch = (d: V3) => ({ yaw: Math.atan2(d[0], -d[2]), pitch: Math.asin(clamp(d[1], -1, 1)) });
const fromYawPitch = (yaw: number, pitch: number): V3 => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];

/**
 * A very fast yaw from the look direction of `from` to that of `to` (the short way round), position and fov blended
 * along. `turn` = share of t the turn takes (default 0.3, centred on `mid` = 0.5). Pair with whipBlur(t, mid, turn).
 */
export const whipPan = (t: number, o: { from: Shot; to: Shot; mid?: number; turn?: number }): Shot => {
  const w = whipProgress(t, o.mid, o.turn);
  const a = yawPitch(norm(sub(o.from.l, o.from.p)));
  const b = yawPitch(norm(sub(o.to.l, o.to.p)));
  let dy = b.yaw - a.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy)); // shortest way
  const p = mix3(o.from.p, o.to.p, w);
  const dir = fromYawPitch(a.yaw + dy * w, lerp(a.pitch, b.pitch, w));
  return { p, l: add(p, scl(dir, 10)), fov: lerp(o.from.fov, o.to.fov, w), roll: lerp(o.from.roll ?? 0, o.to.roll ?? 0, w) };
};
/** 0..1 motion-blur strength for whipPan: 0 while still, peaks at 1 mid-turn. CSS: filter blur(`${whipBlur(t) * 3}px`). */
export const whipBlur = (t: number, mid = 0.5, turn = 0.3) => Math.sin(Math.PI * whipProgress(t, mid, turn)) ** 2;

// ---------------------------------------------------------------- bird's eye
/**
 * Straight down over `target`, `height` above it. Looking straight down is a lookAt gimbal case (the view direction
 * is parallel to up (0,1,0)), so the Shot carries its own `up` (a horizontal vector, rotated by the spin) and
 * <ShotRig/> sets camera.up from shot.up BEFORE lookAt. `spinDeg` turns the picture slowly over the whole t.
 * With `from`, the first `blend` (default 0.55) of t rises out of that shot into the top view (up is blended too).
 * Never apply this Shot with a rig that forces up = (0,1,0).
 */
export const birdsEye = (t: number, o: { target: V3; height: number; fov: number; spinDeg?: number; from?: Shot; blend?: number }): Shot => {
  const s = (o.spinDeg ?? 0) * DEG * clamp(t);
  const top: Shot = { p: [o.target[0], o.target[1] + o.height, o.target[2]], l: o.target, fov: o.fov, up: [Math.sin(s), 0, -Math.cos(s)] };
  if (!o.from) return top;
  return mixShot(o.from, top, easeInOut(clamp(t / (o.blend ?? 0.55))));
};

// ---------------------------------------------------------------- applying a Shot
/** Applies a Shot to the R3F camera each render: up first, then lookAt, then roll, then fov. */
export const ShotRig: React.FC<{ shot: Shot }> = ({ shot }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(...shot.p);
  camera.up.set(...(shot.up ?? [0, 1, 0]));
  camera.lookAt(...shot.l);
  camera.rotateZ(shot.roll ?? 0);
  if (camera.fov !== shot.fov) {
    camera.fov = shot.fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  return null;
};

// ---------------------------------------------------------------- rack focus
/** Focus distance (from the camera) over t: holds `nearDist`, moves to `farDist` between t 0.3 and 0.6, holds. */
export const rackFocusDist = (t: number, nearDist: number, farDist: number) => lerp(nearDist, farDist, easeInOut(clamp((t - 0.3) / 0.3)));

/**
 * Real depth of field: takes over rendering (EffectComposer + BokehPass + OutputPass). Mount it inside a ThreeCanvas,
 * ONLY while the rack focus is on screen (it replaces R3F's own render). `focus` = distance from the camera to the
 * sharp plane, in world units; `aperture` higher = blurrier (0 = no blur); `maxblur` caps the blur (fraction of the frame).
 * Render <ShotRig/> before it in the tree so the camera is set first.
 */
export const RackFocus: React.FC<{ focus: number; aperture?: number; maxblur?: number }> = ({ focus, aperture = 0.0004, maxblur = 0.012 }) => {
  const { gl, scene, camera, size } = useThree();
  const rig = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(size.width, size.height, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, rt);
    composer.addPass(new RenderPass(scene, camera));
    const bokeh = new BokehPass(scene, camera, { focus, aperture, maxblur });
    composer.addPass(bokeh);
    composer.addPass(new OutputPass());
    return { composer, bokeh };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);
  useEffect(() => {
    rig.composer.setPixelRatio(1);
    rig.composer.setSize(size.width, size.height);
  }, [rig, size.width, size.height]);
  useEffect(() => () => rig.composer.dispose(), [rig]);
  useFrame(() => {
    const u = rig.bokeh.uniforms as Record<string, { value: number }>;
    u["focus"].value = focus;
    u["aperture"].value = aperture;
    u["maxblur"].value = maxblur;
    rig.composer.render();
  }, 1);
  return null;
};
