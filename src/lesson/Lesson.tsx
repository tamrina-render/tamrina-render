import React from "react";
import { AbsoluteFill, Sequence, delayRender, continueRender, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFonts } from "../lib/fonts";

// ---------- palette + helpers ----------
export const C = { bg: "#F7F9FC", ink: "#17202B", blue: "#326CE5", green: "#1E9E62", red: "#E04848", amber: "#F2A31B", grey: "#8A94A3", line: "#D5DCE8", card: "#FFFFFF", code: "#0F1722" };
export const AR = "IBM Plex Sans Arabic, Cairo, sans-serif";
export const LAT = "Manrope, sans-serif";
export const MONO = "JetBrains Mono, monospace";
export const E = (x: number) => { const v = Math.min(1, Math.max(0, x)); return 1 - Math.pow(1 - v, 3); };
export const ap = (t: number, at: number, d = 0.5) => E((t - at) / d);
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export type P = { t: number };

// ---------- primitives (SVG, 1920x1080) ----------
export const T: React.FC<{ x: number; y: number; s?: number; c?: string; w?: number; a?: "start" | "middle" | "end"; o?: number; f?: string; children: React.ReactNode }> = ({ x, y, s = 40, c = C.ink, w = 700, a = "middle", o = 1, f = LAT, children }) => (
  <text x={x} y={y} fontSize={s} fill={c} fontWeight={w} textAnchor={a} opacity={o} fontFamily={f} style={{ direction: "ltr", unicodeBidi: "isolate" }}>{children}</text>
);
export const ARt: React.FC<{ x: number; y: number; s?: number; c?: string; w?: number; a?: "start" | "middle" | "end"; o?: number; children: React.ReactNode }> = ({ x, y, s = 44, c = C.ink, w = 600, a = "middle", o = 1, children }) => (
  <text x={x} y={y} fontSize={s} fill={c} fontWeight={w} textAnchor={a} opacity={o} fontFamily={AR} style={{ direction: "rtl", unicodeBidi: "isolate" }}>{children}</text>
);
export const Box: React.FC<{ x: number; y: number; w: number; h: number; col?: string; fill?: string; o?: number; dash?: boolean; r?: number; sw?: number; children?: React.ReactNode }> = ({ x, y, w, h, col = C.line, fill = C.card, o = 1, dash, r = 22, sw = 4, children }) => (
  <g opacity={o}>
    <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={col} strokeWidth={sw} strokeDasharray={dash ? "14 10" : undefined} />
    {children}
  </g>
);
export const Cont: React.FC<{ x: number; y: number; col?: string; s?: number; o?: number; mark?: string }> = ({ x, y, col = C.green, s = 46, o = 1, mark }) => (
  <g opacity={o}>
    <rect x={x} y={y} width={s} height={s} rx={9} fill={col} />
    {mark && <T x={x + s / 2} y={y + s * 0.72} s={s * 0.62} c="#fff">{mark}</T>}
  </g>
);
export const Pod: React.FC<{ x: number; y: number; w?: number; h?: number; col?: string; label?: string; o?: number; dash?: boolean; conts?: { col: string; mark?: string }[] }> = ({ x, y, w = 230, h = 120, col = C.blue, label = "Pod", o = 1, dash, conts = [] }) => (
  <g opacity={o}>
    <Box x={x} y={y} w={w} h={h} col={col} fill="#fff" dash={dash} r={20} />
    <T x={x + w / 2} y={y + 36} s={26} c={col} w={800}>{label}</T>
    {conts.map((c, i) => <Cont key={i} x={x + 28 + i * 62} y={y + 56} col={c.col} s={48} mark={c.mark} />)}
  </g>
);
export const Node: React.FC<{ x: number; y: number; w?: number; h?: number; label: string; col?: string; o?: number; dead?: boolean }> = ({ x, y, w = 420, h = 260, label, col = C.grey, o = 1, dead }) => (
  <g opacity={o}>
    <Box x={x} y={y} w={w} h={h} col={col} fill={dead ? "#FBEAEA" : "#EEF2F9"} sw={4} dash={dead} />
    <T x={x + 20} y={y + 40} s={28} c={dead ? C.red : C.grey} w={800} a="start">{label}</T>
  </g>
);
export const Arr: React.FC<{ x1: number; y1: number; x2: number; y2: number; col?: string; o?: number; dash?: boolean; w?: number }> = ({ x1, y1, x2, y2, col = C.ink, o = 1, dash, w = 5 }) => {
  const a = Math.atan2(y2 - y1, x2 - x1), hl = 22;
  return (
    <g opacity={o}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={w} strokeDasharray={dash ? "14 10" : undefined} strokeLinecap="round" />
      <path d={`M${x2},${y2} L${x2 - hl * Math.cos(a - 0.45)},${y2 - hl * Math.sin(a - 0.45)} L${x2 - hl * Math.cos(a + 0.45)},${y2 - hl * Math.sin(a + 0.45)} Z`} fill={col} />
    </g>
  );
};
export const Code: React.FC<{ x: number; y: number; w?: number; lines: string[]; o?: number; s?: number; hl?: number }> = ({ x, y, w = 900, lines, o = 1, s = 34, hl }) => (
  <g opacity={o}>
    <rect x={x} y={y} width={w} height={lines.length * (s * 1.5) + 40} rx={18} fill={C.code} />
    {lines.map((l, i) => <text key={i} x={x + 30} y={y + 48 + i * s * 1.5} fontSize={s} fill={hl === i ? "#7CFFB2" : "#E6EDF7"} fontFamily={MONO} style={{ direction: "ltr", unicodeBidi: "isolate", whiteSpace: "pre" }} xmlSpace="preserve">{l}</text>)}
  </g>
);
export const Chip: React.FC<{ x: number; y: number; w?: number; label: string; col: string; o?: number; s?: number }> = ({ x, y, w = 300, label, col, o = 1, s = 38 }) => (
  <g opacity={o}>
    <rect x={x} y={y} width={w} height={84} rx={42} fill={col} />
    <T x={x + w / 2} y={y + 56} s={s} c="#fff" w={800}>{label}</T>
  </g>
);
export const Spinner: React.FC<{ x: number; y: number; t: number; col?: string; r?: number }> = ({ x, y, t, col = C.blue, r = 20 }) => (
  <g transform={`translate(${x},${y}) rotate(${t * 300})`}>
    <circle r={r} fill="none" stroke={C.line} strokeWidth={6} />
    <path d={`M0,${-r} A${r},${r} 0 0 1 ${r},0`} fill="none" stroke={col} strokeWidth={6} strokeLinecap="round" />
  </g>
);
export const Cloud: React.FC<{ x: number; y: number; label: string; col?: string; o?: number }> = ({ x, y, label, col = C.blue, o = 1 }) => (
  <g opacity={o}>
    <ellipse cx={x} cy={y} rx={150} ry={64} fill="#fff" stroke={col} strokeWidth={5} />
    <T x={x} y={y + 14} s={36} c={col} w={800}>{label}</T>
  </g>
);

export const LessonCtx = React.createContext<{ ep: string; total: number; brand?: string }>({ ep: "Episode 1", total: 24 });
// ---------- scene frame ----------
export const Frame: React.FC<{ title: string; n: number; children: React.ReactNode }> = ({ title, n, children }) => {
  const cx = React.useContext(LessonCtx);
  return (
  <AbsoluteFill style={{ background: C.bg }}>
    <div style={{ position: "absolute", top: 40, left: 56, fontFamily: LAT, fontWeight: 800, fontSize: 30, color: C.blue, direction: "ltr" }}>{cx.brand || "Cloud DevOps"}</div>
    <div style={{ position: "absolute", top: 82, left: 56, fontFamily: LAT, fontWeight: 600, fontSize: 22, color: C.grey, direction: "ltr" }}>{cx.ep}</div>
    <div style={{ position: "absolute", top: 32, right: 56, fontFamily: AR, fontWeight: 700, fontSize: 60, color: C.ink, direction: "rtl" }}>{title}</div>
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>{children}</svg>
    <div style={{ position: "absolute", bottom: 0, left: 0, height: 10, width: `${(n / cx.total) * 100}%`, background: C.blue }} />
  </AbsoluteFill>
  );
};

// ---------- scenes ----------
const NODE_X = [150, 750, 1350];
const Cluster: React.FC<{ t: number; pods?: boolean; dead?: number }> = ({ t, pods = true, dead = -1 }) => (
  <g>
    {NODE_X.map((x, i) => (
      <g key={i}>
        <Node x={x} y={560} w={420} h={300} label={`node-${i + 1}`} o={ap(t, 0.2 + i * 0.2)} col={dead === i ? C.red : C.grey} dead={dead === i} />
        {pods && [0, 1].map((j) => <Pod key={j} x={x + 30 + j * 195} y={650} w={170} h={110} col={dead === i ? C.red : C.blue} label="Pod" o={ap(t, 0.9 + i * 0.3 + j * 0.2)} conts={[{ col: C.green }]} />)}
      </g>
    ))}
  </g>
);

const S1: React.FC<P> = ({ t }) => (
  <Frame title="أول حلقة" n={1}>
    <T x={960} y={330} s={130} c={C.ink} w={800} o={ap(t, 0.1)}>Pod Lifecycle</T>
    <T x={960} y={420} s={50} c={C.grey} w={600} o={ap(t, 0.5)}>Kubernetes</T>
    <T x={960} y={500} s={42} c={C.blue} w={700} o={ap(t, 0.9)}>SRE Interview Prep</T>
    <g transform="translate(0,120)"><Cluster t={t} /></g>
  </Frame>
);

const S2: React.FC<P> = ({ t }) => {
  const ph = [["Pending", C.amber], ["Running", C.green], ["Succeeded", C.blue], ["Failed", C.red], ["Unknown", C.grey]] as const;
  return (
    <Frame title="خمس حالات بس" n={2}>
      {ph.map(([l, c], i) => <Chip key={l} x={110 + i * 350} y={300} w={320} label={l} col={c} o={ap(t, 0.6 + i * 0.6)} />)}
      <T x={960} y={590} s={34} c={C.grey} o={ap(t, 5.5)}>STATUS</T>
      <Chip x={600} y={620} w={720} label="CrashLoopBackOff" col={C.red} o={ap(t, 5.5)} s={44} />
      <ARt x={960} y={780} s={52} c={C.ink} o={ap(t, 6.5)}>دي مش واحدة من الخمسة</ARt>
      {t > 6.8 && <g opacity={ap(t, 6.8)}><line x1={600} y1={662} x2={1320} y2={662} stroke={C.ink} strokeWidth={8} /></g>}
      <ARt x={960} y={860} s={44} c={C.grey} o={ap(t, 7.5)}>دي سبب جوه الكونتينر</ARt>
    </Frame>
  );
};

const S3: React.FC<P> = ({ t }) => {
  const hop = Math.floor(t / 1.6) % 3;
  const bound = t > 7;
  return (
    <Frame title="مستني" n={3}>
      <Chip x={810} y={150} w={300} label="Pending" col={C.amber} />
      <Cluster t={t + 10} pods={false} />
      <Pod x={NODE_X[hop] + 100} y={bound ? 650 : 420} col={C.amber} dash o={bound ? 0 : 1} label="Pod" />
      {bound && <Pod x={NODE_X[1] + 100} y={650} col={C.amber} dash label="Pod" o={ap(t, 7)} />}
      <T x={960} y={330} s={40} c={C.grey} o={t < 7 ? 1 : 0} w={600}>searching for a node ...</T>
      {bound && (
        <g opacity={ap(t, 8)}>
          <rect x={1000} y={420} width={600} height={26} rx={13} fill={C.line} />
          <rect x={1000} y={420} width={600 * clamp((t - 8) / 4)} height={26} rx={13} fill={C.amber} />
          <T x={1300} y={490} s={34} c={C.grey}>pulling image</T>
        </g>
      )}
    </Frame>
  );
};

const S4: React.FC<P> = ({ t }) => {
  const pulse = 1 + 0.06 * Math.sin(t * 5);
  return (
    <Frame title="شغال" n={4}>
      <Chip x={810} y={150} w={300} label="Running" col={C.green} />
      <Node x={600} y={330} w={720} h={480} label="node-1" />
      <g opacity={ap(t, 0.5)}>
        <Box x={700} y={430} w={520} h={300} col={C.green} fill="#fff" />
        <T x={960} y={485} s={34} c={C.green} w={800}>Pod</T>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${790 + i * 130},${580}) scale(${i === 0 ? 1 : pulse})`}>
            <Cont x={-35} y={-35} s={70} col={C.green} />
          </g>
        ))}
      </g>
      <ARt x={960} y={900} s={48} o={ap(t, 3)}>شغال</ARt>
      <ARt x={960} y={970} s={44} c={C.grey} o={ap(t, 6)}>مش معناها إن التطبيق سليم</ARt>
    </Frame>
  );
};

const S5: React.FC<P> = ({ t }) => (
  <Frame title="النهاية" n={5}>
    <Pod x={260} y={350} w={500} h={260} col={C.blue} label="Pod" conts={[{ col: C.blue, mark: "✓" }, { col: C.blue, mark: "✓" }]} o={ap(t, 0.3)} />
    <Chip x={410} y={680} w={300} label="Succeeded" col={C.blue} o={ap(t, 1.5)} />
    <ARt x={510} y={830} s={44} o={ap(t, 3)}>الكل خلص بنجاح</ARt>
    <Pod x={1160} y={350} w={500} h={260} col={C.red} label="Pod" conts={[{ col: C.blue, mark: "✓" }, { col: C.red, mark: "✕" }]} o={ap(t, 4.5)} />
    <Chip x={1260} y={680} w={300} label="Failed" col={C.red} o={ap(t, 5.5)} />
    <ARt x={1410} y={830} s={44} o={ap(t, 7)}>واحد على الأقل فشل</ARt>
  </Frame>
);

const S6: React.FC<P> = ({ t }) => {
  const blink = 0.5 + 0.5 * Math.sin(t * 6);
  return (
    <Frame title="مجهول" n={6}>
      <Chip x={810} y={150} w={300} label="Unknown" col={C.grey} />
      <Box x={150} y={380} w={520} h={300} col={C.blue} fill="#EEF2F9" o={ap(t, 0.3)}>
        <T x={410} y={450} s={40} c={C.blue}>Control Plane</T>
      </Box>
      <Node x={1250} y={380} w={520} h={300} label="node-1" dead={t > 3} col={t > 3 ? C.red : C.grey} o={ap(t, 0.5)} />
      <Pod x={1400} y={500} w={220} h={120} col={t > 3 ? C.grey : C.blue} dash={t > 3} label={t > 3 ? "?" : "Pod"} o={ap(t, 0.8)} conts={[{ col: C.grey }]} />
      {t < 3 ? <Arr x1={690} y1={530} x2={1230} y2={530} col={C.green} /> : <Arr x1={690} y1={530} x2={1230} y2={530} col={C.red} dash o={0.4 + 0.6 * blink} />}
      {t > 3.5 && <T x={960} y={500} s={90} c={C.red} o={ap(t, 3.5)}>✕</T>}
      <ARt x={960} y={850} s={48} o={ap(t, 4.5)}>مفيش أخبار من النود</ARt>
    </Frame>
  );
};

const S7: React.FC<P> = ({ t }) => (
  <Frame title="الحالة والتفاصيل" n={7}>
    <Code x={260} y={260} w={1400} s={36} lines={["$ kubectl get pods", "NAME       READY   STATUS             RESTARTS", "web-7d9f   0/1     CrashLoopBackOff   5"]} o={ap(t, 0.3)} hl={t > 4 ? 2 : -1} />
    <g opacity={ap(t, 3)}>
      <rect x={684} y={372} width={380} height={56} rx={12} fill="none" stroke={C.amber} strokeWidth={6} />
      <T x={874} y={480} s={34} c={C.amber}>STATUS</T>
    </g>
    <Chip x={260} y={680} w={420} label="Phase: Running" col={C.green} o={ap(t, 5)} s={36} />
    <T x={1100} y={730} s={40} c={C.green} o={ap(t, 6)}>Phase</T><ARt x={1100} y={800} s={48} o={ap(t, 6)}>صورة عامة</ARt>
    <T x={1100} y={890} s={40} c={C.amber} o={ap(t, 7.5)}>STATUS</T><ARt x={1100} y={960} s={48} c={C.amber} o={ap(t, 7.5)}>التفاصيل</ARt>
  </Frame>
);

const S8: React.FC<P> = ({ t }) => (
  <Frame title="القاعدة" n={8}>
    <Chip x={160} y={230} w={380} label="Pending" col={C.amber} o={ap(t, 0.4)} />
    <Arr x1={560} y1={272} x2={800} y2={272} o={ap(t, 1.2)} />
    <Code x={830} y={228} w={930} s={36} lines={["kubectl describe pod NAME"]} o={ap(t, 1.5)} />
    <T x={1295} y={380} s={34} c={C.grey} o={ap(t, 2.5)}>read the Events</T>
    <Chip x={160} y={600} w={520} label="CrashLoopBackOff" col={C.red} o={ap(t, 4.5)} s={36} />
    <Arr x1={700} y1={642} x2={800} y2={642} o={ap(t, 5.3)} />
    <Code x={830} y={598} w={930} s={36} lines={["kubectl logs NAME"]} o={ap(t, 5.6)} />
  </Frame>
);

const S9: React.FC<P> = ({ t }) => (
  <Frame title="الأحداث الأول" n={9}>
    <Pod x={150} y={300} w={380} h={220} col={C.amber} dash label="Pod" o={ap(t, 0.3)} />
    <T x={340} y={590} s={34} c={C.grey} o={ap(t, 1)}>no container yet</T>
    <ARt x={340} y={660} s={44} o={ap(t, 1.6)}>مفيش كونتينر، مفيش لوج</ARt>
    <Code x={680} y={290} w={1100} s={32} lines={["Events:", "Warning  FailedScheduling", "0/3 nodes are available:", "Insufficient cpu."]} o={ap(t, 3)} hl={t > 5 ? 1 : -1} />
  </Frame>
);

const S10: React.FC<P> = ({ t }) => {
  const seq = [0, 1, 2];
  return (
    <Frame title="قبل الأساسي" n={10}>
      <Box x={250} y={300} w={1420} h={420} col={C.blue} fill="#fff" o={ap(t, 0.2)} />
      <T x={960} y={360} s={34} c={C.blue}>Pod</T>
      {seq.map((i) => {
        const on = t > 2 + i * 2.2, done = t > 3.8 + i * 2.2;
        return (
          <g key={i} opacity={ap(t, 0.8 + i * 0.4)}>
            <Box x={330 + i * 330} y={450} w={260} h={170} col={done ? C.green : on ? C.amber : C.line} fill={done ? "#E7F6EE" : "#fff"} />
            <T x={460 + i * 330} y={520} s={30}>{`init-${i + 1}`}</T>
            <T x={460 + i * 330} y={580} s={44} c={C.green}>{done ? "✓" : on ? "..." : ""}</T>
            {i < 2 && <Arr x1={600 + i * 330} y1={535} x2={650 + i * 330} y2={535} />}
          </g>
        );
      })}
      <Arr x1={1330} y1={535} x2={1380} y2={535} o={ap(t, 8.5)} />
      <Box x={1390} y={450} w={230} h={170} col={C.green} fill="#fff" o={ap(t, 8.5)}><T x={1505} y={520} s={30}>main</T><Cont x={1482} y={545} s={46} col={C.green} /></Box>
      <ARt x={960} y={850} s={48} o={ap(t, 4)}>واحد ورا التاني، بالترتيب</ARt>
    </Frame>
  );
};

const S11: React.FC<P> = ({ t }) => (
  <Frame title="يعني إيه؟" n={11}>
    <T x={960} y={260} s={130} c={C.blue} w={800} o={ap(t, 0.3)}>Init:1/3</T>
    {[0, 1, 2].map((i) => {
      const st = i === 0 ? "done" : i === 1 ? "run" : "wait";
      const col = st === "done" ? C.green : st === "run" ? C.amber : C.line;
      return (
        <g key={i} opacity={ap(t, 1.5 + i * 0.5)}>
          <Box x={300 + i * 480} y={400} w={360} h={230} col={col} fill={st === "done" ? "#E7F6EE" : "#fff"} />
          <T x={480 + i * 480} y={470} s={36}>{`init-${i + 1}`}</T>
          {st === "done" && <T x={480 + i * 480} y={590} s={80} c={C.green}>✓</T>}
          {st === "run" && <Spinner x={480 + i * 480} y={555} t={t} col={C.amber} r={34} />}
          {st === "wait" && <T x={480 + i * 480} y={585} s={34} c={C.grey}>waiting</T>}
        </g>
      );
    })}
    <ARt x={480} y={730} s={44} c={C.green} o={ap(t, 4)}>خلص</ARt>
    <ARt x={960} y={730} s={44} c={C.amber} o={ap(t, 6)}>شغال دلوقتي</ARt>
    <ARt x={1440} y={730} s={44} c={C.grey} o={ap(t, 8)}>مستني</ARt>
  </Frame>
);

const S12: React.FC<P> = ({ t }) => {
  const rows: [string, string, number][] = [["OnFailure", "retry", C.green as unknown as number], ["Always", "retry", C.green as unknown as number], ["Never", "Failed", C.red as unknown as number]];
  return (
    <Frame title="لو فشل" n={12}>
      <Box x={160} y={200} w={360} h={170} col={C.red} fill="#FBEAEA" o={ap(t, 0.3)}><T x={340} y={280} s={34}>init container</T><T x={340} y={335} s={44} c={C.red}>✕ failed</T></Box>
      {[0, 1, 2].map((i) => {
        const y = 440 + i * 190;
        const col = i < 2 ? C.green : C.red;
        return (
          <g key={i} opacity={ap(t, 2 + i * 2.2)}>
            <Chip x={160} y={y} w={360} label={rows[i][0]} col={C.blue} s={34} />
            <Arr x1={540} y1={y + 42} x2={760} y2={y + 42} />
            {i < 2 ? (
              <g>
                <Chip x={780} y={y} w={380} label="retry" col={C.green} s={36} />
                <path d={`M${970},${y} C${970},${y - 70} ${1230},${y - 70} ${1230},${y + 30}`} fill="none" stroke={C.green} strokeWidth={5} />
                <T x={1330} y={y + 56} s={44} c={C.green}>↻</T>
              </g>
            ) : <Chip x={780} y={y} w={380} label="Pod Failed" col={C.red} s={36} />}
            <circle cx={1500} cy={y + 42} r={0} fill={col} />
          </g>
        );
      })}
    </Frame>
  );
};

const S13: React.FC<P> = ({ t }) => {
  const n = Math.min(7, Math.floor(Math.max(0, t - 2) / 1.0));
  return (
    <Frame title="عدد المحاولات" n={13}>
      <Box x={320} y={170} w={1280} h={150} col={C.blue} fill="#fff" o={ap(t, 0.2)}>
        <T x={960} y={245} s={50} c={C.blue}>Job</T>
        <T x={960} y={298} s={36} c={C.grey}>backoffLimit: 6</T>
      </Box>
      {Array.from({ length: 7 }).map((_, i) => {
        const failed = n > i;
        const last = i === 6;
        return (
          <g key={i} opacity={ap(t, 1 + i * 0.1)}>
            <circle cx={360 + i * 200} cy={560} r={62} fill={failed ? (last ? C.red : C.amber) : "#fff"} stroke={failed ? "none" : C.line} strokeWidth={5} />
            <T x={360 + i * 200} y={575} s={46} c={failed ? "#fff" : C.grey}>{failed ? "✕" : String(i + 1)}</T>
          </g>
        );
      })}
      <T x={960} y={720} s={40} c={C.grey} o={ap(t, 1)}>attempts</T>
      <Chip x={660} y={800} w={600} label="Job Failed" col={C.red} o={ap(t, 9)} />
    </Frame>
  );
};

const S14: React.FC<P> = ({ t }) => (
  <Frame title="لوج التهيئة" n={14}>
    {[0, 1, 2].map((i) => (
      <Box key={i} x={300 + i * 480} y={200} w={360} h={190} col={i === 1 ? C.amber : i === 0 ? C.green : C.line} fill="#fff" sw={i === 1 ? 8 : 4} o={ap(t, 0.3 + i * 0.3)}>
        <T x={480 + i * 480} y={310} s={38}>{`init-${i + 1}`}</T>
      </Box>
    ))}
    <ARt x={480} y={460} s={42} c={C.green} o={ap(t, 4)}>خلص</ARt>
    <ARt x={960} y={460} s={46} c={C.amber} o={ap(t, 5)}>المشكلة هنا</ARt>
    <Code x={360} y={600} w={1200} s={40} lines={["kubectl logs POD -c init-2"]} o={ap(t, 2.5)} />
  </Frame>
);

const S15: React.FC<P> = ({ t }) => (
  <Frame title="بص على النود" n={15}>
    <Code x={260} y={220} w={1400} s={38} lines={["$ kubectl get nodes", "NAME      STATUS", "node-1    Ready", "node-2    NotReady", "node-3    Ready"]} o={ap(t, 0.3)} hl={t > 3 ? 3 : -1} />
    <g opacity={ap(t, 5)}>
      <polyline points="260,880 460,880 520,780 580,960 640,880 760,880" fill="none" stroke={C.green} strokeWidth={8} />
      <T x={510} y={1010} s={34} c={C.green}>heartbeat</T>
      <polyline points="1060,880 1560,880" fill="none" stroke={C.red} strokeWidth={8} />
      <T x={1310} y={1010} s={34} c={C.red}>no heartbeat</T>
    </g>
  </Frame>
);

const S16: React.FC<P> = ({ t }) => (
  <Frame title="لو فضلت" n={16}>
    <Node x={200} y={320} w={620} h={420} label="node-2 (down)" dead col={C.red} />
    <Pod x={330} y={450} w={360} h={200} col={C.grey} dash label="old Pod" o={t < 8 ? 1 : 0.5} conts={[{ col: C.grey }]} />
    <Node x={1100} y={320} w={620} h={420} label="node-1" />
    <Box x={780} y={150} w={360} h={90} col={C.blue} fill="#fff" o={ap(t, 3)}><T x={960} y={208} s={36} c={C.blue}>Deployment</T></Box>
    <Arr x1={960} y1={250} x2={1260} y2={430} col={C.blue} o={ap(t, 4)} />
    <Pod x={1230} y={450} w={360} h={200} col={C.green} label="new Pod" o={ap(t, 5)} conts={[{ col: C.green }]} />
    <ARt x={510} y={850} s={44} c={C.grey} o={ap(t, 8)}>القديم عالق</ARt>
    <ARt x={1410} y={850} s={44} c={C.green} o={ap(t, 6.5)}>بديل على node سليمة</ARt>
  </Frame>
);

const S17: React.FC<P> = ({ t }) => (
  <Frame title="نفس المشكلة" n={17}>
    <Pod x={250} y={430} w={360} h={200} col={C.amber} dash label="Pod" o={ap(t, 0.3)} />
    <Cloud x={1450} y={530} label="Registry" o={ap(t, 0.6)} />
    <Arr x1={640} y1={530} x2={1230} y2={530} o={ap(t, 1.5)} />
    <T x={940} y={500} s={90} c={C.red} o={ap(t, 3)}>✕</T>
    <Chip x={640} y={700} w={640} label="ErrImagePull" col={C.red} o={ap(t, 4)} s={44} />
    <ARt x={960} y={860} s={46} o={ap(t, 6)}>أول محاولة فشلت</ARt>
  </Frame>
);

const S18: React.FC<P> = ({ t }) => {
  const gaps = [90, 150, 230, 340];
  let x = 200;
  return (
    <Frame title="المرحلة التانية" n={18}>
      <Chip x={560} y={150} w={800} label="ImagePullBackOff" col={C.amber} s={44} o={ap(t, 0.3)} />
      <g opacity={ap(t, 1.5)}>
        {gaps.map((g, i) => {
          const gx = x; x += g + 70;
          const show = ap(t, 2 + i * 0.8);
          return (
            <g key={i} opacity={show}>
              <circle cx={gx} cy={420} r={30} fill={C.red} />
              <T x={gx} y={433} s={34} c="#fff">✕</T>
              <line x1={gx + 36} y1={420} x2={gx + g + 34} y2={420} stroke={C.amber} strokeWidth={8} strokeDasharray="4 12" />
            </g>
          );
        })}
        <T x={900} y={520} s={34} c={C.grey}>wait gets longer</T>
      </g>
      <g opacity={ap(t, 6)}>
        <Box x={200} y={620} w={760} h={300} col={C.line}><T x={580} y={700} s={32} c={C.grey}>cause</T><T x={580} y={800} s={48} c={C.red} w={800}>image:tag</T><T x={580} y={870} s={32} c={C.grey}>wrong name or tag</T></Box>
        <Box x={1000} y={620} w={720} h={300} col={C.line}><T x={1360} y={700} s={32} c={C.grey}>cause</T><T x={1360} y={800} s={44} c={C.red} w={800}>private registry</T><T x={1360} y={870} s={32} c={C.grey}>no imagePullSecret</T></Box>
      </g>
      <g opacity={ap(t, 10)}><T x={960} y={1010} s={42} c={C.green} w={800}>fix: correct the image, or add imagePullSecret</T></g>
    </Frame>
  );
};

const S19: React.FC<P> = ({ t }) => {
  const cyc = (t * 0.33) % 1;
  const ang = cyc * Math.PI * 2 - Math.PI / 2;
  const cx = 600, cy = 560, R = 250;
  const stages: [string, string][] = [["start", C.green], ["crash", C.red], ["wait", C.amber]];
  const bars = [10, 20, 40, 80, 160, 300];
  return (
    <Frame title="بيقع ويرجع" n={19}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.line} strokeWidth={8} />
      {stages.map(([l, c], i) => {
        const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
        return <g key={l}><circle cx={cx + R * Math.cos(a)} cy={cy + R * Math.sin(a)} r={60} fill={c} /><T x={cx + R * Math.cos(a)} y={cy + R * Math.sin(a) + 12} s={32} c="#fff">{l}</T></g>;
      })}
      <circle cx={cx + R * Math.cos(ang)} cy={cy + R * Math.sin(ang)} r={30} fill="#fff" stroke={C.blue} strokeWidth={10} />
      <T x={cx} y={cy + 110} s={30} c={C.blue} w={700}>container</T>
      <Chip x={420} y={440} w={360} label="CrashLoop" col={C.red} s={32} o={ap(t, 0.2)} />
      <T x={1260} y={250} s={34} c={C.grey}>wait before restart (sec)</T>
      {bars.map((b, i) => (
        <g key={i} opacity={ap(t, 2 + i * 1.0)}>
          <rect x={1000} y={300 + i * 100} width={Math.max(30, b * 2.2)} height={64} rx={14} fill={C.amber} />
          <T x={1000 + Math.max(30, b * 2.2) + 20} y={350 + i * 100} s={34} c={C.ink} a="start">{`${b}s`}</T>
        </g>
      ))}
      <T x={1500} y={920} s={34} c={C.grey} o={ap(t, 8)}>max 5 min</T>
    </Frame>
  );
};

const S20: React.FC<P> = ({ t }) => (
  <Frame title="اقرا اللي وقع" n={20}>
    <Box x={200} y={260} w={640} h={260} col={C.red} fill="#FBEAEA" o={ap(t, 0.3)}><T x={520} y={330} s={34} c={C.red}>previous attempt</T><Cont x={497} y={370} s={56} col={C.red} mark="✕" /></Box>
    <Arr x1={850} y1={390} x2={1000} y2={390} o={ap(t, 0.8)} />
    <Box x={1020} y={260} w={640} h={260} col={C.green} fill="#E7F6EE" o={ap(t, 0.8)}><T x={1340} y={330} s={34} c={C.green}>current attempt</T><Cont x={1317} y={370} s={56} col={C.green} /></Box>
    <Code x={1020} y={600} w={700} s={36} lines={["kubectl logs POD"]} o={ap(t, 3)} />
    <Arr x1={1370} y1={590} x2={1370} y2={540} o={ap(t, 3.5)} col={C.green} />
    <Code x={200} y={600} w={760} s={36} lines={["kubectl logs POD --previous"]} o={ap(t, 6)} hl={0} />
    <Arr x1={520} y1={590} x2={520} y2={540} o={ap(t, 6.5)} col={C.red} />
  </Frame>
);

const S21: React.FC<P> = ({ t }) => (
  <Frame title="مثال" n={21}>
    <Code x={360} y={190} w={1200} s={40} lines={["kubectl run test --image=ubuntu"]} o={ap(t, 0.3)} />
    <Box x={260} y={400} w={1400} h={380} col={C.line} o={ap(t, 1.5)} />
    <T x={330} y={470} s={32} c={C.grey} a="start" o={ap(t, 1.5)}>container timeline</T>
    <rect x={330} y={540} width={ap(t, 3, 0.2) * 40} height={70} rx={8} fill={C.green} />
    <T x={385} y={595} s={28} c={C.green} a="start" o={ap(t, 3.2)}>start</T>
    <T x={400} y={680} s={34} c={C.red} a="start" o={ap(t, 4.5)}>exit immediately: no long-running process</T>
    <Chip x={620} y={850} w={680} label="CrashLoopBackOff" col={C.red} o={ap(t, 7)} s={44} />
    <T x={700} y={1030} s={40} c={C.ink} o={ap(t, 9)}>ubuntu</T><ARt x={1100} y={1030} s={42} c={C.grey} o={ap(t, 9)}>مش سيرفر</ARt>
  </Frame>
);

const S22: React.FC<P> = ({ t }) => (
  <Frame title="الحل" n={22}>
    <Code x={360} y={190} w={1200} s={40} lines={["command: [\"sleep\", \"infinity\"]"]} o={ap(t, 0.3)} hl={0} />
    <Box x={260} y={400} w={1400} h={250} col={C.line} o={ap(t, 1)} />
    <rect x={330} y={470} width={1260 * clamp((t - 1.5) / 4)} height={80} rx={12} fill={C.green} />
    <T x={960} y={605} s={32} c={C.green} o={ap(t, 5.5)}>keeps running</T>
    <g opacity={ap(t, 7.5)}>
      <Box x={360} y={740} w={1200} h={230} col={C.amber} fill="#fff">
        <T x={960} y={810} s={40} c={C.amber}>restartPolicy: Always</T>
        <T x={960} y={880} s={36} c={C.ink}>exit 0 still means restart</T>
        <T x={960} y={940} s={36} c={C.red}>same loop</T>
      </Box>
    </g>
  </Frame>
);

const S23: React.FC<P> = ({ t }) => (
  <Frame title="قاعدة الإنترفيو" n={23}>
    <Box x={160} y={220} w={720} h={220} col={C.blue} o={ap(t, 0.3)}>
      <ARt x={520} y={300} s={40} c={C.grey}>السؤال</ARt>
      <T x={520} y={385} s={40}>image name is wrong</T>
    </Box>
    <Arr x1={900} y1={330} x2={1020} y2={330} o={ap(t, 1.5)} />
    <Chip x={1040} y={170} w={640} label="ImagePullBackOff" col={C.red} o={ap(t, 3)} s={40} />
    <T x={1360} y={310} s={80} c={C.red} o={ap(t, 3.5)}>✕</T>
    <Chip x={1040} y={420} w={720} label="fix the name / tag" col={C.green} o={ap(t, 6)} s={40} />
    <T x={960} y={580} s={80} c={C.green} o={ap(t, 6.5)}>✓</T>
    <ARt x={960} y={760} s={64} c={C.ink} o={ap(t, 8)}>اتجاوب بالحل</ARt>
    <ARt x={960} y={850} s={46} c={C.grey} o={ap(t, 9)}>مش بالاسم</ARt>
  </Frame>
);

const S24: React.FC<P> = ({ t }) => {
  const rows: [string, string, string][] = [["Pending", "describe", C.amber], ["CrashLoopBackOff", "logs", C.red], ["Unknown", "node", C.grey], ["Init:N/M", "in order", C.blue]];
  return (
    <Frame title="ملخص" n={24}>
      {rows.map(([a, b, c], i) => (
        <g key={a} opacity={ap(t, 0.5 + i * 1.2)}>
          <Chip x={200} y={170 + i * 130} w={520} label={a} col={c} s={36} />
          <Arr x1={750} y1={212 + i * 130} x2={920} y2={212 + i * 130} />
          <T x={960} y={228 + i * 130} s={44} c={C.ink} a="start" f={MONO}>{b}</T>
        </g>
      ))}
      <g opacity={ap(t, 6.5)}>
        <Box x={200} y={740} w={1520} h={250} col={C.blue}>
          <T x={960} y={820} s={38} c={C.blue}>ErrImagePull vs ImagePullBackOff?</T>
          <T x={960} y={900} s={38} c={C.blue}>a node goes down, what happens to its Pod?</T>
        </Box>
      </g>
    </Frame>
  );
};

const SCENES: React.FC<P>[] = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24];

export type LessonProps = { starts: number[]; total: number; ep?: string };
export const Lesson: React.FC<LessonProps> = ({ starts, total, ep }) => {
  const { fps } = useVideoConfig();
  const [h] = React.useState(() => delayRender("fonts"));
  React.useEffect(() => { loadFonts().then(() => continueRender(h)).catch(() => continueRender(h)); }, [h]);
  return (
    <LessonCtx.Provider value={{ ep: ep || "Episode 1", total: 24 }}>
    <AbsoluteFill style={{ background: C.bg }}>
      {SCENES.map((S, i) => {
        const from = Math.round(starts[i] * fps);
        const end = Math.round((i + 1 < starts.length ? starts[i + 1] : total) * fps);
        return (
          <Sequence key={i} from={from} durationInFrames={Math.max(1, end - from)}>
            <Inner S={S} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
    </LessonCtx.Provider>
  );
};
export const Inner: React.FC<{ S: React.FC<P> }> = ({ S }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <S t={f / fps} />;
};
