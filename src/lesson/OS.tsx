import React from "react";
import { AbsoluteFill, Sequence, delayRender, continueRender, useVideoConfig } from "remotion";
import { loadFonts } from "../lib/fonts";
import { C, ap, T, ARt, Box, Arr, Chip, Frame, LessonCtx, Inner } from "./Lesson";
import type { P } from "./Lesson";

const COLS = [C.blue, C.green, C.amber, C.red, C.grey];
export type Spec =
  | { k: "title"; title: string; l1: string; l2: string; sub: string; chip: string }
  | { k: "rows"; title: string; rows: [string, string][] }
  | { k: "chips"; title: string; chips: string[]; note?: string }
  | { k: "flow"; title: string; steps: string[]; note?: string }
  | { k: "q"; title: string; q: string; terms: string[] }
  | { k: "cmp"; title: string; l: string; r: string; ls: string[]; rs: string[] }
  | { k: "end"; title: string; l1: string; sub: string; chips: string[] };

export const mk = (sp: Spec, n: number): React.FC<P> => ({ t }) => {
  if (sp.k === "title") return (
    <Frame title={sp.title} n={n}>
      <T x={960} y={330} s={120} w={900} o={ap(t, 0.1)}>{sp.l1}</T>
      <T x={960} y={450} s={96} w={900} c={C.blue} o={ap(t, 0.6)}>{sp.l2}</T>
      <T x={960} y={560} s={42} c={C.grey} o={ap(t, 1.2)}>{sp.sub}</T>
      <Chip x={660} y={680} w={600} label={sp.chip} col={C.green} o={ap(t, 2)} s={40} />
    </Frame>
  );
  if (sp.k === "rows") return (
    <Frame title={sp.title} n={n}>
      {sp.rows.map(([a, b], i) => (
        <g key={a} opacity={ap(t, 0.8 + i * 2.4)}>
          <Chip x={140} y={220 + i * 150} w={720} label={a} col={COLS[i % 5]} s={a.length > 22 ? 30 : 34} />
          <Arr x1={890} y1={262 + i * 150} x2={980} y2={262 + i * 150} />
          <T x={1010} y={276 + i * 150} s={36} a="start" c={C.ink} w={600}>{b}</T>
        </g>
      ))}
    </Frame>
  );
  if (sp.k === "chips") return (
    <Frame title={sp.title} n={n}>
      {sp.chips.map((a, i) => {
        const per = sp.chips.length <= 3 ? sp.chips.length : sp.chips.length === 4 ? 2 : 3;
        const row = Math.floor(i / per), col = i % per, inRow = Math.min(per, sp.chips.length - row * per);
        const w = 520, gap = 50, x0 = 960 - (inRow * w + (inRow - 1) * gap) / 2;
        return <Chip key={a} x={x0 + col * (w + gap)} y={260 + row * 150} w={w} label={a} col={COLS[i % 5]} s={a.length > 20 ? 30 : 36} o={ap(t, 0.8 + i * 1.6)} />;
      })}
      {sp.note && <T x={960} y={760} s={46} c={C.grey} o={ap(t, 0.8 + sp.chips.length * 1.6)} w={700}>{sp.note}</T>}
    </Frame>
  );
  if (sp.k === "flow") {
    const m = sp.steps.length, gap = 100, w = Math.min(520, (1700 - (m - 1) * gap) / m), x0 = 960 - (m * w + (m - 1) * gap) / 2;
    return (
      <Frame title={sp.title} n={n}>
        {sp.steps.map((a, i) => (
          <g key={a} opacity={ap(t, 0.8 + i * 2)}>
            <Chip x={x0 + i * (w + gap)} y={340} w={w} label={a} col={COLS[i % 5]} s={a.length > 16 ? 28 : 34} />
            {i < m - 1 && <Arr x1={x0 + i * (w + gap) + w + 14} y1={382} x2={x0 + (i + 1) * (w + gap) - 14} y2={382} />}
          </g>
        ))}
        {sp.note && <T x={960} y={620} s={46} c={C.grey} o={ap(t, 0.8 + m * 2)} w={700}>{sp.note}</T>}
      </Frame>
    );
  }
  if (sp.k === "q") return (
    <Frame title={sp.title} n={n}>
      <Box x={200} y={190} w={1520} h={230} col={C.blue} fill="#fff" o={ap(t, 0.3)}>
        <T x={960} y={325} s={sp.q.length > 40 ? 46 : 54} c={C.blue} w={800}>{sp.q}</T>
      </Box>
      {sp.terms.map((a, i) => {
        const m = sp.terms.length, w = Math.min(460, 1700 / m - 40), x0 = 960 - (m * w + (m - 1) * 40) / 2;
        return <Chip key={a} x={x0 + i * (w + 40)} y={560} w={w} label={a} col={COLS[i % 5]} s={a.length > 18 ? 28 : 32} o={ap(t, 2 + i * 1.5)} />;
      })}
    </Frame>
  );
  if (sp.k === "cmp") return (
    <Frame title={sp.title} n={n}>
      {[[sp.l, sp.ls, 150, C.grey], [sp.r, sp.rs, 1010, C.blue]].map(([h, ls, x, col], j) => (
        <g key={String(h)} opacity={ap(t, 0.6 + j * 3)}>
          <Chip x={(x as number) + 20} y={190} w={700} label={String(h)} col={col as string} s={36} />
          <Box x={x as number} y={300} w={760} h={90 + (ls as string[]).length * 100} col={col as string}>
            {(ls as string[]).map((l, i) => <T key={l} x={(x as number) + 380} y={385 + i * 100} s={34} w={700}>{l}</T>)}
          </Box>
        </g>
      ))}
    </Frame>
  );
  return (
    <Frame title={sp.title} n={n}>
      <T x={960} y={300} s={100} w={900} o={ap(t, 0.3)}>{sp.l1}</T>
      <T x={960} y={400} s={44} c={C.grey} o={ap(t, 1)}>{sp.sub}</T>
      {sp.chips.map((a, i) => <Chip key={a} x={170 + (i % 3) * 550} y={500 + Math.floor(i / 3) * 140} w={500} label={a} col={COLS[i % 5]} s={34} o={ap(t, 1.8 + i * 0.5)} />)}
    </Frame>
  );
};

export type OSProps = { starts: number[]; total: number; ep?: string };
export const makeOS = (specs: Spec[], defEp: string) => {
  const SC = specs.map((s, i) => mk(s, i + 1));
  const L: React.FC<OSProps> = ({ starts, total, ep }) => {
    const { fps } = useVideoConfig();
    const [h] = React.useState(() => delayRender("fonts"));
    React.useEffect(() => { loadFonts().then(() => continueRender(h)).catch(() => continueRender(h)); }, [h]);
    return (
      <LessonCtx.Provider value={{ ep: ep || defEp, total: specs.length, brand: "OpenShift" }}>
        <AbsoluteFill style={{ background: C.bg }}>
          {SC.map((S, i) => {
            const from = Math.round(starts[i] * fps);
            const end = Math.round((i + 1 < starts.length ? starts[i + 1] : total) * fps);
            return <Sequence key={i} from={from} durationInFrames={Math.max(1, end - from)}><Inner S={S} /></Sequence>;
          })}
        </AbsoluteFill>
      </LessonCtx.Provider>
    );
  };
  return L;
};
