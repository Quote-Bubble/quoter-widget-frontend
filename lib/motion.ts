import type { Transition } from "motion/react";

/**
 * The widget has exactly two on-screen sizes. Both are fixed: the collapsed
 * search bar, and the expanded panel. The panel never resizes to fit its
 * content — taller steps scroll inside it — so the embedding iframe only ever
 * animates between these two heights. This is what keeps the host page's
 * layout perfectly still (see the overlay model in the landing LiveWidget).
 */
export const QUOTE_SIZES = {
  /** Collapsed search bar — border-box height of the whole .q card,
   *  including the small "Powered by Quoter" caption beneath the bar. */
  collapsed: 118,
  /** Expanded panel — fixed; the step body scrolls internally past this. */
  expanded: 544,
} as const;

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_SOFT = [0.22, 1, 0.36, 1] as const;

export const MOTION_DURATION = {
  fast: 0.14,
  base: 0.2,
  shell: 0.32,
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

export const ADVANCE_DELAY_MS = 110;
