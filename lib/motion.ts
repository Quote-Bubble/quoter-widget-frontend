import type { Transition } from "motion/react";

/**
 * The widget has exactly two on-screen sizes. Both are fixed: the collapsed
 * search bar, and the expanded panel. The panel never resizes to fit its
 * content — taller steps scroll inside it — so the embedding iframe only ever
 * animates between these two heights. This is what keeps the host page's
 * layout perfectly still (see the overlay model in the landing LiveWidget).
 */
export const QUOTE_SIZES = {
  /** The glass card (.q) itself when collapsed — its natural search-bar
   *  height. The "powered by Quoter" caption sits OUTSIDE this, below the
   *  card, so the bubble never grows just to hold the credit. */
  collapsedBar: 90,
  /** Full collapsed iframe height = the card + the caption beneath it. This
   *  is what the embed sizes the iframe to. */
  collapsed: 112,
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
