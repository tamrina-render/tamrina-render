import React from "react";
import { AbsoluteFill, Sequence, delayRender, continueRender, useVideoConfig } from "remotion";
import { loadFonts } from "../lib/fonts";
import { C, MONO, ap, T, ARt, Box, Arr, Code, Chip, Spinner, Frame, LessonCtx, Inner } from "./Lesson";
import type { P } from "./Lesson";

const Bad: React.FC<{ x: number; y: number; o?: number }> = ({ x, y, o = 1 }) => (<g opacity={o} stroke={C.red} strokeWidth={9} strokeLinecap="round"><line x1={x - 24} y1={y - 24} x2={x + 24} y2={y + 24} /><line x1={x + 24} y1={y - 24} x2={x - 24} y2={y + 24} /></g>);
const Good: React.FC<{ x: number; y: number; o?: number }> = ({ x, y, o = 1 }) => (<path opacity={o} d={`M ${x - 26} ${y} l 18 20 l 36 -42`} fill="none" stroke={C.green} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />);
const Stat: React.FC<{ x: number; y: number; w?: number; label: string; col: string; o?: number; sub?: string }> = ({ x, y, w = 520, label, col, o = 1, sub }) => (
  <g opacity={o}>
    <Box x={x} y={y} w={w} h={sub ? 190 : 130} col={col} fill="#fff" />
    <T x={x + w / 2} y={y + 62} s={30} c={C.grey} f={MONO}>web-7d9f</T>
    <T x={x + w / 2} y={y + 112} s={42} c={col}>{label}</T>
    {sub && <T x={x + w / 2} y={y + 160} s={28} c={C.grey}>{sub}</T>}
  </g>
);
const Step: React.FC<{ x: number; y: number; n: number; label: string; cmd?: string; o?: number; col?: string }> = ({ x, y, n, label, cmd, o = 1, col = C.blue }) => (
  <g opacity={o}>
    <circle cx={x + 40} cy={y + 42} r={34} fill={col} />
    <T x={x + 40} y={y + 56} s={38} c="#fff">{String(n)}</T>
    <T x={x + 110} y={y + 56} s={42} a="start">{label}</T>
    {cmd && <Code x={x + 640} y={y} w={760} lines={[cmd]} s={30} />}
  </g>
);
const Cards: React.FC<{ t: number; items: [string, string?][]; col: string; y0?: number; at?: number; step?: number }> = ({ t, items, col, y0 = 240, at = 0.8, step = 1.6 }) => (
  <g>{items.map(([a, b], i) => (
    <g key={a} opacity={ap(t, at + i * step)}>
      <Chip x={260} y={y0 + i * 150} w={700} label={a} col={col} s={34} />
      {b && <T x={1000} y={y0 + 56 + i * 150} s={36} a="start" c={C.grey}>{b}</T>}
    </g>
  ))}</g>
);

const S1: React.FC<P> = ({ t }) => (
  <Frame title="الحلقة الرابعة" n={1}>
    <T x={960} y={300} s={110} w={800} o={ap(t, 0.1)}>Troubleshooting</T>
    <T x={960} y={400} s={42} c={C.grey} o={ap(t, 0.6)}>SRE Interview Prep</T>
    {["Pending", "CrashLoopBackOff", "ImagePullBackOff", "No endpoints", "Rollout stuck", "NotReady"].map((a, i) => (
      <Chip key={a} x={170 + (i % 3) * 550} y={540 + Math.floor(i / 3) * 140} w={500} label={a} col={[C.amber, C.red, C.blue, C.green, C.amber, C.grey][i]} s={32} o={ap(t, 1.5 + i * 0.5)} />
    ))}
  </Frame>
);
const S2: React.FC<P> = ({ t }) => (
  <Frame title="منهج التشخيص" n={2}>
    <Step x={200} y={250} n={1} label="state" cmd="kubectl get pods" o={ap(t, 0.8)} />
    <Step x={200} y={450} n={2} label="events" cmd="kubectl describe pod web" o={ap(t, 3.5)} />
    <Step x={200} y={650} n={3} label="logs" cmd="kubectl logs web" o={ap(t, 6.5)} />
    <ARt x={960} y={920} s={46} o={ap(t, 9)}>نفس الترتيب في كل مرة</ARt>
  </Frame>
);
const S3: React.FC<P> = ({ t }) => (
  <Frame title="عالق في الانتظار" n={3}>
    <Stat x={140} y={300} label="Pending" col={C.amber} o={ap(t, 0.5)} sub="no node assigned" />
    <Arr x1={680} y1={400} x2={900} y2={400} o={ap(t, 2.5)} />
    <Box x={920} y={240} w={860} h={420} col={C.blue} fill="#fff" o={ap(t, 2.5)}><T x={1350} y={290} s={32} c={C.blue}>scheduler</T></Box>
    {[0, 1, 2].map((i) => (
      <g key={i} opacity={ap(t, 3.5 + i * 0.6)}><Box x={960 + i * 270} y={360} w={240} h={220} col={C.line} fill="#F7F9FC" /><T x={1080 + i * 270} y={480} s={32} c={C.grey}>node</T><Bad x={1080 + i * 270} y={540} /></g>
    ))}
  </Frame>
);
const S4: React.FC<P> = ({ t }) => (
  <Frame title="الأحداث" n={4}>
    <Code x={360} y={240} w={1200} lines={["kubectl describe pod web"]} s={34} o={ap(t, 0.5)} />
    <Box x={260} y={420} w={1400} h={330} col={C.red} fill="#FBEAEA" o={ap(t, 2.5)}>
      <T x={960} y={500} s={46} c={C.red}>FailedScheduling</T>
      <T x={960} y={600} s={38} c={C.ink} f={MONO} o={ap(t, 4)}>0/3 nodes: Insufficient cpu</T>
      <T x={960} y={680} s={38} c={C.ink} f={MONO} o={ap(t, 5.5)}>0/3 nodes: Insufficient memory</T>
    </Box>
  </Frame>
);
const S5: React.FC<P> = ({ t }) => {
  const it = [["requests too high", "أكبر من أي node"], ["nodes are full", "مفيش مكان"], ["hostPort", "عدد Pods محدود"], ["taint / selector", "بيمنع الجدولة"]];
  return (
    <Frame title="الأسباب" n={5}>
      {it.map(([a, b], i) => (
        <g key={a} opacity={ap(t, 0.8 + i * 2.2)}>
          <Chip x={200} y={230 + i * 170} w={700} label={a} col={C.amber} s={36} />
          <Arr x1={930} y1={272 + i * 170} x2={1040} y2={272 + i * 170} />
          <ARt x={1070} y={284 + i * 170} s={40} a="start" c={C.grey}>{b}</ARt>
        </g>
      ))}
    </Frame>
  );
};
const S6: React.FC<P> = ({ t }) => (
  <Frame title="الحل" n={6}>
    <Stat x={140} y={260} label="Pending" col={C.amber} o={ap(t, 0.3)} w={440} />
    <Arr x1={600} y1={330} x2={760} y2={330} o={ap(t, 2)} />
    <Box x={780} y={230} w={1000} h={170} col={C.green} fill="#fff" o={ap(t, 2)}><T x={1280} y={335} s={42} c={C.green}>lower the requests</T></Box>
    <Box x={780} y={430} w={1000} h={170} col={C.green} fill="#fff" o={ap(t, 4.5)}><T x={1280} y={535} s={42} c={C.green}>add nodes</T></Box>
    <Box x={780} y={630} w={1000} h={170} col={C.green} fill="#fff" o={ap(t, 7)}><T x={1280} y={735} s={42} c={C.green}>Service instead of hostPort</T></Box>
  </Frame>
);
const S7: React.FC<P> = ({ t }) => {
  return (
    <Frame title="بيقفل ويرجع" n={7}>
      <Stat x={700} y={190} label="CrashLoopBackOff" col={C.red} w={520} o={ap(t, 0.3)} />
      <Spinner x={960} y={470} t={t} col={C.red} r={40} />
      {["start", "crash", "restart"].map((a2, i) => (
        <Chip key={a2} x={300 + i * 480} y={600} w={340} label={a2} col={[C.green, C.red, C.amber][i]} s={36} o={ap(t, 1 + i * 0.8)} />
      ))}
      <T x={960} y={800} s={40} c={C.grey} o={ap(t, 4)}>10s, 20s, 40s ... up to 5 min</T>
      
    </Frame>
  );
};
const S8: React.FC<P> = ({ t }) => (
  <Frame title="السجلات" n={8}>
    <Code x={260} y={240} w={1400} lines={["kubectl logs web --previous"]} s={36} o={ap(t, 0.5)} />
    <Box x={260} y={400} w={1400} h={200} col={C.red} fill="#fff" o={ap(t, 3)}>
      <T x={960} y={500} s={36} c={C.red} f={MONO}>Error: DB_HOST is not set</T>
    </Box>
    <Code x={260} y={680} w={1400} lines={["kubectl describe pod web", "Last State: Terminated  Exit Code: 1"]} s={32} o={ap(t, 6)} />
  </Frame>
);
const S9: React.FC<P> = ({ t }) => (
  <Frame title="الإعداد الناقص" n={9}>
    <Box x={140} y={300} w={600} h={300} col={C.blue} fill="#fff" o={ap(t, 0.3)}>
      <T x={440} y={370} s={38} c={C.blue}>app</T>
      <T x={440} y={470} s={34} f={MONO} o={ap(t, 1.5)}>reads DB_HOST</T>
    </Box>
    <Arr x1={780} y1={450} x2={1000} y2={450} o={ap(t, 3)} />
    <Box x={1020} y={300} w={760} h={300} col={C.red} fill="#FBEAEA" dash o={ap(t, 3)}>
      <T x={1400} y={470} s={44} c={C.red}>DB_HOST = ?</T>
    </Box>
    <Bad x={1400} y={680} o={ap(t, 5)} />
    <ARt x={960} y={860} s={48} o={ap(t, 6.5)}>القيمة مش موجودة فالتطبيق يقفل</ARt>
  </Frame>
);
const S10: React.FC<P> = ({ t }) => (
  <Frame title="الحل" n={10}>
    <Step x={200} y={260} n={1} label="add the value" o={ap(t, 0.8)} col={C.green} />
    <T x={1180} y={316} s={36} c={C.grey} f={MONO} o={ap(t, 1.5)}>ConfigMap / Secret</T>
    <Step x={200} y={460} n={2} label="restart" o={ap(t, 4)} col={C.green} />
    <Code x={900} y={470} w={860} lines={["kubectl rollout restart deploy/web"]} s={30} o={ap(t, 4.5)} />
    <ARt x={960} y={780} s={46} o={ap(t, 7)}>المتغيرات مبتتحدثش لوحدها</ARt>
  </Frame>
);
const S11: React.FC<P> = ({ t }) => (
  <Frame title="الصورة مش بتتسحب" n={11}>
    <Stat x={140} y={300} label="ImagePullBackOff" col={C.blue} w={620} o={ap(t, 0.5)} sub="state: Waiting" />
    <Box x={1000} y={260} w={380} h={230} col={C.green} fill="#fff" o={ap(t, 2.5)}><T x={1190} y={390} s={40} c={C.green}>node</T></Box>
    <Box x={1450} y={260} w={330} h={230} col={C.grey} fill="#fff" o={ap(t, 3)}><T x={1615} y={390} s={36} c={C.grey}>registry</T></Box>
    <Arr x1={1390} y1={375} x2={1440} y2={375} col={C.red} dash o={ap(t, 4)} />
    <Bad x={1415} y={470} o={ap(t, 4.5)} />
  </Frame>
);
const S12: React.FC<P> = ({ t }) => (
  <Frame title="تلات فحوصات" n={12}>
    <Step x={200} y={250} n={1} label="name and tag are right" o={ap(t, 0.8)} />
    <Step x={200} y={430} n={2} label="image exists in registry" o={ap(t, 3.5)} />
    <Step x={200} y={610} n={3} label="node has credentials" o={ap(t, 6.5)} />
    <Code x={260} y={800} w={1400} lines={["kubectl describe pod web   # Events"]} s={30} o={ap(t, 9)} />
  </Frame>
);
const S13: React.FC<P> = ({ t }) => (
  <Frame title="السجل الخاص" n={13}>
    <Chip x={460} y={230} w={1000} label="private registry" col={C.grey} o={ap(t, 0.4)} s={40} />
    <Arr x1={960} y1={330} x2={960} y2={420} o={ap(t, 2)} />
    <Code x={160} y={430} w={1600} lines={["kubectl create secret docker-registry regcred \\", "  --docker-server=... --docker-username=... --docker-password=..."]} s={30} o={ap(t, 3)} />
    <Chip x={560} y={700} w={800} label="Secret: regcred" col={C.red} o={ap(t, 6.5)} s={40} />
  </Frame>
);
const S14: React.FC<P> = ({ t }) => (
  <Frame title="الربط" n={14}>
    <Code x={360} y={240} w={1200} lines={["spec:", "  imagePullSecrets:", "  - name: regcred"]} s={38} o={ap(t, 0.5)} hl={1} />
    <Chip x={160} y={640} w={400} label="Pod" col={C.blue} o={ap(t, 4)} />
    <Arr x1={580} y1={682} x2={760} y2={682} o={ap(t, 5)} />
    <Chip x={780} y={640} w={400} label="regcred" col={C.red} o={ap(t, 5)} />
    <Arr x1={1200} y1={682} x2={1380} y2={682} o={ap(t, 6.5)} />
    <Chip x={1400} y={640} w={400} label="registry" col={C.grey} o={ap(t, 6.5)} />
    <Good x={1600} y={800} o={ap(t, 8)} />
  </Frame>
);
const S15: React.FC<P> = ({ t }) => (
  <Frame title="الخدمة مش بتوصل" n={15}>
    <Chip x={140} y={440} w={300} label="Client" col={C.grey} o={ap(t, 0.3)} />
    <Arr x1={460} y1={482} x2={640} y2={482} o={ap(t, 1.5)} />
    <Box x={660} y={380} w={400} h={200} col={C.blue} fill="#fff" o={ap(t, 1.5)}><T x={860} y={500} s={42} c={C.blue}>Service</T></Box>
    <Bad x={1130} y={482} o={ap(t, 3)} />
    {[0, 1, 2].map((i) => <Stat key={i} x={1240} y={240 + i * 190} w={500} label="Running" col={C.green} o={ap(t, 4 + i * 0.5)} />)}
  </Frame>
);
const S16: React.FC<P> = ({ t }) => (
  <Frame title="نقاط الوصول" n={16}>
    <Code x={260} y={240} w={1400} lines={["kubectl get endpointslices \\", "  -l kubernetes.io/service-name=web"]} s={34} o={ap(t, 0.5)} />
    <Box x={260} y={520} w={600} h={260} col={C.green} fill="#fff" o={ap(t, 4)}><T x={560} y={620} s={38} c={C.green}>3 endpoints</T><T x={560} y={700} s={32} c={C.grey}>3 Pods expected</T></Box>
    <T x={960} y={670} s={60} c={C.grey} o={ap(t, 6)}>=</T>
    <Box x={1060} y={520} w={600} h={260} col={C.blue} fill="#fff" o={ap(t, 6)}><T x={1360} y={620} s={38} c={C.blue}>compare</T><T x={1360} y={700} s={32} c={C.grey}>numbers must match</T></Box>
  </Frame>
);
const S17: React.FC<P> = ({ t }) => (
  <Frame title="فاضية" n={17}>
    <Box x={140} y={240} w={700} h={260} col={C.blue} fill="#fff" o={ap(t, 0.3)}><T x={490} y={310} s={34} c={C.blue}>Service selector</T><T x={490} y={410} s={40} f={MONO}>app: web</T></Box>
    <Box x={1080} y={240} w={700} h={260} col={C.red} fill="#fff" o={ap(t, 2)}><T x={1430} y={310} s={34} c={C.red}>Pod labels</T><T x={1430} y={410} s={40} f={MONO}>app: wbe</T></Box>
    <Bad x={960} y={370} o={ap(t, 4)} />
    <Chip x={160} y={640} w={760} label="targetPort" col={C.amber} o={ap(t, 6)} s={36} />
    <T x={960} y={700} s={46} o={ap(t, 6)}>=</T>
    <Chip x={1000} y={640} w={760} label="containerPort" col={C.amber} o={ap(t, 6)} s={36} />
  </Frame>
);
const S18: React.FC<P> = ({ t }) => (
  <Frame title="الحل" n={18}>
    <Box x={140} y={240} w={700} h={260} col={C.blue} fill="#fff"><T x={490} y={310} s={34} c={C.blue}>Service selector</T><T x={490} y={410} s={40} f={MONO}>app: web</T></Box>
    <Box x={1080} y={240} w={700} h={260} col={C.green} fill="#fff" o={ap(t, 0.5)}><T x={1430} y={310} s={34} c={C.green}>Pod labels</T><T x={1430} y={410} s={40} f={MONO} c={C.green}>app: web</T></Box>
    <Good x={960} y={370} o={ap(t, 3)} />
    <Chip x={460} y={640} w={1000} label="fix the label or the selector" col={C.green} o={ap(t, 4.5)} s={38} />
    <T x={960} y={820} s={42} c={C.blue} o={ap(t, 7)}>endpoints appear</T>
  </Frame>
);
const S19: React.FC<P> = ({ t }) => (
  <Frame title="التحديث واقف" n={19}>
    <Code x={360} y={230} w={1200} lines={["kubectl rollout status deploy/web", "Waiting for rollout to finish..."]} s={34} o={ap(t, 0.5)} />
    <Box x={160} y={560} w={760} h={280} col={C.green} fill="#fff" o={ap(t, 3.5)}><T x={540} y={630} s={40} c={C.green}>v1 Pods</T><T x={540} y={730} s={46} c={C.green}>Ready</T></Box>
    <Box x={1000} y={560} w={760} h={280} col={C.amber} fill="#fff" o={ap(t, 5)}><T x={1380} y={630} s={40} c={C.amber}>v2 Pods</T><T x={1380} y={730} s={46} c={C.amber}>not Ready</T></Box>
  </Frame>
);
const S20: React.FC<P> = ({ t }) => (
  <Frame title="الفحص" n={20}>
    <Chip x={160} y={260} w={640} label="readiness probe" col={C.blue} o={ap(t, 0.4)} s={38} />
    <Arr x1={820} y1={302} x2={960} y2={302} o={ap(t, 2)} />
    <Box x={980} y={230} w={780} h={150} col={C.red} fill="#FBEAEA" o={ap(t, 2)}><T x={1370} y={325} s={44} c={C.red}>probe fails</T></Box>
    <Arr x1={1370} y1={400} x2={1370} y2={500} o={ap(t, 4)} />
    <Box x={980} y={510} w={780} h={150} col={C.amber} fill="#fff" o={ap(t, 4)}><T x={1370} y={605} s={44} c={C.amber}>never Ready</T></Box>
    <Box x={160} y={510} w={780} h={150} col={C.green} fill="#fff" o={ap(t, 6.5)}><T x={550} y={605} s={40} c={C.green}>old Pods keep serving</T></Box>
    <T x={960} y={820} s={42} c={C.green} o={ap(t, 8)}>no downtime</T>
  </Frame>
);
const S21: React.FC<P> = ({ t }) => (
  <Frame title="الإصلاح" n={21}>
    <Code x={260} y={230} w={1400} lines={["kubectl describe pod web-v2"]} s={34} o={ap(t, 0.5)} />
    {["wrong path", "wrong port", "slow startup"].map((a, i) => <Chip key={a} x={160 + i * 580} y={420} w={520} label={a} col={C.amber} o={ap(t, 3 + i * 1.2)} s={34} />)}
    <Chip x={160} y={620} w={800} label="fix the probe or the app" col={C.green} o={ap(t, 7)} s={36} />
    <Code x={1000} y={625} w={760} lines={["kubectl rollout undo deploy/web"]} s={28} o={ap(t, 9)} />
  </Frame>
);
const S22: React.FC<P> = ({ t }) => (
  <Frame title="العقدة مش جاهزة" n={22}>
    <Code x={360} y={230} w={1200} lines={["kubectl get nodes", "node-2   NotReady"]} s={36} o={ap(t, 0.5)} hl={1} />
    <Box x={160} y={560} w={760} h={280} col={C.green} fill="#fff" o={ap(t, 3)}><T x={540} y={650} s={42} c={C.green}>node-1: Ready</T></Box>
    <Box x={1000} y={560} w={760} h={280} col={C.red} fill="#FBEAEA" o={ap(t, 4)}><T x={1380} y={650} s={42} c={C.red}>node-2: NotReady</T><Bad x={1380} y={760} /></Box>
  </Frame>
);
const S23: React.FC<P> = ({ t }) => (
  <Frame title="إيه اللي بيحصل" n={23}>
    <Chip x={460} y={220} w={1000} label="Ready = Unknown" col={C.amber} o={ap(t, 0.5)} s={42} />
    <Arr x1={960} y1={320} x2={960} y2={400} o={ap(t, 3)} />
    <Chip x={460} y={410} w={1000} label="after 5 min: eviction" col={C.red} o={ap(t, 3.5)} s={42} />
    <Arr x1={960} y1={510} x2={960} y2={590} o={ap(t, 6)} />
    <Chip x={460} y={600} w={1000} label="no new Pods scheduled" col={C.grey} o={ap(t, 6.5)} s={42} />
  </Frame>
);
const S24: React.FC<P> = ({ t }) => (
  <Frame title="التشخيص" n={24}>
    <Step x={160} y={230} n={1} label="conditions" cmd="kubectl describe node node-2" o={ap(t, 0.8)} />
    <Step x={160} y={430} n={2} label="on the node" o={ap(t, 4)} />
    {["kubelet", "container runtime", "network"].map((a, i) => <Chip key={a} x={420 + i * 400} y={560} w={360} label={a} col={C.blue} o={ap(t, 5 + i * 0.8)} s={28} />)}
    <Step x={160} y={720} n={3} label="before the fix" cmd="kubectl cordon, kubectl drain" o={ap(t, 8.5)} col={C.green} />
  </Frame>
);
const S25: React.FC<P> = ({ t }) => {
  const rows: [string, string, string][] = [["Pending", "scheduling", C.amber], ["CrashLoopBackOff", "app crashes", C.red], ["ImagePullBackOff", "image or credentials", C.blue], ["No endpoints", "labels", C.green], ["Rollout stuck", "probes", C.amber], ["NotReady", "node", C.grey]];
  return (
    <Frame title="ملخص" n={25}>
      <Code x={460} y={170} w={1000} lines={["get  >  describe  >  logs"]} s={34} o={ap(t, 0.3)} />
      {rows.map(([a, b, c], i) => (
        <g key={a} opacity={ap(t, 1.5 + i * 1.4)}>
          <Chip x={200} y={330 + i * 105} w={640} label={a} col={c} s={30} />
          <Arr x1={860} y1={372 + i * 105} x2={980} y2={372 + i * 105} />
          <T x={1010} y={384 + i * 105} s={36} a="start" f={MONO}>{b}</T>
        </g>
      ))}
    </Frame>
  );
};

const SCENES: React.FC<P>[] = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25];

export type Lesson5Props = { starts: number[]; total: number; ep?: string };
export const Lesson5: React.FC<Lesson5Props> = ({ starts, total, ep }) => {
  const { fps } = useVideoConfig();
  const [h] = React.useState(() => delayRender("fonts"));
  React.useEffect(() => { loadFonts().then(() => continueRender(h)).catch(() => continueRender(h)); }, [h]);
  return (
    <LessonCtx.Provider value={{ ep: ep || "Episode 4", total: 25 }}>
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
