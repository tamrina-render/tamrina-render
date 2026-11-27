import React from "react";
import { AbsoluteFill, Sequence, delayRender, continueRender, useVideoConfig } from "remotion";
import { loadFonts } from "../lib/fonts";
import { C, MONO, ap, clamp, T, ARt, Box, Cont, Pod, Arr, Code, Chip, Spinner, Cloud, Frame, LessonCtx, Inner } from "./Lesson";
import type { P } from "./Lesson";

const Tag: React.FC<{ x: number; y: number; label: string; col?: string; o?: number; w?: number }> = ({ x, y, label, col = C.blue, o = 1, w = 190 }) => (
  <g opacity={o}>
    <rect x={x} y={y} width={w} height={46} rx={23} fill={col} />
    <text x={x + w / 2} y={y + 32} fontSize={26} fill="#fff" fontWeight={700} textAnchor="middle" fontFamily={MONO}>{label}</text>
  </g>
);
const PodV: React.FC<{ x: number; y: number; col?: string; o?: number; label?: string; ver?: string; ok?: boolean }> = ({ x, y, col = C.blue, o = 1, label = "Pod", ver, ok = true }) => (
  <g opacity={o}>
    <Pod x={x} y={y} w={170} h={110} col={col} label={label} conts={[{ col: ok ? C.green : C.amber }]} />
    {ver && <T x={x + 120} y={y + 92} s={26} c={col} w={800}>{ver}</T>}
  </g>
);

const S1: React.FC<P> = ({ t }) => (
  <Frame title="الحلقة التانية" n={1}>
    <T x={960} y={330} s={120} w={800} o={ap(t, 0.1)}>Deployments</T>
    <T x={960} y={450} s={120} w={800} c={C.blue} o={ap(t, 0.6)}>Services</T>
    <T x={960} y={540} s={42} c={C.grey} o={ap(t, 1)}>SRE Interview Prep</T>
    {[0, 1, 2].map((i) => <PodV key={i} x={500 + i * 300} y={650} o={ap(t, 1.2 + i * 0.3)} />)}
    <Chip x={760} y={850} w={400} label="Service" col={C.blue} o={ap(t, 2.2)} />
  </Frame>
);

const S2: React.FC<P> = ({ t }) => (
  <Frame title="المشكلة" n={2}>
    <PodV x={300} y={240} col={t > 3 ? C.red : C.blue} o={t > 4 ? 0.3 : 1} />
    <T x={385} y={400} s={32} c={C.grey} o={ap(t, 0.5)}>10.0.1.5</T>
    {t > 3 && <T x={385} y={210} s={70} c={C.red}>✕</T>}
    <Arr x1={520} y1={300} x2={760} y2={300} o={ap(t, 4)} col={C.grey} dash />
    <PodV x={800} y={240} o={ap(t, 4.5)} />
    <T x={885} y={400} s={32} c={C.red} o={ap(t, 5)}>10.0.7.9</T>
    <ARt x={1400} y={300} s={46} c={C.red} o={ap(t, 5.5)}>العنوان اتغير</ARt>
    <Chip x={200} y={600} w={500} label="Deployment" col={C.green} o={ap(t, 8)} />
    <ARt x={450} y={760} s={46} o={ap(t, 9)}>يحافظ على العدد</ARt>
    <Chip x={1100} y={600} w={500} label="Service" col={C.blue} o={ap(t, 11)} />
    <ARt x={1350} y={760} s={46} o={ap(t, 12)}>عنوان ثابت</ARt>
  </Frame>
);

const S3: React.FC<P> = ({ t }) => (
  <Frame title="الليبلز" n={3}>
    <T x={960} y={220} s={50} c={C.grey} o={ap(t, 0.3)}>key = value</T>
    {[0, 1, 2].map((i) => <PodV key={i} x={300 + i * 480} y={420} o={ap(t, 0.5 + i * 0.3)} />)}
    <Tag x={310 + 0 * 480} y={560} label="app=web" o={ap(t, 3)} col={C.blue} />
    <Tag x={310 + 480} y={560} label="app=web" o={ap(t, 4.5)} col={C.blue} />
    <Tag x={310 + 960} y={560} label="app=db" o={ap(t, 6)} col={C.amber} />
    <ARt x={960} y={850} s={46} c={C.grey} o={ap(t, 8)}>بتربط كل حاجة ببعض</ARt>
  </Frame>
);

const S4: React.FC<P> = ({ t }) => (
  <Frame title="السيليكتور" n={4}>
    <Code x={600} y={190} w={720} s={40} lines={["selector: app=web"]} o={ap(t, 0.3)} hl={0} />
    {[0, 1, 2, 3].map((i) => {
      const web = i < 2, bad = i === 3;
      const col = web ? C.green : bad ? C.red : C.grey;
      const on = t > 3;
      return (
        <g key={i} opacity={ap(t, 0.8 + i * 0.3)}>
          <Pod x={200 + i * 400} y={440} w={300} h={170} col={on ? col : C.blue} label="Pod" conts={[{ col: C.green }]} />
          <Tag x={250 + i * 400} y={640} label={i < 2 ? "app=web" : i === 2 ? "app=db" : "app=wbe"} col={on ? col : C.blue} />
          {on && <T x={350 + i * 400} y={760} s={50} c={col}>{web ? "✓" : "✕"}</T>}
        </g>
      );
    })}
    <ARt x={960} y={900} s={46} c={C.red} o={ap(t, 8)}>الليبل غلط = مفيش حاجة بتشتغل</ARt>
  </Frame>
);

const S5: React.FC<P> = ({ t }) => {
  const died = t > 3 && t < 5, back = t >= 5;
  return (
    <Frame title="ReplicaSet" n={5}>
      <Box x={560} y={190} w={800} h={130} col={C.blue} o={ap(t, 0.2)}>
        <T x={960} y={250} s={44} c={C.blue}>ReplicaSet</T>
        <T x={960} y={298} s={34} c={C.grey}>replicas: 3</T>
      </Box>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <Arr x1={960} y1={330} x2={440 + i * 520} y2={470} col={C.line} o={ap(t, 0.8)} />
          <PodV x={355 + i * 520} y={480} col={i === 1 && died ? C.red : C.blue} o={i === 1 && died ? 0.3 : ap(t, 1 + i * 0.3)} />
        </g>
      ))}
      {died && <T x={960} y={470} s={70} c={C.red}>✕</T>}
      {back && <PodV x={875} y={480} col={C.green} o={ap(t, 5)} />}
      <ARt x={960} y={820} s={48} o={ap(t, 6)}>مات؟ بيعمل واحد بداله</ARt>
    </Frame>
  );
};

const S6: React.FC<P> = ({ t }) => (
  <Frame title="الحدود" n={6}>
    <Box x={160} y={200} w={500} h={130} col={C.blue} o={ap(t, 0.2)}><T x={410} y={285} s={44} c={C.blue}>ReplicaSet</T></Box>
    {[0, 1, 2].map((i) => <PodV key={i} x={160 + i * 180 - 60} y={420} o={ap(t, 0.6 + i * 0.2)} ver="v1" />)}
    <Code x={1000} y={210} w={760} s={38} lines={["image: app:v2"]} o={ap(t, 3)} hl={0} />
    <Arr x1={1380} y1={340} x2={1380} y2={420} o={ap(t, 4)} col={C.ink} />
    <T x={1380} y={500} s={90} c={C.red} o={ap(t, 4.5)}>✕</T>
    <T x={1380} y={590} s={36} c={C.grey} o={ap(t, 5)}>old Pods stay v1</T>
    <Arr x1={410} y1={600} x2={410} y2={720} o={ap(t, 7)} col={C.green} />
    <Chip x={160} y={740} w={500} label="Deployment" col={C.green} o={ap(t, 7.5)} />
  </Frame>
);

const S7: React.FC<P> = ({ t }) => (
  <Frame title="تلات طبقات" n={7}>
    <Chip x={710} y={190} w={500} label="Deployment" col={C.green} o={ap(t, 0.4)} />
    <Arr x1={960} y1={280} x2={960} y2={360} o={ap(t, 1.5)} />
    <Chip x={710} y={370} w={500} label="ReplicaSet" col={C.blue} o={ap(t, 1.8)} />
    <Arr x1={960} y1={460} x2={960} y2={540} o={ap(t, 3)} />
    {[0, 1, 2].map((i) => <PodV key={i} x={540 + i * 250} y={560} o={ap(t, 3.4 + i * 0.3)} />)}
    <ARt x={960} y={850} s={46} o={ap(t, 6)}>كل طبقة ليها شغلة واحدة</ARt>
  </Frame>
);

const RS: React.FC<{ x: number; y: number; label: string; ver: string; n: number; col: string; o?: number }> = ({ x, y, label, ver, n, col, o = 1 }) => (
  <g opacity={o}>
    <Box x={x} y={y} w={760} h={330} col={col} fill="#fff" />
    <T x={x + 30} y={y + 50} s={36} c={col} a="start">{label}</T>
    <T x={x + 730} y={y + 50} s={36} c={col} a="end">{ver}</T>
    {[0, 1, 2, 3, 4].map((i) => (i < n ? <Cont key={i} x={x + 40 + i * 140} y={y + 130} s={100} col={col} /> : <rect key={i} x={x + 40 + i * 140} y={y + 130} width={100} height={100} rx={18} fill="none" stroke={C.line} strokeWidth={4} strokeDasharray="10 8" />))}
  </g>
);
const S8: React.FC<P> = ({ t }) => {
  const k = Math.min(4, Math.floor(Math.max(0, t - 2) / 1.6));
  return (
    <Frame title="Rolling update" n={8}>
      <RS x={100} y={260} label="ReplicaSet" ver="v1" n={4 - k} col={C.grey} />
      <RS x={1060} y={260} label="ReplicaSet" ver="v2" n={k} col={C.green} />
      <Arr x1={880} y1={430} x2={1040} y2={430} o={ap(t, 1.5)} />
      <ARt x={960} y={760} s={48} o={ap(t, 3)}>واحد واحد</ARt>
      <T x={960} y={850} s={40} c={C.green} o={ap(t, 8)}>zero downtime</T>
    </Frame>
  );
};

const S9: React.FC<P> = ({ t }) => (
  <Frame title="السرعة" n={9}>
    <T x={960} y={210} s={40} c={C.grey} o={ap(t, 0.2)}>replicas: 4</T>
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i} opacity={ap(t, 0.5 + i * 0.2)}>
        <Cont x={360 + i * 220} y={290} s={120} col={i === 4 ? (t > 4 ? C.blue : C.line) : C.green} />
      </g>
    ))}
    <Tag x={360 + 4 * 220 - 35} y={440} label="+1 surge" col={C.blue} o={ap(t, 4)} w={190} />
    <Box x={160} y={560} w={760} h={300} col={C.blue} o={ap(t, 3.5)}>
      <T x={540} y={640} s={44} c={C.blue}>maxSurge: 25%</T>
      <T x={540} y={720} s={46} c={C.ink}>max 5 Pods</T>
      <T x={540} y={790} s={32} c={C.grey}>(4 + 1)</T>
    </Box>
    <Box x={1000} y={560} w={760} h={300} col={C.amber} o={ap(t, 7)}>
      <T x={1380} y={640} s={44} c={C.amber}>maxUnavailable: 25%</T>
      <T x={1380} y={720} s={46} c={C.ink}>min 3 ready</T>
      <T x={1380} y={790} s={32} c={C.grey}>(4 - 1)</T>
    </Box>
  </Frame>
);

const S10: React.FC<P> = ({ t }) => (
  <Frame title="لازم يبقى جاهز" n={10}>
    {[0, 1, 2].map((i) => <PodV key={i} x={160 + i * 230} y={300} col={C.green} o={ap(t, 0.3 + i * 0.2)} ver="v1" />)}
    <T x={500} y={470} s={34} c={C.green} o={ap(t, 1.5)}>serving traffic</T>
    <Box x={1000} y={280} w={700} h={230} col={C.amber} fill="#fff" dash o={ap(t, 3)}>
      <T x={1350} y={350} s={34} c={C.amber}>new Pod v2</T>
      <Spinner x={1350} y={430} t={t} col={C.amber} r={34} />
    </Box>
    <T x={1350} y={560} s={36} c={C.red} o={ap(t, 5)}>readiness probe failing</T>
    <rect x={400} y={680} width={1120} height={30} rx={15} fill={C.line} />
    <rect x={400} y={680} width={Math.min(1,0.35) * 1120 * ap(t, 6, 1.2)} height={30} rx={15} fill={C.amber} />
    <T x={960} y={780} s={40} c={C.amber} o={ap(t, 7)}>rollout stalled</T>
    <ARt x={960} y={880} s={46} o={ap(t, 8.5)}>القديم لسه شغال</ARt>
  </Frame>
);

const S11: React.FC<P> = ({ t }) => (
  <Frame title="Recreate" n={11}>
    <T x={960} y={220} s={40} c={C.grey}>time</T>
    <Arr x1={200} y1={260} x2={1700} y2={260} col={C.grey} />
    {[0, 1, 2].map((i) => <Cont key={i} x={220 + i * 110} y={360} s={90} col={C.grey} o={t < 5 ? 1 : 0.15} />)}
    {t > 4 && <T x={420} y={500} s={70} c={C.red}>✕</T>}
    <Box x={640} y={340} w={460} h={160} col={C.red} fill="#FBEAEA" o={ap(t, 5)}><T x={870} y={435} s={42} c={C.red}>downtime</T></Box>
    {[0, 1, 2].map((i) => <Cont key={i} x={1220 + i * 110} y={360} s={90} col={C.green} o={ap(t, 8 + i * 0.3)} />)}
    <T x={920} y={640} s={40} c={C.ink} o={ap(t, 3)}>strategy: Recreate</T>
    <ARt x={960} y={780} s={46} o={ap(t, 10)}>لما نسختين ما ينفعش يشتغلوا مع بعض</ARt>
  </Frame>
);

const S12: React.FC<P> = ({ t }) => (
  <Frame title="أوامر لازم تحفظها" n={12}>
    <Code x={260} y={220} w={1400} s={38} lines={["kubectl set image deployment/web app=app:v2"]} o={ap(t, 0.5)} />
    <ARt x={960} y={380} s={44} c={C.grey} o={ap(t, 1)}>غيّر الصورة</ARt>
    <Code x={260} y={470} w={1400} s={38} lines={["kubectl rollout status deployment/web"]} o={ap(t, 3.5)} />
    <ARt x={960} y={630} s={44} c={C.grey} o={ap(t, 4)}>تابع التحديث</ARt>
    <Code x={260} y={720} w={1400} s={38} lines={["kubectl rollout history deployment/web"]} o={ap(t, 7)} />
    <ARt x={960} y={880} s={44} c={C.grey} o={ap(t, 7.5)}>شوف النسخ اللي عدّت</ARt>
  </Frame>
);

const S13: React.FC<P> = ({ t }) => {
  const k = Math.min(4, Math.floor(Math.max(0, t - 5) / 1.4));
  return (
    <Frame title="Rollback" n={13}>
      <Code x={460} y={170} w={1000} s={42} lines={["kubectl rollout undo deployment/web"]} o={ap(t, 0.3)} hl={0} />
      <RS x={100} y={330} label="ReplicaSet" ver="v1" n={k} col={C.green} />
      <RS x={1060} y={330} label="ReplicaSet" ver="v2" n={4 - k} col={C.red} />
      <Arr x1={1040} y1={500} x2={880} y2={500} o={ap(t, 4)} />
      <T x={960} y={800} s={36} c={C.grey} o={ap(t, 3)}>old ReplicaSets are kept</T>
      <T x={960} y={870} s={36} c={C.blue} o={ap(t, 3.5)}>revisionHistoryLimit: 10</T>
    </Frame>
  );
};

const Client: React.FC<{ x: number; y: number; o?: number; label?: string }> = ({ x, y, o = 1, label = "Client" }) => (
  <g opacity={o}>
    <Box x={x} y={y} w={200} h={100} col={C.ink} r={16}><T x={x + 100} y={y + 62} s={32}>{label}</T></Box>
  </g>
);
const S14: React.FC<P> = ({ t }) => {
  const ips = ["10.0.1.5", "10.0.7.9", "10.0.3.2"];
  const swap = t > 6;
  return (
    <Frame title="الخدمة" n={14}>
      <Client x={120} y={440} o={ap(t, 0.3)} />
      <Arr x1={340} y1={490} x2={560} y2={490} o={ap(t, 1)} />
      <Box x={580} y={380} w={440} h={220} col={C.blue} fill="#fff" o={ap(t, 1)}>
        <T x={800} y={450} s={44} c={C.blue}>Service</T>
        <T x={800} y={515} s={34} c={C.ink} f={MONO}>10.96.0.10</T>
        <T x={800} y={570} s={32} c={C.grey} f={MONO}>web</T>
      </Box>
      {[0, 1, 2].map((i) => (
        <g key={i} opacity={ap(t, 2 + i * 0.4)}>
          <Arr x1={1040} y1={490} x2={1260} y2={290 + i * 200} col={C.line} />
          <PodV x={1280} y={240 + i * 200} />
          <T x={1365} y={400 + i * 200 - 14} s={26} c={C.grey} f={MONO}>{swap && i === 1 ? "10.0.9.4" : ips[i]}</T>
        </g>
      ))}
      <ARt x={800} y={850} s={46} o={ap(t, 5)}>العنوان ثابت مهما اتغيّر اللي وراه</ARt>
    </Frame>
  );
};

const S15: React.FC<P> = ({ t }) => (
  <Frame title="مين بيستقبل؟" n={15}>
    <Box x={140} y={200} w={560} h={260} col={C.blue} fill="#fff" o={ap(t, 0.3)}>
      <T x={420} y={270} s={44} c={C.blue}>Service</T>
      <T x={420} y={350} s={36} f={MONO}>selector: app=web</T>
    </Box>
    {[0, 1, 2].map((i) => (
      <g key={i} opacity={ap(t, 1 + i * 0.4)}>
        <Arr x1={720} y1={330} x2={940} y2={260 + i * 190} col={i === 2 ? C.amber : C.line} dash={i === 2} />
        <PodV x={960} y={210 + i * 190} col={i === 2 ? C.amber : C.blue} ok={i !== 2} />
        <Tag x={1160} y={250 + i * 190} label="app=web" col={C.grey} w={170} />
      </g>
    ))}
    <T x={1560} y={470} s={34} c={C.amber} o={ap(t, 4)}>not ready</T>
    <Box x={140} y={560} w={560} h={190} col={C.green} fill="#E7F6EE" o={ap(t, 5)}>
      <T x={420} y={620} s={34} c={C.green}>endpoints</T>
      <T x={420} y={670} s={32} f={MONO}>10.0.1.5</T>
      <T x={420} y={715} s={32} f={MONO}>10.0.7.9</T>
    </Box>
    <Code x={260} y={820} w={1000} s={36} lines={["kubectl get endpoints web"]} o={ap(t, 7)} />
  </Frame>
);

const S16: React.FC<P> = ({ t }) => (
  <Frame title="الأول" n={16}>
    <Chip x={710} y={160} w={500} label="ClusterIP" col={C.blue} o={ap(t, 0.3)} />
    <Box x={160} y={300} w={1000} h={560} col={C.blue} fill="#EEF2F9" dash o={ap(t, 0.8)}>
      <T x={660} y={350} s={34} c={C.blue}>cluster</T>
    </Box>
    <PodV x={220} y={480} o={ap(t, 1.5)} label="Pod A" />
    <Arr x1={410} y1={540} x2={560} y2={540} o={ap(t, 2.5)} col={C.green} />
    <Box x={580} y={470} w={220} h={140} col={C.blue} fill="#fff" o={ap(t, 2)}><T x={690} y={555} s={34} c={C.blue}>Service</T></Box>
    <Arr x1={810} y1={540} x2={900} y2={540} o={ap(t, 3)} col={C.line} />
    <PodV x={910} y={480} o={ap(t, 3)} />
    <Client x={1400} y={490} o={ap(t, 5)} label="Outside" />
    <Arr x1={1390} y1={540} x2={1190} y2={540} col={C.red} dash o={ap(t, 6)} />
    <T x={1290} y={520} s={80} c={C.red} o={ap(t, 6.5)}>✕</T>
    <ARt x={960} y={940} s={44} c={C.grey} o={ap(t, 8)}>للخدمات الداخلية بس</ARt>
  </Frame>
);

const S17: React.FC<P> = ({ t }) => (
  <Frame title="البورتات" n={17}>
    <Client x={120} y={430} o={ap(t, 0.3)} />
    <Arr x1={340} y1={480} x2={560} y2={480} o={ap(t, 1)} />
    <Box x={580} y={340} w={460} h={280} col={C.blue} fill="#fff" o={ap(t, 1)}>
      <T x={810} y={420} s={44} c={C.blue}>Service</T>
      <T x={810} y={520} s={60} c={C.ink} f={MONO}>port: 80</T>
    </Box>
    <Arr x1={1060} y1={480} x2={1280} y2={480} o={ap(t, 3.5)} />
    <Box x={1300} y={340} w={460} h={280} col={C.green} fill="#fff" o={ap(t, 3.5)}>
      <T x={1530} y={420} s={44} c={C.green}>container</T>
      <T x={1530} y={520} s={50} c={C.ink} f={MONO}>targetPort: 8080</T>
    </Box>
    <ARt x={810} y={800} s={44} c={C.grey} o={ap(t, 6)}>بيستقبل عليه</ARt>
    <ARt x={1530} y={800} s={44} c={C.grey} o={ap(t, 7)}>بيسمع عليه فعلا</ARt>
  </Frame>
);

const S18: React.FC<P> = ({ t }) => (
  <Frame title="التاني" n={18}>
    <Chip x={710} y={160} w={500} label="NodePort" col={C.amber} o={ap(t, 0.3)} />
    {[0, 1, 2].map((i) => (
      <g key={i} opacity={ap(t, 0.8 + i * 0.3)}>
        <Box x={260 + i * 500} y={430} w={400} h={260} col={C.grey} fill="#EEF2F9" />
        <T x={460 + i * 500} y={480} s={30} c={C.grey} w={800}>{`node-${i + 1}`}</T>
        <Box x={330 + i * 500} y={520} w={260} h={80} col={C.amber} fill="#fff" r={14}><T x={460 + i * 500} y={578} s={36} c={C.amber} f={MONO}>:30080</T></Box>
      </g>
    ))}
    <Client x={860} y={820} o={ap(t, 4)} label="Outside" />
    <Arr x1={960} y1={810} x2={780} y2={610} o={ap(t, 5)} col={C.green} />
    <T x={960} y={950} s={34} c={C.grey} o={ap(t, 7)}>30000 - 32767</T>
  </Frame>
);

const S19: React.FC<P> = ({ t }) => (
  <Frame title="التالت" n={19}>
    <Chip x={710} y={160} w={500} label="LoadBalancer" col={C.green} o={ap(t, 0.3)} />
    <Client x={80} y={500} o={ap(t, 0.5)} label="Users" />
    <Arr x1={300} y1={550} x2={420} y2={550} o={ap(t, 1.2)} />
    <Cloud x={600} y={550} label="Cloud LB" col={C.green} o={ap(t, 1.5)} />
    {[0, 1, 2].map((i) => (
      <g key={i} opacity={ap(t, 3 + i * 0.3)}>
        <Arr x1={760} y1={550} x2={1020} y2={330 + i * 220} col={C.line} />
        <Box x={1040} y={290 + i * 220} w={240} h={100} col={C.grey} fill="#EEF2F9" r={16}><T x={1160} y={352 + i * 220} s={30} c={C.grey}>{`node-${i + 1}`}</T></Box>
        <Arr x1={1290} y1={340 + i * 220} x2={1420} y2={340 + i * 220} />
        <PodV x={1440} y={285 + i * 220} />
      </g>
    ))}
    <ARt x={700} y={930} s={44} c={C.grey} o={ap(t, 6)}>بيبني فوق اللي قبله</ARt>
  </Frame>
);

const S20: React.FC<P> = ({ t }) => (
  <Frame title="طبقات فوق بعض" n={20}>
    <Box x={260} y={180} w={1400} h={760} col={C.green} fill="#F1FAF5" o={ap(t, 0.3)}><T x={960} y={250} s={44} c={C.green}>LoadBalancer</T></Box>
    <Box x={420} y={320} w={1080} h={540} col={C.amber} fill="#FFF8EA" o={ap(t, 2)}><T x={960} y={390} s={44} c={C.amber}>NodePort</T></Box>
    <Box x={600} y={450} w={720} h={340} col={C.blue} fill="#EEF2F9" o={ap(t, 4)}><T x={960} y={530} s={44} c={C.blue}>ClusterIP</T></Box>
    <ARt x={960} y={720} s={42} c={C.grey} o={ap(t, 8)}>مش على كلاود؟ مش هيشتغل لوحده</ARt>
  </Frame>
);

const S21: React.FC<P> = ({ t }) => (
  <Frame title="الأسماء" n={21}>
    <Box x={700} y={180} w={520} h={110} col={C.blue} fill="#fff" o={ap(t, 0.3)}><T x={960} y={252} s={44} c={C.blue}>CoreDNS</T></Box>
    <PodV x={160} y={420} o={ap(t, 1)} label="Pod" />
    <Arr x1={350} y1={470} x2={700} y2={300} o={ap(t, 2)} col={C.grey} />
    <Box x={640} y={430} w={640} h={120} col={C.blue} fill="#fff" o={ap(t, 3)}><T x={960} y={510} s={40} c={C.blue}>Service: web</T></Box>
    <Code x={260} y={650} w={1400} s={38} lines={["web", "web.prod"]} o={ap(t, 4.5)} hl={t > 8 ? 1 : 0} />
    <ARt x={500} y={860} s={44} o={ap(t, 5)}>نفس النطاق</ARt>
    <ARt x={1360} y={860} s={44} o={ap(t, 8)}>نطاق تاني</ARt>
  </Frame>
);

const S22: React.FC<P> = ({ t }) => (
  <Frame title="سؤال 1" n={22}>
    <Box x={160} y={200} w={700} h={140} col={C.red} fill="#FBEAEA" o={ap(t, 0.3)}><T x={510} y={290} s={40} c={C.red}>no traffic</T></Box>
    <Arr x1={510} y1={350} x2={510} y2={430} o={ap(t, 1.5)} />
    <Code x={160} y={440} w={700} s={36} lines={["kubectl get endpoints"]} o={ap(t, 2)} hl={0} />
    <Arr x1={510} y1={530} x2={510} y2={600} o={ap(t, 3.5)} />
    <Chip x={260} y={610} w={500} label="empty" col={C.red} o={ap(t, 4)} />
    <Box x={1000} y={300} w={720} h={200} col={C.amber} o={ap(t, 6)}><T x={1360} y={380} s={38}>selector</T><T x={1360} y={440} s={38}>≠ labels</T></Box>
    <Box x={1000} y={560} w={720} h={200} col={C.amber} o={ap(t, 8)}><T x={1360} y={640} s={38}>Pods not ready</T><T x={1360} y={700} s={32} c={C.grey}>readiness probe</T></Box>
  </Frame>
);

const S23: React.FC<P> = ({ t }) => (
  <Frame title="سؤال 2" n={23}>
    <Box x={160} y={210} w={700} h={400} col={C.blue} o={ap(t, 0.3)}>
      <T x={510} y={290} s={46} c={C.blue}>ReplicaSet</T>
      <ARt x={510} y={400} s={46} o={ap(t, 1.5)}>بيحافظ على العدد</ARt>
    </Box>
    <Box x={1060} y={210} w={700} h={400} col={C.green} o={ap(t, 3)}>
      <T x={1410} y={290} s={46} c={C.green}>Deployment</T>
      <ARt x={1410} y={400} s={44} o={ap(t, 4)}>بيدير اللي تحته</ARt>
      <T x={1410} y={480} s={36} o={ap(t, 5)}>rolling update</T>
      <T x={1410} y={540} s={36} o={ap(t, 6)}>rollback</T>
    </Box>
    <T x={960} y={730} s={40} c={C.grey} o={ap(t, 8)}>zero downtime?</T>
    <Chip x={460} y={790} w={1000} label="rolling update + readiness probe" col={C.green} o={ap(t, 9)} s={40} />
  </Frame>
);

const S24: React.FC<P> = ({ t }) => (
  <Frame title="سؤال 3" n={24}>
    <Box x={460} y={190} w={1000} h={140} col={C.red} fill="#FBEAEA" o={ap(t, 0.3)}><T x={960} y={280} s={42} c={C.red}>update broke production</T></Box>
    <Arr x1={960} y1={340} x2={960} y2={430} o={ap(t, 2)} />
    <Chip x={410} y={440} w={1100} label="1. kubectl rollout undo" col={C.green} o={ap(t, 2.5)} s={42} />
    <Arr x1={960} y1={540} x2={960} y2={630} o={ap(t, 6)} />
    <Chip x={410} y={640} w={1100} label="2. investigate the cause" col={C.blue} o={ap(t, 6.5)} s={42} />
    <ARt x={960} y={850} s={50} o={ap(t, 9)}>الأول رجّع الخدمة، بعدين دوّر</ARt>
  </Frame>
);

const S25: React.FC<P> = ({ t }) => {
  const rows: [string, string, string][] = [["Deployment", "ReplicaSets + rollout undo", C.green], ["Service", "stable address", C.blue], ["ClusterIP", "internal", C.grey], ["NodePort + LoadBalancer", "external", C.amber]];
  return (
    <Frame title="ملخص" n={25}>
      {rows.map(([a, b, c], i) => (
        <g key={a} opacity={ap(t, 0.5 + i * 1.2)}>
          <Chip x={140} y={170 + i * 125} w={640} label={a} col={c} s={34} />
          <Arr x1={810} y1={212 + i * 125} x2={940} y2={212 + i * 125} />
          <T x={970} y={226 + i * 125} s={38} a="start" f={MONO}>{b}</T>
        </g>
      ))}
      <g opacity={ap(t, 6.5)}>
        <Box x={200} y={720} w={1520} h={250} col={C.blue}>
          <T x={960} y={810} s={38} c={C.blue}>port vs targetPort?</T>
          <T x={960} y={890} s={38} c={C.blue}>how do you get zero downtime?</T>
        </Box>
      </g>
    </Frame>
  );
};

const SCENES: React.FC<P>[] = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25];

export type Lesson3Props = { starts: number[]; total: number; ep?: string };
export const Lesson3: React.FC<Lesson3Props> = ({ starts, total, ep }) => {
  const { fps } = useVideoConfig();
  const [h] = React.useState(() => delayRender("fonts"));
  React.useEffect(() => { loadFonts().then(() => continueRender(h)).catch(() => continueRender(h)); }, [h]);
  return (
    <LessonCtx.Provider value={{ ep: ep || "Episode 2", total: 25 }}>
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
