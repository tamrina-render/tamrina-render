import React from "react";
import { Composition } from "remotion";
import { defaultTimeline } from "./lib/defaultTimeline";
import type { Timeline } from "./lib/types";
import { Reel } from "./Reel";
import { CoinOnly } from "./CoinOnly";
import { ThumbOnly } from "./ThumbOnly";
import { ThumbReel } from "./ThumbReel";
import { Fact3D } from "./scenes/Fact3D";
import { FactTitanic } from "./scenes/FactTitanic";
import { FactMob } from "./scenes/FactMob";
import { FactIba } from "./scenes/FactIba";
import { FactZander } from "./scenes/FactZander";
import { FactPilates } from "./scenes/FactPilates";
import { FactWaffarha } from "./scenes/FactWaffarha";
import { FactTunnel } from "./scenes/FactTunnel";
import { FactBet } from "./scenes/FactBet";
import { FactAlone } from "./scenes/FactAlone";
import { FactAloneNight } from "./scenes/FactAloneNight";
import { FactBus } from "./scenes/FactBus";
import { FactCoach } from "./scenes/FactCoach";
import { FactTreadmill } from "./scenes/FactTreadmill";
import { FactKanakuri } from "./scenes/FactKanakuri";
import { FactBrownlee } from "./scenes/FactBrownlee";
import { FactTendon } from "./scenes/FactTendon";
import { CameraBench } from "./scenes/CameraBench";

const fit = async ({ props }: { props: Record<string, unknown> }) => {
  const p = props as unknown as Timeline;
  return {
    fps: p.fps || 30,
    width: p.width || 1080,
    height: p.height || 1920,
    durationInFrames: Math.max(30, Math.ceil((p.durationSec || 6) * (p.fps || 30))),
    props,
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition id="ThumbReel" component={ThumbReel as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={324} defaultProps={{ pool: "mr" }} />
    <Composition id="Fact3D" component={Fact3D as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={840} defaultProps={{ starts: [0, 2.16, 3.72, 7.61, 8.8, 10.46, 12.73, 14.39, 16.63, 18.72, 21.81, 23.06, 24.77], durationSec: 28, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.round(((props.durationSec as number) || 28) * 30) })} />
    <Composition id="FactTitanic" component={FactTitanic as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={971} defaultProps={{ starts: [0, 1.96, 4.2, 5.46, 6.87, 9.06, 14.47, 17.05, 18.8, 22.64, 25.94, 28.57], words: { horse: 14.85, rower: 15.46, bike: 16.22, tilt: 20.56 }, durationSec: 32.36, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.round(((props.durationSec as number) || 32.36) * 30) })} />
    <Composition id="FactMob" component={FactMob as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={1095} defaultProps={{ starts: [0, 2.6, 5.2, 7.4, 9.8, 11.6, 14.0, 17.6, 20.4, 24.2, 26.6, 29.4, 32.4], words: { not: 1.7, five: 6.6, rule: 19.2, year: 22.9 }, durationSec: 36.5, postImgs: [1, 2, 3, 4, 5].map((i) => `footage/mob-football/app/post-${i}.png`), debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.round(((props.durationSec as number) || 36.5) * 30) })} />
    <Composition id="FactIba" component={FactIba as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={840} defaultProps={{ starts: [0, 2.2, 4.4, 6.0, 7.6, 9.6, 11.2, 13.0, 15.6, 18.0, 19.6, 20.6, 21.8, 23.4, 24.6, 25.4], words: { clack: 18.9 }, durationSec: 28.0, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.round(((props.durationSec as number) || 28) * 30) })} />
    <Composition id="FactZander" component={FactZander as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={1002} defaultProps={{ starts: [0, 2.27, 3.72, 5.94, 8.3, 9.22, 11.45, 12.6, 18.52, 21.39, 23.45, 25.18, 26.43], words: { suits: 4.7, dresses: 5.04, opened: 7.54, n27: 9.45, man: 14.0, lady: 16.26, look: 19.4, same: 28.07, sent: 29.92, accepted: 30.84, go: 31.68 }, durationSec: 33.414, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.round(((props.durationSec as number) || 33.414) * 30) })} />
    <Composition id="FactPilates" component={FactPilates as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={1213} defaultProps={{ starts: [0, 4.419, 11.15, 17.214, 22.116, 25.185, 29.543, 31.857, 35.561], words: { pilates: 0.47, reel: 1.49, story: 2.25, bed: 3.2, hosp: 3.56, n110: 4.75, years: 5.44, man: 6.16, joseph: 7.33, jailed: 8.35, camp: 8.93, island: 9.8, england: 10.31, untie: 12.57, springs: 12.94, beds: 13.33, tie: 14.21, patients: 15.12, train: 15.63, lying: 16.5, out: 17.8, thebed: 18.38, reformer: 19.41, bysprings: 20.49, moves: 21.07, found: 23.64, train5: 24.37, me: 25.18, but: 27.4, nobody: 28.31, wait: 29.54, here: 31.86, girl: 32.51, same: 34.55, sent: 35.56, accepted: 36.65, go: 37.52, us: 37.82 }, durationSec: 40.446, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.round(((props.durationSec as number) || 40.446) * 30) })} />
    <Composition id="FactWaffarha" component={FactWaffarha as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={1041} defaultProps={{ starts: [0, 6.57, 12.0, 20.85, 27.24], durationSec: 34.686, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.round(((props.durationSec as number) || 34.686) * 30) })} />
    <Composition id="FactTunnel" component={FactTunnel as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={1399} defaultProps={{ starts: [0, 7.41, 17.29, 20.96, 30.13, 38.23], durationSec: 46.611, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.ceil(((props.durationSec as number) || 46.611) * 30 - 1e-6) })} />
    <Composition id="FactBet" component={FactBet as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={1073} defaultProps={{ durationSec: 35.067, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.ceil(((props.durationSec as number) || 35.067) * 30 - 1e-6) })} />
    <Composition id="FactAlone" component={FactAlone as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={2026} defaultProps={{ durationSec: 67.508, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.ceil(((props.durationSec as number) || 67.508) * 30 - 1e-6) })} />
    <Composition id="FactAloneNight" component={FactAloneNight as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={2026} defaultProps={{ durationSec: 67.508, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.ceil(((props.durationSec as number) || 67.508) * 30 - 1e-6) })} />
    <Composition id="FactBus" component={FactBus as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={1190} defaultProps={{ durationSec: 39.841, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.ceil(((props.durationSec as number) || 39.841) * 30 - 1e-6) })} />
    <Composition id="FactCoach" component={FactCoach as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={1620} defaultProps={{ durationSec: 54, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.ceil(((props.durationSec as number) || 54) * 30 - 1e-6) })} />
    <Composition id="FactTreadmill" component={FactTreadmill as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={870} defaultProps={{ durationSec: 29, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.ceil(((props.durationSec as number) || 29) * 30 - 1e-6) })} />
    <Composition id="FactKanakuri" component={FactKanakuri as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={807} defaultProps={{ starts: [0, 3.9, 7.0, 13.01, 16.55], durationSec: 36, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.ceil(((props.durationSec as number) || 36) * 30 - 1e-6) })} />
        <Composition id="FactBrownlee" component={FactBrownlee as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={807} defaultProps={{ starts: [0, 3.781, 9.885, 14.68, 20.956], durationSec: 27.9, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.ceil(((props.durationSec as number) || 27.9) * 30 - 1e-6) })} />
        <Composition id="FactTendon" component={FactTendon as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={807} defaultProps={{ starts: [0, 4.557, 12.006, 18.287, 25.4], durationSec: 32, debug: false }} calculateMetadata={async ({ props }) => ({ durationInFrames: Math.ceil(((props.durationSec as number) || 29.1) * 30 - 1e-6) })} />
    <Composition id="CameraBench" component={CameraBench as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={450} />
    <Composition id="ThumbOnly"component={ThumbOnly as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={103} defaultProps={{ kind: "man" }} />
    <Composition id="CoinOnly"component={CoinOnly as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={180}
      defaultProps={defaultTimeline as unknown as Record<string, unknown>} calculateMetadata={fit} />
    <Composition
      id="Reel"
      component={Reel}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={180}
      defaultProps={defaultTimeline}
      calculateMetadata={async ({ props }) => {
        const p = props as Timeline;
        return {
          fps: p.fps || 30,
          width: p.width || 1080,
          height: p.height || 1920,
          durationInFrames: Math.max(30, Math.ceil((p.durationSec || 6) * (p.fps || 30))),
          props,
        };
      }}
    />
    </>
  );
};
