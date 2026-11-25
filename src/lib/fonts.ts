// Fonts are bundled in public/fonts (no network needed at render time).
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Font roles. Components read FONT.<role>; a brand swaps the families (applyFontSet, called by Reel on every frame).
const SETS = {
  default: {
    head: "Manrope",            // headline sans (Latin)
    serif: "Instrument Serif",  // italic emphasis words
    mono: "JetBrains Mono",     // "// 01 · section" labels
    arabic: "Cairo",            // Arabic headlines + captions
    arabicAlt: "Noto Kufi Arabic",
    arabicEmph: "Cairo",        // emphasized Arabic words
    brand: "Changa",            // Tamrina brand display (coin presenter "+1" / "$")
  },
  // Volt × Varsity: Changa (display, uppercase) + IBM Plex Sans Arabic (body), same as the app
  tamrina: {
    head: "Changa",
    serif: "Changa",
    mono: "Changa",
    arabic: "IBM Plex Sans Arabic",
    arabicAlt: "Cairo",
    arabicEmph: "Changa",
    brand: "Changa",
  },
};

export const FONT = { ...SETS.default };
export const applyFontSet = (brand?: string | null) => Object.assign(FONT, SETS[brand === "tamrina" ? "tamrina" : "default"]);

let loaded: Promise<void> | null = null;
export const loadFonts = () => {
  if (loaded) return loaded;
  loaded = Promise.all([
    loadFont({ family: "Manrope", url: staticFile("fonts/Manrope.ttf"), weight: "200 800" }),
    loadFont({ family: "Instrument Serif", url: staticFile("fonts/InstrumentSerif-Italic.ttf"), style: "italic" }),
    loadFont({ family: "Instrument Serif", url: staticFile("fonts/InstrumentSerif-Regular.ttf"), style: "normal" }),
    loadFont({ family: "JetBrains Mono", url: staticFile("fonts/JetBrainsMono.ttf"), weight: "100 800" }),
    loadFont({ family: "Cairo", url: staticFile("fonts/Cairo.ttf"), weight: "200 1000" }),
    loadFont({ family: "Noto Kufi Arabic", url: staticFile("fonts/NotoKufiArabic.ttf"), weight: "100 900" }),
    loadFont({ family: "Changa", url: staticFile("fonts/Changa.ttf"), weight: "800" }),
    loadFont({ family: "Changa", url: staticFile("fonts/Changa_700Bold.ttf"), weight: "700" }),
    loadFont({ family: "IBM Plex Sans Arabic", url: staticFile("fonts/IBMPlexSansArabic_400Regular.ttf"), weight: "400" }),
    loadFont({ family: "IBM Plex Sans Arabic", url: staticFile("fonts/IBMPlexSansArabic_500Medium.ttf"), weight: "500" }),
    loadFont({ family: "IBM Plex Sans Arabic", url: staticFile("fonts/IBMPlexSansArabic_600SemiBold.ttf"), weight: "600" }),
    loadFont({ family: "IBM Plex Sans Arabic", url: staticFile("fonts/IBMPlexSansArabic_700Bold.ttf"), weight: "700" }),
  ]).then(() => undefined);
  return loaded;
};
