import React from "react";
import { AbsoluteFill, Sequence, delayRender, continueRender, useVideoConfig } from "remotion";
import { loadFonts } from "../lib/fonts";
import { C, MONO, ap, T, ARt, Box, Arr, Code, Chip, Frame, LessonCtx, Inner } from "./Lesson";
import type { P } from "./Lesson";

const COLS = [C.blue, C.green, C.amber, C.red, C.grey];
// question slide: big card with key terms
const Q: React.FC<{ t: number; n: number; q: string; terms: string[] }> = ({ t, n, q, terms }) => (
  <Frame title={"سؤال " + n} n={n * 2 + 1}>
    <Box x={260} y={200} w={1400} h={200} col={C.blue} fill="#fff" o={ap(t, 0.3)}>
      <T x={960} y={330} s={52} c={C.blue}>{q}</T>
    </Box>
    {terms.map((a, i) => (
      <Chip key={a} x={960 - (terms.length * (Math.min(400, 1700 / terms.length - 40) + 40) - 40) / 2 + i * (Math.min(400, 1700 / terms.length - 40) + 40)} y={560} w={Math.min(400, 1700 / terms.length - 40)} label={a} col={COLS[i % 5]} s={30} o={ap(t, 2 + i * 1.5)} />
    ))}
  </Frame>
);
// answer slide: rows of label -> detail
const A: React.FC<{ t: number; n: number; rows: [string, string][]; code?: string; at?: number; step?: number }> = ({ t, n, rows, code, at = 0.8, step = 2.2 }) => (
  <Frame title={"إجابة " + n} n={n * 2 + 2}>
    {rows.map(([a, b], i) => (
      <g key={a} opacity={ap(t, at + i * step)}>
        <Chip x={160} y={220 + i * 150} w={700} label={a} col={COLS[i % 5]} s={34} />
        <Arr x1={890} y1={262 + i * 150} x2={990} y2={262 + i * 150} />
        <T x={1020} y={276 + i * 150} s={38} a="start" c={C.ink}>{b}</T>
      </g>
    ))}
    {code && <Code x={360} y={220 + rows.length * 150 + 20} w={1200} lines={[code]} s={30} o={ap(t, at + rows.length * step)} />}
  </Frame>
);
const S1: React.FC<P> = ({ t }) => (
  <Frame title="الحلقة الخامسة" n={1}>
    <T x={960} y={300} s={110} w={800} o={ap(t, 0.1)}>Interview</T>
    <T x={960} y={420} s={110} w={800} c={C.blue} o={ap(t, 0.6)}>Review</T>
    <T x={960} y={530} s={42} c={C.grey} o={ap(t, 1.2)}>SRE Interview Prep</T>
    <Chip x={660} y={660} w={600} label="10 questions" col={C.green} o={ap(t, 2)} s={42} />
  </Frame>
);
const S2: React.FC<P> = ({ t }) => {
  const eps: [string, string, string][] = [["1", "Pod Lifecycle", C.blue], ["2", "Deployments + Services", C.green], ["3", "ConfigMaps, Secrets, Volumes", C.amber], ["4", "Troubleshooting", C.red]];
  return (
    <Frame title="الحلقات الأربعة" n={2}>
      {eps.map(([n, a, c], i) => (
        <g key={n} opacity={ap(t, 0.8 + i * 2.2)}>
          <circle cx={260} cy={282 + i * 160} r={40} fill={c} />
          <T x={260} y={298 + i * 160} s={44} c="#fff">{n}</T>
          <Chip x={360} y={240 + i * 160} w={1000} label={a} col={c} s={38} />
        </g>
      ))}
    </Frame>
  );
};
const S3: React.FC<P> = ({ t }) => <Q t={t} n={1} q="Pod phases?" terms={["Pending", "Running", "Succeeded", "Failed", "Unknown"]} />;
const S4: React.FC<P> = ({ t }) => <A t={t} n={1} at={1} step={3.5} rows={[["Pending", "created, not started yet"], ["Running", "bound to a node, container runs"], ["Succeeded", "all containers finished OK"], ["Failed", "at least one container failed"], ["Unknown", "no news from the node"]]} />;
const S5: React.FC<P> = ({ t }) => <Q t={t} n={2} q="CrashLoopBackOff vs ImagePullBackOff?" terms={["CrashLoopBackOff", "ImagePullBackOff"]} />;
const S6: React.FC<P> = ({ t }) => <A t={t} n={2} rows={[["CrashLoopBackOff", "app starts and exits"], ["ImagePullBackOff", "image not pulled"]]} />;
const S7: React.FC<P> = ({ t }) => <Q t={t} n={3} q="Pod vs ReplicaSet vs Deployment?" terms={["Pod", "ReplicaSet", "Deployment"]} />;
const S8: React.FC<P> = ({ t }) => <A t={t} n={3} rows={[["Pod", "smallest unit"], ["ReplicaSet", "keeps the Pod count"], ["Deployment", "manages ReplicaSets"]]} />;
const S9: React.FC<P> = ({ t }) => <Q t={t} n={4} q="Update with no downtime?" terms={["rolling update", "readiness probe"]} />;
const S10: React.FC<P> = ({ t }) => <A t={t} n={4} rows={[["rolling update", "+ readiness probe"], ["rollback", "kubectl rollout undo"], ["revisionHistoryLimit", "10 by default"]]} />;
const S11: React.FC<P> = ({ t }) => <Q t={t} n={5} q="Service types?" terms={["ClusterIP", "NodePort", "LoadBalancer"]} />;
const S12: React.FC<P> = ({ t }) => <A t={t} n={5} rows={[["ClusterIP", "inside the cluster"], ["NodePort", "30000 - 32767"], ["LoadBalancer", "cloud load balancer"]]} />;
const S13: React.FC<P> = ({ t }) => <Q t={t} n={6} q="Service does not reach Pods?" terms={["endpoints", "selector", "targetPort"]} />;
const S14: React.FC<P> = ({ t }) => <A t={t} n={6} rows={[["endpoints", "are they empty?"], ["selector", "matches the labels?"], ["targetPort", "= containerPort"], ["Pods", "are they Ready?"]]} />;
const S15: React.FC<P> = ({ t }) => <Q t={t} n={7} q="ConfigMap vs Secret?" terms={["ConfigMap", "Secret"]} />;
const S16: React.FC<P> = ({ t }) => <A t={t} n={7} rows={[["both", "max size 1 MiB"], ["env", "needs a restart"], ["base64", "encoding, not encryption"]]} />;
const S17: React.FC<P> = ({ t }) => <Q t={t} n={8} q="PV vs PVC vs StorageClass?" terms={["PV", "PVC", "StorageClass"]} />;
const S18: React.FC<P> = ({ t }) => <A t={t} n={8} rows={[["PV", "the storage itself"], ["PVC", "the request for storage"], ["StorageClass", "creates PVs"], ["reclaim", "Retain or Delete"]]} />;
const S19: React.FC<P> = ({ t }) => <Q t={t} n={9} q="A node goes down?" terms={["NotReady", "Pods"]} />;
const S20: React.FC<P> = ({ t }) => <A t={t} n={9} rows={[["Ready", "becomes Unknown"], ["after 5 min", "Pods are evicted"], ["scheduler", "places no new Pods"]]} />;
const S21: React.FC<P> = ({ t }) => <Q t={t} n={10} q="Pod stuck in Pending?" terms={["describe", "FailedScheduling"]} />;
const S22: React.FC<P> = ({ t }) => <A t={t} n={10} rows={[["describe", "read the Events"], ["FailedScheduling", "the reason"], ["check", "requests, taints, nodes"]]} />;
const S23: React.FC<P> = ({ t }) => (
  <Frame title="ترتيب الإجابة" n={23}>
    {["definition", "commands", "cause", "fix"].map((a, i) => (
      <g key={a} opacity={ap(t, 0.8 + i * 1.8)}>
        <Chip x={160 + i * 440} y={260} w={380} label={a} col={COLS[i]} s={34} />
        {i < 3 && <Arr x1={550 + i * 440} y1={302} x2={600 + i * 440} y2={302} />}
      </g>
    ))}
    <Code x={460} y={520} w={1000} lines={["get  >  describe  >  logs"]} s={36} o={ap(t, 9)} />
  </Frame>
);
const S24: React.FC<P> = ({ t }) => (
  <Frame title="جرّب بإيدك" n={24}>
    <Chip x={460} y={260} w={1000} label="minikube" col={C.blue} o={ap(t, 0.8)} s={42} />
    <Chip x={460} y={400} w={1000} label="kind" col={C.green} o={ap(t, 2.5)} s={42} />
    <ARt x={960} y={620} s={50} o={ap(t, 5)}>جرّب كل سيناريو بنفسك</ARt>
  </Frame>
);
const S25: React.FC<P> = ({ t }) => (
  <Frame title="الختام" n={25}>
    <T x={960} y={330} s={100} w={800} o={ap(t, 0.3)}>Cloud DevOps</T>
    <T x={960} y={440} s={44} c={C.grey} o={ap(t, 1)}>SRE Interview Prep</T>
    {["Pod", "Deployment", "Service", "Config", "Storage", "Debug"].map((a, i) => (
      <Chip key={a} x={170 + (i % 3) * 550} y={560 + Math.floor(i / 3) * 140} w={500} label={a} col={COLS[i % 5]} s={34} o={ap(t, 1.8 + i * 0.5)} />
    ))}
  </Frame>
);

const SCENES: React.FC<P>[] = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25];

export type Lesson6Props = { starts: number[]; total: number; ep?: string };
export const Lesson6: React.FC<Lesson6Props> = ({ starts, total, ep }) => {
  const { fps } = useVideoConfig();
  const [h] = React.useState(() => delayRender("fonts"));
  React.useEffect(() => { loadFonts().then(() => continueRender(h)).catch(() => continueRender(h)); }, [h]);
  return (
    <LessonCtx.Provider value={{ ep: ep || "Episode 5", total: 25 }}>
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
