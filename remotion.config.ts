import { Config } from "@remotion/cli/config";
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(null); // auto = half the CPU cores
Config.setChromiumOpenGlRenderer("angle");
