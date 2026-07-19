import type { Transition } from "motion/react";

export const QUOTE_SHELL = {
  width: 620,
  height: 360,
  headerHeight: 48,
  footerHeight: 36,
  mapHeight: 190,
} as const;

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_SOFT = [0.22, 1, 0.36, 1] as const;

export const MOTION_DURATION = {
  fast: 0.16,
  base: 0.24,
  shell: 0.38,
} as const;

export const SHELL_TRANSITION: Transition = {
  duration: MOTION_DURATION.shell,
  ease: EASE_SOFT,
};

export const STEP_TRANSITION: Transition = {
  duration: MOTION_DURATION.base,
  ease: EASE_OUT,
};

export const PROGRESS_TRANSITION: Transition = {
  duration: MOTION_DURATION.base,
  ease: EASE_SOFT,
};

export const ADVANCE_DELAY_MS = 160;
