import React from "react";
import { AbsoluteFill, Sequence, delayRender, continueRender, useVideoConfig } from "remotion";
import { loadFonts } from "../lib/fonts";
import { C, MONO, ap, T, ARt, Box, Cont, Arr, Code, Chip, Spinner, Frame, LessonCtx, Inner } from "./Lesson";
import type { P } from "./Lesson";

const Disk: React.FC<{ x: number; y: number; w?: number; h?: number; col?: string; o?: number; label?: string }> = ({ x, y, w = 220, h = 180, col = C.blue, o = 1, label }) => (
  <g opacity={o}>
    <rect x={x} y={y + 30} width={w} height={h - 60} fill="#fff" stroke={col} strokeWidth={5} />
    <ellipse cx={x + w / 2} cy={y + h - 30} rx={w / 2} ry={30} fill="#fff" stroke={col} strokeWidth={5} />
    <ellipse cx={x + w / 2} cy={y + 30} rx={w / 2} ry={30} fill="#EAF0FD" stroke={col} strokeWidth={5} />
    {label && <T x={x + w / 2} y={y + h / 2 + 22} s={34} c={col}>{label}</T>}
  </g>
);
const Card: React.FC<{ x: number; y: number; w: number; h: number; col: string; title: string; o?: number; lock?: boolean }> = ({ x, y, w, h, col, title, o = 1, lock }) => (
  <g opacity={o}>
    <Box x={x} y={y} w={w} h={h} col={col} fill="#fff" />
    <rect x={x} y={y} width={w} height={70} rx={20} fill={col} />
    <T x={x + w / 2} y={y + 49} s={36} c="#fff">{title}</T>
    {lock && <g><rect x={x + w - 70} y={y + 90} width={40} height={32} rx={6} fill={col} /><path d={`M ${x + w - 62} ${y + 90} v -12 a 12 12 0 0 1 24 0 v 12`} fill="none" stroke={col} strokeWidth={6} /></g>}
  </g>
);
const Bad: React.FC<{ x: number; y: number; o?: number }> = ({ x, y, o = 1 }) => (<g opacity={o} stroke={C.red} strokeWidth={9} strokeLinecap="round"><line x1={x - 24} y1={y - 24} x2={x + 24} y2={y + 24} /><line x1={x + 24} y1={y - 24} x2={x - 24} y2={y + 24} /></g>);
const Good: React.FC<{ x: number; y: number; o?: number }> = ({ x, y, o = 1 }) => (<path opacity={o} d={`M ${x - 26} ${y} l 18 20 l 36 -42`} fill="none" stroke={C.green} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />);
const Kv: React.FC<{ x: number; y: number; lines: string[]; o?: number; col?: string }> = ({ x, y, lines, o = 1, col = C.ink }) => (
  <g opacity={o}>{lines.map((l, i) => <T key={i} x={x} y={y + i * 52} s={32} c={col} a="start" f={MONO}>{l}</T>)}</g>
);
const File: React.FC<{ x: number; y: number; label: string; o?: number; col?: string }> = ({ x, y, label, o = 1, col = C.blue }) => (
  <g opacity={o}><rect x={x} y={y} width={70} height={86} rx={8} fill="#fff" stroke={col} strokeWidth={4} /><line x1={x + 14} y1={y + 30} x2={x + 56} y2={y + 30} stroke={col} strokeWidth={4} /><line x1={x + 14} y1={y + 50} x2={x + 56} y2={y + 50} stroke={col} strokeWidth={4} /><T x={x + 35} y={y + 124} s={28} c={C.ink} f={MONO}>{label}</T></g>
);
const Ct: React.FC<{ x: number; y: number; w?: number; h?: number; label?: string; o?: number; col?: string }> = ({ x, y, w = 380, h = 240, label = "container", o = 1, col = C.green }) => (
  <g opacity={o}><Box x={x} y={y} w={w} h={h} col={col} fill="#fff" /><T x={x + w / 2} y={y + 46} s={32} c={col}>{label}</T></g>
);

const S1: React.FC<P> = ({ t }) => (
  <Frame title="الحلقة التالتة" n={1}>
    <T x={960} y={330} s={110} w={800} o={ap(t, 0.1)}>ConfigMaps</T>
    <T x={960} y={450} s={110} w={800} c={C.blue} o={ap(t, 0.6)}>Secrets</T>
    <T x={960} y={570} s={110} w={800} c={C.green} o={ap(t, 1.1)}>Volumes</T>
    <T x={960} y={680} s={42} c={C.grey} o={ap(t, 1.6)}>SRE Interview Prep</T>
  </Frame>
);
const S2: React.FC<P> = ({ t }) => (
  <Frame title="فصل الإعدادات" n={2}>
    <Box x={140} y={400} w={360} h={200} col={C.blue} o={ap(t, 0.3)}><T x={320} y={520} s={60} c={C.blue}>image</T></Box>
    {["dev", "staging", "prod"].map((e, i) => (
      <g key={e} opacity={ap(t, 3 + i * 1.2)}>
        <Arr x1={510} y1={500} x2={760} y2={290 + i * 210} />
        <Box x={780} y={230 + i * 210} w={460} h={120} col={C.green} fill="#fff"><T x={1010} y={305 + i * 210} s={44} c={C.green}>{e}</T></Box>
        <Chip x={1280} y={248 + i * 210} w={500} label={["LOG_LEVEL=debug", "LOG_LEVEL=info", "LOG_LEVEL=warn"][i]} col={C.amber} s={32} />
      </g>
    ))}
    <ARt x={960} y={900} s={50} o={ap(t, 8)}>الإعدادات بتتحقن من بره</ARt>
  </Frame>
);
const S3: React.FC<P> = ({ t }) => (
  <Frame title="الإعدادات العادية" n={3}>
    <Card x={560} y={220} w={800} h={420} col={C.blue} title="ConfigMap" o={ap(t, 0.3)} />
    <Kv x={620} y={350} lines={["LOG_LEVEL: debug", "API_URL: http://api", "TIMEOUT: 30"]} o={ap(t, 2)} />
    <Chip x={710} y={730} w={500} label="max size: 1 MiB" col={C.grey} o={ap(t, 5)} s={38} />
  </Frame>
);
const S4: React.FC<P> = ({ t }) => (
  <Frame title="الإنشاء" n={4}>
    {[["from-literal", "kubectl create configmap app --from-literal=K=V"], ["from-file", "kubectl create configmap app --from-file=app.conf"], ["YAML", "kubectl apply -f configmap.yaml"]].map(([a, b], i) => (
      <g key={a} opacity={ap(t, 1 + i * 2.5)}>
        <Chip x={160} y={230 + i * 220} w={380} label={a} col={C.blue} s={36} />
        <Code x={580} y={226 + i * 220} w={1180} lines={[b]} s={30} />
      </g>
    ))}
    <ARt x={960} y={930} s={48} o={ap(t, 9)}>والنتيجة واحدة</ARt>
  </Frame>
);
const S5: React.FC<P> = ({ t }) => (
  <Frame title="كمتغيرات" n={5}>
    <Card x={140} y={300} w={520} h={300} col={C.blue} title="ConfigMap" o={ap(t, 0.3)} />
    <Kv x={190} y={440} lines={["LOG_LEVEL: debug", "TIMEOUT: 30"]} o={ap(t, 0.8)} />
    <Arr x1={680} y1={450} x2={1000} y2={450} o={ap(t, 2)} />
    <Ct x={1020} y={250} w={720} h={400} o={ap(t, 2.2)} />
    <Code x={1060} y={340} w={640} lines={["LOG_LEVEL=debug", "TIMEOUT=30"]} s={32} o={ap(t, 3)} />
    <Chip x={160} y={760} w={560} label="configMapKeyRef" col={C.amber} o={ap(t, 5)} s={34} />
    <Chip x={1100} y={760} w={560} label="envFrom" col={C.amber} o={ap(t, 6)} s={36} />
  </Frame>
);
const S6: React.FC<P> = ({ t }) => (
  <Frame title="كملفات" n={6}>
    <Card x={140} y={300} w={520} h={300} col={C.blue} title="ConfigMap" o={ap(t, 0.3)} />
    <Kv x={190} y={440} lines={["app.conf", "log.conf"]} o={ap(t, 0.8)} />
    <Arr x1={680} y1={450} x2={1000} y2={450} o={ap(t, 2)} />
    <Ct x={1020} y={250} w={720} h={400} o={ap(t, 2.2)} />
    <T x={1380} y={360} s={32} c={C.grey} f={MONO} o={ap(t, 3)}>/etc/config</T>
    <File x={1190} y={410} label="app.conf" o={ap(t, 3.5)} />
    <File x={1470} y={410} label="log.conf" o={ap(t, 4.5)} />
    <Chip x={640} y={760} w={640} label="volumeMounts" col={C.amber} o={ap(t, 6)} s={38} />
  </Frame>
);
const S7: React.FC<P> = ({ t }) => (
  <Frame title="التحديث" n={7}>
    <Box x={140} y={230} w={800} h={420} col={C.red} fill="#fff" o={ap(t, 0.3)}>
      <T x={540} y={310} s={44} c={C.red}>env</T>
      <T x={540} y={430} s={36} c={C.ink} o={ap(t, 3)}>needs restart</T>
    </Box>
    <Bad x={540} y={540} o={ap(t, 3.5)} />
    <Box x={980} y={230} w={800} h={420} col={C.green} fill="#fff" o={ap(t, 0.3)}>
      <T x={1380} y={310} s={44} c={C.green}>volume</T>
      <T x={1380} y={430} s={36} c={C.ink} o={ap(t, 5)}>updates later</T>
    </Box>
    <Good x={1380} y={540} o={ap(t, 5.5)} />
    <Code x={560} y={780} w={800} lines={["kubectl rollout restart deploy/web"]} s={30} o={ap(t, 8)} />
  </Frame>
);
const S8: React.FC<P> = ({ t }) => (
  <Frame title="القفل" n={8}>
    <Card x={460} y={220} w={1000} h={300} col={C.blue} title="ConfigMap" o={ap(t, 0.3)} lock />
    <Code x={560} y={600} w={800} lines={["immutable: true"]} s={40} o={ap(t, 3)} />
    <Bad x={1500} y={650} o={ap(t, 6)} />
    <T x={1580} y={660} s={36} c={C.red} o={ap(t, 6)} a="start">edit</T>
    <ARt x={960} y={900} s={48} o={ap(t, 8)}>مسح وإنشاء من جديد</ARt>
  </Frame>
);
const S9: React.FC<P> = ({ t }) => (
  <Frame title="الأسرار" n={9}>
    <Card x={140} y={260} w={700} h={380} col={C.blue} title="ConfigMap" o={ap(t, 0.3)} />
    <Kv x={190} y={400} lines={["LOG_LEVEL: debug"]} o={ap(t, 0.8)} />
    <Card x={1080} y={260} w={700} h={380} col={C.red} title="Secret" o={ap(t, 3)} lock />
    <Kv x={1130} y={400} lines={["DB_PASSWORD: ****"]} o={ap(t, 3.5)} />
    <ARt x={960} y={860} s={48} o={ap(t, 6)}>نفس الشكل، للبيانات الحساسة</ARt>
  </Frame>
);
const S10: React.FC<P> = ({ t }) => {
  const rows = [["Opaque", "default"], ["dockerconfigjson", "registry"], ["tls", "certificate + key"], ["basic-auth", "user + password"], ["ssh-auth", "private key"]];
  return (
    <Frame title="الأنواع" n={10}>
      {rows.map(([a, b], i) => (
        <g key={a} opacity={ap(t, 0.8 + i * 1.8)}>
          <Chip x={200} y={200 + i * 150} w={640} label={a} col={i === 0 ? C.green : C.blue} s={34} />
          <Arr x1={870} y1={242 + i * 150} x2={990} y2={242 + i * 150} />
          <T x={1020} y={256 + i * 150} s={38} a="start" c={C.grey}>{b}</T>
        </g>
      ))}
    </Frame>
  );
};
const S11: React.FC<P> = ({ t }) => (
  <Frame title="الترميز" n={11}>
    <Box x={140} y={240} w={540} h={170} col={C.blue} fill="#fff" o={ap(t, 0.3)}><T x={410} y={345} s={44} c={C.ink} f={MONO}>c2VjcmV0</T></Box>
    <Arr x1={700} y1={325} x2={1000} y2={325} o={ap(t, 2.5)} />
    <Box x={1020} y={240} w={540} h={170} col={C.green} fill="#fff" o={ap(t, 2.5)}><T x={1290} y={345} s={44} c={C.ink} f={MONO}>secret</T></Box>
    <Code x={360} y={500} w={1200} lines={["echo c2VjcmV0 | base64 -d"]} s={36} o={ap(t, 3.5)} />
    <Chip x={460} y={680} w={1000} label="encoding is not encryption" col={C.red} o={ap(t, 6)} s={40} />
    <T x={960} y={870} s={40} c={C.blue} f={MONO} o={ap(t, 9)}>stringData: plain text input</T>
  </Frame>
);
const S12: React.FC<P> = ({ t }) => (
  <Frame title="المخزن" n={12}>
    <Disk x={150} y={300} w={300} h={240} col={C.red} label="etcd" o={ap(t, 0.3)} />
    <T x={300} y={620} s={34} c={C.red} o={ap(t, 1.5)}>unencrypted by default</T>
    {["encryption at rest", "RBAC", "external secrets manager"].map((a, i) => (
      <g key={a} opacity={ap(t, 4 + i * 2)}>
        <Arr x1={480} y1={420} x2={720} y2={290 + i * 170} col={C.green} />
        <Chip x={740} y={250 + i * 170} w={720} label={a} col={C.green} s={36} />
        <Good x={1560} y={292 + i * 170} />
      </g>
    ))}
  </Frame>
);
const S13: React.FC<P> = ({ t }) => (
  <Frame title="تفاصيل تانية" n={13}>
    <Chip x={460} y={240} w={1000} label="max size: 1 MiB" col={C.grey} o={ap(t, 0.5)} s={42} />
    <Chip x={460} y={400} w={1000} label="volume: updates later" col={C.blue} o={ap(t, 3)} s={42} />
    <Chip x={460} y={560} w={1000} label="immutable: true" col={C.amber} o={ap(t, 6)} s={42} />
  </Frame>
);
const S14: React.FC<P> = ({ t }) => {
  const rows: [string, string][] = [["normal settings", "sensitive data"], ["data", "data + stringData"], ["plain text", "base64"], ["1 MiB", "1 MiB"]];
  return (
    <Frame title="الفرق" n={14}>
      <Chip x={160} y={190} w={760} label="ConfigMap" col={C.blue} o={ap(t, 0.3)} />
      <Chip x={1000} y={190} w={760} label="Secret" col={C.red} o={ap(t, 0.3)} />
      {rows.map(([a, b], i) => (
        <g key={a} opacity={ap(t, 1.5 + i * 2)}>
          <Box x={160} y={330 + i * 150} w={760} h={110} col={C.blue} fill="#fff"><T x={540} y={400 + i * 150} s={38} f={MONO}>{a}</T></Box>
          <Box x={1000} y={330 + i * 150} w={760} h={110} col={C.red} fill="#fff"><T x={1380} y={400 + i * 150} s={38} f={MONO}>{b}</T></Box>
        </g>
      ))}
    </Frame>
  );
};
const S15: React.FC<P> = ({ t }) => (
  <Frame title="الملفات بتضيع" n={15}>
    <Ct x={140} y={250} w={640} h={300} o={ap(t, 0.3)} />
    <File x={420} y={340} label="data.txt" o={t < 4 ? ap(t, 1) : 0} />
    <Bad x={460} y={400} o={ap(t, 4)} />
    <T x={460} y={600} s={34} c={C.red} o={ap(t, 4)}>restart</T>
    <Box x={900} y={200} w={880} h={560} col={C.blue} fill="#fff" dash o={ap(t, 6)}>
      <T x={1340} y={250} s={32} c={C.blue}>Pod</T>
    </Box>
    <Ct x={960} y={300} w={380} h={200} o={ap(t, 6)} />
    <Disk x={1500} y={400} w={200} h={170} col={C.blue} label="volume" o={ap(t, 7)} />
    <Arr x1={1350} y1={420} x2={1490} y2={470} o={ap(t, 8)} />
    <Good x={1600} y={640} o={ap(t, 9)} />
  </Frame>
);
const S16: React.FC<P> = ({ t }) => (
  <Frame title="مشاركة مؤقتة" n={16}>
    <Box x={160} y={200} w={1200} h={560} col={C.blue} fill="#fff" dash o={ap(t, 0.3)}><T x={760} y={250} s={32} c={C.blue}>Pod</T></Box>
    <Ct x={220} y={300} w={400} h={200} label="app" o={ap(t, 1)} />
    <Ct x={900} y={300} w={400} h={200} label="sidecar" o={ap(t, 1.5)} col={C.amber} />
    <Disk x={620} y={560} w={240} h={160} col={C.blue} label="emptyDir" o={ap(t, 3)} />
    <Arr x1={420} y1={510} x2={640} y2={600} o={ap(t, 4)} />
    <Arr x1={1100} y1={510} x2={860} y2={600} o={ap(t, 4.5)} />
    <Bad x={1560} y={480} o={ap(t, 8)} />
    <T x={1560} y={560} s={36} c={C.red} o={ap(t, 8)}>Pod deleted</T>
    <T x={1560} y={620} s={36} c={C.red} o={ap(t, 9)}>folder gone</T>
  </Frame>
);
const S17: React.FC<P> = ({ t }) => (
  <Frame title="وحدة التخزين" n={17}>
    <Box x={140} y={200} w={1640} h={640} col={C.grey} fill="#fff" dash o={ap(t, 0.3)}><T x={960} y={250} s={34} c={C.grey}>cluster</T></Box>
    {[0, 1, 2].map((i) => (
      <Disk key={i} x={300 + i * 480} y={380} w={300} h={220} col={C.blue} label="PV" o={ap(t, 1.5 + i * 1)} />
    ))}
    <Chip x={560} y={700} w={800} label="independent of any Pod" col={C.green} o={ap(t, 6)} s={38} />
  </Frame>
);
const S18: React.FC<P> = ({ t }) => (
  <Frame title="الطلب" n={18}>
    <Box x={120} y={380} w={400} h={200} col={C.blue} fill="#fff" dash o={ap(t, 0.3)}><T x={320} y={495} s={52} c={C.blue}>Pod</T></Box>
    <Arr x1={540} y1={480} x2={700} y2={480} o={ap(t, 1.5)} />
    <Box x={720} y={300} w={520} h={360} col={C.amber} fill="#fff" o={ap(t, 1.5)}>
      <T x={980} y={370} s={50} c={C.amber}>PVC</T>
      <Kv x={800} y={450} lines={["storage: 10Gi", "ReadWriteOnce"]} o={ap(t, 3)} />
    </Box>
    <Arr x1={1260} y1={480} x2={1420} y2={480} o={ap(t, 5)} />
    <Disk x={1440} y={380} w={300} h={220} col={C.blue} label="PV" o={ap(t, 5)} />
  </Frame>
);
const S19: React.FC<P> = ({ t }) => (
  <Frame title="الربط" n={19}>
    <Spinner x={960} y={300} t={t} col={C.blue} r={44} />
    <T x={960} y={420} s={34} c={C.grey} o={ap(t, 0.5)}>control loop</T>
    <Chip x={420} y={500} w={360} label="PVC" col={C.amber} o={ap(t, 1.5)} />
    <Arr x1={800} y1={542} x2={1000} y2={542} o={ap(t, 3)} />
    <Chip x={1020} y={500} w={360} label="PV" col={C.blue} o={ap(t, 3)} />
    <Box x={420} y={680} w={400} h={130} col={C.red} fill="#fff" dash o={ap(t, 6)}><T x={620} y={760} s={40} c={C.red}>Pod deleted</T></Box>
    <Bad x={880} y={745} o={ap(t, 6.5)} />
    <ARt x={1300} y={760} s={46} c={C.green} o={ap(t, 8)}>الداتا فاضلة</ARt>
  </Frame>
);
const S20: React.FC<P> = ({ t }) => (
  <Frame title="التخزين التلقائي" n={20}>
    <Chip x={120} y={460} w={300} label="PVC" col={C.amber} o={ap(t, 0.5)} />
    <Arr x1={440} y1={502} x2={620} y2={502} o={ap(t, 2)} />
    <Box x={640} y={380} w={540} h={250} col={C.green} fill="#fff" o={ap(t, 2)}>
      <T x={910} y={470} s={44} c={C.green}>StorageClass</T>
      <T x={910} y={540} s={32} c={C.grey} f={MONO}>fast-ssd</T>
    </Box>
    <Arr x1={1200} y1={502} x2={1380} y2={502} o={ap(t, 4.5)} />
    <Disk x={1400} y={400} w={300} h={220} col={C.blue} label="PV" o={ap(t, 5)} />
    <T x={960} y={820} s={42} c={C.blue} o={ap(t, 7)}>dynamic provisioning</T>
  </Frame>
);
const S21: React.FC<P> = ({ t }) => {
  const m: [string, string, string][] = [["ReadWriteOnce", "1 node", C.blue], ["ReadWriteOncePod", "1 Pod", C.green], ["ReadOnlyMany", "many nodes, read", C.amber], ["ReadWriteMany", "many nodes, write", C.red]];
  return (
    <Frame title="أنواع الوصول" n={21}>
      {m.map(([a, b, c], i) => (
        <g key={a} opacity={ap(t, 0.8 + i * 2.4)}>
          <Chip x={140} y={220 + i * 190} w={720} label={a} col={c} s={36} />
          <Arr x1={890} y1={262 + i * 190} x2={1010} y2={262 + i * 190} />
          <T x={1040} y={276 + i * 190} s={40} a="start" c={C.ink}>{b}</T>
        </g>
      ))}
    </Frame>
  );
};
const S22: React.FC<P> = ({ t }) => (
  <Frame title="بعد المسح" n={22}>
    <Chip x={560} y={190} w={800} label="PVC deleted" col={C.red} o={ap(t, 0.3)} />
    <Arr x1={760} y1={290} x2={500} y2={400} o={ap(t, 2)} />
    <Arr x1={1160} y1={290} x2={1420} y2={400} o={ap(t, 2)} />
    <Box x={160} y={420} w={680} h={400} col={C.green} fill="#fff" o={ap(t, 2.5)}>
      <T x={500} y={500} s={46} c={C.green}>Retain</T>
      <Disk x={400} y={560} w={200} h={160} col={C.green} label="data" o={ap(t, 3.5)} />
    </Box>
    <Box x={1080} y={420} w={680} h={400} col={C.red} fill="#fff" o={ap(t, 4.5)}>
      <T x={1420} y={500} s={46} c={C.red}>Delete</T>
      <Disk x={1320} y={560} w={200} h={160} col={C.red} o={ap(t, 5.5) * (t < 8 ? 1 : 0.2)} />
      <Bad x={1420} y={650} o={ap(t, 8)} />
    </Box>
    <T x={1420} y={880} s={34} c={C.grey} o={ap(t, 9)}>default for dynamic: Delete</T>
  </Frame>
);
const S23: React.FC<P> = ({ t }) => (
  <Frame title="سؤال 1" n={23}>
    <Box x={160} y={200} w={720} h={150} col={C.red} fill="#FBEAEA" o={ap(t, 0.3)}><T x={520} y={290} s={36} c={C.red}>old value after edit</T></Box>
    <Arr x1={520} y1={360} x2={520} y2={440} o={ap(t, 2)} />
    <Box x={160} y={450} w={720} h={150} col={C.amber} fill="#fff" o={ap(t, 3)}><T x={520} y={540} s={38} c={C.amber}>value comes from env</T></Box>
    <Arr x1={520} y1={610} x2={520} y2={690} o={ap(t, 5)} />
    <Code x={100} y={700} w={820} lines={["kubectl rollout restart deploy/web"]} s={28} o={ap(t, 6)} />
    <Chip x={1060} y={450} w={700} label="env: no auto update" col={C.red} o={ap(t, 4)} s={36} />
    <Chip x={1060} y={600} w={700} label="volume: updates later" col={C.green} o={ap(t, 5)} s={36} />
  </Frame>
);
const S24: React.FC<P> = ({ t }) => (
  <Frame title="سؤال 2" n={24}>
    <T x={960} y={250} s={56} c={C.ink} o={ap(t, 0.3)}>base64 = secure?</T>
    <Bad x={960} y={380} o={ap(t, 2)} />
    <ARt x={960} y={500} s={48} o={ap(t, 2.5)}>لأ، ترميز مش تشفير</ARt>
    {["encryption at rest", "RBAC", "external secrets manager"].map((a, i) => (
      <Chip key={a} x={560} y={600 + i * 120} w={800} label={a} col={C.green} o={ap(t, 5 + i * 1.5)} s={36} />
    ))}
  </Frame>
);
const S25: React.FC<P> = ({ t }) => (
  <Frame title="سؤال 3" n={25}>
    <Box x={160} y={200} w={720} h={150} col={C.red} fill="#FBEAEA" o={ap(t, 0.3)}><T x={520} y={290} s={36} c={C.red}>Pod deleted, data lost</T></Box>
    <Arr x1={900} y1={275} x2={1040} y2={275} o={ap(t, 2)} />
    <Chip x={1060} y={236} w={700} label="PVC, not emptyDir" col={C.green} o={ap(t, 2.5)} s={38} />
    <Chip x={460} y={460} w={1000} label="check reclaim policy" col={C.blue} o={ap(t, 5)} s={40} />
    <Chip x={460} y={600} w={1000} label="check access mode" col={C.blue} o={ap(t, 7)} s={40} />
    <ARt x={960} y={860} s={52} o={ap(t, 10)}>نكمل في الحلقة الجاية</ARt>
  </Frame>
);

const SCENES: React.FC<P>[] = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25];

export type Lesson4Props = { starts: number[]; total: number; ep?: string };
export const Lesson4: React.FC<Lesson4Props> = ({ starts, total, ep }) => {
  const { fps } = useVideoConfig();
  const [h] = React.useState(() => delayRender("fonts"));
  React.useEffect(() => { loadFonts().then(() => continueRender(h)).catch(() => continueRender(h)); }, [h]);
  return (
    <LessonCtx.Provider value={{ ep: ep || "Episode 3", total: 25 }}>
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
