import type { Timeline } from "./types";

// Used only when the Studio opens without --props. Real timelines are built by scripts/make.mjs.
export const defaultTimeline: Timeline = {
  slug: "preview",
  title: "Preview",
  lang: "en",
  dir: "ltr",
  fps: 30,
  width: 1080,
  height: 1920,
  durationSec: 6,
  audio: null,
  presenter: { type: "builtin", name: "default" },
  captions: { mode: "headline", lead: 0.15 },
  tail: 0.6,
  events: [],
  scenes: [
    {
      id: "01",
      index: 0,
      label: "preview",
      start: 0,
      end: 6,
      counter: { key: "FOLLOWERS", from: 2283, to: 39522 },
      say: "You type *one line* and the system builds the *whole reel.*",
      words: [
        { w: "You", start: 0.2, end: 0.4 },
        { w: "type", start: 0.4, end: 0.7 },
        { w: "one", start: 0.75, end: 0.95, emph: true },
        { w: "line", start: 0.95, end: 1.3, emph: true },
        { w: "and", start: 1.5, end: 1.65 },
        { w: "the", start: 1.65, end: 1.75 },
        { w: "system", start: 1.75, end: 2.2 },
        { w: "builds", start: 2.3, end: 2.7 },
        { w: "the", start: 2.7, end: 2.8 },
        { w: "whole", start: 2.9, end: 3.3, emph: true },
        { w: "reel.", start: 3.3, end: 3.8, emph: true },
      ],
      visual: {
        type: "checklist",
        props: {
          title: "patterns.md",
          sub: "// guides/",
          items: [
            { text: "Hook in ≤ 1.5 s", sub: "stop the thumb at frame 0" },
            { text: "Event on every stressed word", sub: "something lands every 0.4–0.8 s" },
            { text: "Nothing still > 1.2 s", sub: "every element keeps an idle life" },
          ],
        },
      },
      events: [
        { t: 0.75, kind: "zoomKick" },
        { t: 2.9, kind: "zoomKick" },
      ],
    },
  ],
};
