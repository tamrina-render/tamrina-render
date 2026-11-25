import React from "react";
import { Part, box, circle, rbox } from "./parts";

const LIME = "#D6FF3C";
const INK = "#26232B";
const GREY = "#CBC6BE";
const CARD = "#FFFFFF";

/**
 * A blocky smartphone standing on its bottom edge (origin = bottom centre), screen facing +z.
 * The screen shows a "post" card made of shapes only: avatar + name bars, a running-shoe picture,
 * text bars and a lime button. `press` 0..1 pushes the button in; `glow` 0..1 brightens the screen.
 */
export const Phone: React.FC<{ press?: number; shoeHop?: number; screen?: React.ReactNode }> = ({ press = 0, shoeHop = 0, screen }) => {
  const W = 1.7;
  const H = 3.3;
  const zf = 0.135; // screen surface
  const u = (y: number) => H / 2 + y; // y relative to the screen centre
  return (
    <group>
      {/* body */}
      <Part geo={rbox(W, H, 0.26, 0.2)} color={INK} rough={0.35} position={[0, H / 2, 0]} />
      <Part geo={rbox(0.05, 0.4, 0.06, 0.02)} color="#3D3943" position={[W / 2 + 0.01, u(0.7), 0]} />
      {/* screen */}
      <Part geo={rbox(W - 0.16, H - 0.18, 0.02, 0.12)} color="#F3EFE6" basic position={[0, u(0), zf]} shadow={false} />
      <Part geo={rbox(0.42, 0.07, 0.01, 0.035)} color={INK} basic position={[0, u(H / 2 - 0.2), zf + 0.012]} shadow={false} />
      {/* custom screen (screen-centre local, surface at z 0), replaces the post card */}
      {screen && <group position={[0, u(0), zf + 0.012]}>{screen}</group>}
      {/* post card */}
      {!screen && (
      <group position={[0, u(-0.02), zf + 0.014]}>
        <Part geo={rbox(1.36, 2.62, 0.01, 0.1)} color={CARD} basic shadow={false} />
        {/* header: avatar + two name bars */}
        <Part geo={circle(0.13, 20)} color="#D9693F" basic position={[-0.48, 1.08, 0.008]} shadow={false} />
        <Part geo={rbox(0.62, 0.075, 0.005, 0.035)} color="#8E877D" basic position={[0.02, 1.13, 0.008]} shadow={false} />
        <Part geo={rbox(0.4, 0.06, 0.005, 0.03)} color={GREY} basic position={[-0.09, 1.0, 0.008]} shadow={false} />
        {/* picture: a running shoe with speed lines */}
        <Part geo={rbox(1.2, 1.12, 0.005, 0.07)} color="#CFE8E6" basic position={[0, 0.3, 0.008]} shadow={false} />
        <group position={[0.06, 0.24 + shoeHop * 0.12, 0.014]} rotation={[0, 0, -shoeHop * 0.12]}>
          <Part geo={rbox(0.78, 0.09, 0.005, 0.04)} color={INK} basic position={[0, -0.16, 0]} shadow={false} />
          <Part geo={rbox(0.72, 0.1, 0.005, 0.045)} color="#FFFFFF" basic position={[0.02, -0.08, 0.001]} shadow={false} />
          <Part geo={rbox(0.5, 0.28, 0.005, 0.12)} color="#D9693F" basic position={[-0.1, 0.07, 0.001]} shadow={false} />
          <Part geo={rbox(0.3, 0.2, 0.005, 0.09)} color="#D9693F" basic position={[0.2, -0.01, 0.001]} shadow={false} />
          <Part geo={rbox(0.12, 0.3, 0.005, 0.04)} color="#B4502E" basic position={[-0.32, 0.12, 0.002]} shadow={false} />
          <Part geo={rbox(0.42, 0.06, 0.005, 0.03)} color={LIME} basic position={[-0.02, 0.02, 0.003]} rotation={[0, 0, 0.32]} shadow={false} />
          {[0, 1].map((i) => (
            <Part key={i} geo={box(0.03, 0.12, 0.005)} color="#FFFFFF" basic position={[0.0 + i * 0.09, 0.13 - i * 0.03, 0.003]} rotation={[0, 0, -0.5]} shadow={false} />
          ))}
          {[0, 1, 2].map((i) => (
            <Part key={`s${i}`} geo={rbox(0.16 - i * 0.03, 0.035, 0.005, 0.017)} color="#8FBDB9" basic position={[-0.52 + i * 0.015, 0.1 - i * 0.1, 0]} shadow={false} />
          ))}
        </group>
        {/* text bars */}
        {[0.98, 0.78, 0.55].map((w, i) => (
          <Part key={i} geo={rbox(w, 0.065, 0.005, 0.03)} color={GREY} basic position={[-0.5 + w / 2, -0.43 - i * 0.15, 0.008]} shadow={false} />
        ))}
        {/* the lime button, with an ink outline so it reads on the white card */}
        <group position={[0, -1.0, 0.008 - press * 0.004]} scale={1 - press * 0.06}>
          <Part geo={rbox(1.06, 0.3, 0.005, 0.15)} color={INK} basic shadow={false} />
          <Part geo={rbox(1.0, 0.24, 0.005, 0.12)} color={LIME} basic position={[0, 0, 0.004]} shadow={false} />
          <Part geo={rbox(0.36, 0.06, 0.005, 0.03)} color={INK} basic position={[0, 0, 0.008]} shadow={false} />
        </group>
      </group>
      )}
    </group>
  );
};
