import React from "react";
import { BigNum } from "./BigNum";
import { Calendar } from "./Calendar";
import { Cards } from "./Cards";
import { Chart } from "./Chart";
import { Checklist } from "./Checklist";
import { Counter } from "./Counter";
import { Gauge } from "./Gauge";
import { ImageCard } from "./ImageCard";
import { Layers } from "./Layers";
import { Phone } from "./Phone";
import { Pipeline } from "./Pipeline";
import { Stamp } from "./Stamp";
import { Terminal } from "./Terminal";
import { Thumb } from "./Thumb";
import { Chat, Checkin, Gym, MapV, Stores, Swipe, Verify, Wallet } from "./tamrina";
import { Intertitle } from "../Looks";
import type { VisualProps } from "./common";

/**
 * Visual registry. The `visual.type` string in script.json / timeline.json picks one of these.
 * Add a new visual: create the component, register it here, document its props in guides/visuals.md.
 */
export const VISUALS: Record<string, React.FC<VisualProps>> = {
  phone: Phone,
  chart: Chart,
  counter: Counter,
  cards: Cards,
  checklist: Checklist,
  terminal: Terminal,
  prompt: Terminal,
  stamp: Stamp,
  calendar: Calendar,
  pipeline: Pipeline,
  bignum: BigNum,
  gauge: Gauge,
  layers: Layers,
  image: ImageCard,
  // Tamrina (brand "tamrina")
  swipe: Swipe,
  map: MapV,
  chat: Chat,
  gym: Gym,
  wallet: Wallet,
  verify: Verify,
  checkin: Checkin,
  stores: Stores,
  thumb: Thumb,
  // looks (silent film)
  intertitle: Intertitle,
};

export const VISUAL_TYPES = Object.keys(VISUALS);
