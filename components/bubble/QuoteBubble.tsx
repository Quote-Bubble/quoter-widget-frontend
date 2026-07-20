"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { APIProvider } from "@vis.gl/react-google-maps";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

import { AddressAutocomplete } from "@/components/quote/AddressAutocomplete";
import { QuoteFlowInner } from "@/components/quote/QuoteFlow";
import {
  MOTION_DURATION,
  SHELL_TRANSITION,
  STEP_TRANSITION,
} from "@/lib/motion";

type QuoteBubbleProps = {
  rooferId?: string;
  brandName?: string;
};

type OpenFlow = {
  key: number;
  line: string;
  postcode: string;
  formatted: string | null;
};

function useIsDesktop(breakpoint = 640) {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return desktop;
}

function QuoteBubbleShell({
  rooferId = "demo-roofer",
  brandName = "Quoter",
  mapsEnabled,
}: QuoteBubbleProps & { mapsEnabled: boolean }) {
  const [line, setLine] = useState("");
  const [flow, setFlow] = useState<OpenFlow | null>(null);
  const [flowReady, setFlowReady] = useState(false);
  const [flowKey, setFlowKey] = useState(0);
  const [suggesting, setSuggesting] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number | "auto">("auto");
  // Same technique as collapsedHeight below, applied to the open flow: a
  // real measured number (not the string "auto") so Framer Motion has an
  // unambiguous target to animate between on every step change - relying
  // on "auto" alone didn't reliably re-trigger a smooth transition once
  // already expanded, it would just snap to the new size.
  const [flowHeight, setFlowHeight] = useState<number | "auto">("auto");
  const searchRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  const expanded = Boolean(flow && isDesktop);

  useEffect(() => {
    const node = searchRef.current;
    if (!node || expanded) return;
    // The card's height is border-box: add the collapsed-stage chrome
    // (18px padding + 1px border, top and bottom) around the search panel.
    const COLLAPSED_FRAME_PX = 38;
    const measure = () => setCollapsedHeight(node.offsetHeight + COLLAPSED_FRAME_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [expanded, suggesting]);

  useEffect(() => {
    const node = flowRef.current;
    if (!node || !expanded) return;
    const measure = () => setFlowHeight(node.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [expanded, flowReady]);

  useEffect(() => {
    if (!expanded) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("quoter-widget")?.scrollIntoView({
        block: "nearest",
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const timer = window.setTimeout(
      () => setFlowReady(true),
      Math.round(MOTION_DURATION.shell * 1000),
    );
    return () => window.clearTimeout(timer);
  }, [expanded, flow?.key]);

  function openFlow(nextLine: string, postcode: string, formatted: string | null) {
    const key = flowKey + 1;
    setFlowKey(key);
    setSuggesting(false);
    setFlow({ key, line: nextLine, postcode, formatted });
  }

  function closeFlow() {
    setFlowReady(false);
    setFlow(null);
    setFlowHeight("auto");
  }

  const flowContent = flow ? (
    <QuoteFlowInner
      key={flow.key}
      rooferId={rooferId}
      brandName={brandName}
      mapsEnabled={mapsEnabled}
      variant={isDesktop ? "card" : "page"}
      initialAddress={{
        line: flow.line,
        postcode: flow.postcode,
        formatted: flow.formatted,
      }}
      onClose={closeFlow}
    />
  ) : null;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="q"
        id="quoter-widget"
        data-stage={expanded ? "flow" : "input"}
        data-suggesting={suggesting && !flow ? "true" : "false"}
        initial={false}
        animate={{
          /* A real measured number (not just "auto") is what actually
             fixed "the flow has menus of different sizes" clipping, and
             what makes the resize between steps animate smoothly instead
             of snapping - see flowHeight/collapsedHeight above. */
          height: expanded ? flowHeight : collapsedHeight,
        }}
        transition={SHELL_TRANSITION}
      >
        <AnimatePresence mode="sync" initial={false}>
          {expanded ? (
            <motion.div
              key={`flow-${flow!.key}`}
              className="q-flow-frame h-full overflow-hidden"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={STEP_TRANSITION}
            >
              {flowReady ? <div ref={flowRef}>{flowContent}</div> : null}
            </motion.div>
          ) : (
            <motion.div
              key="search"
              ref={searchRef}
              className="q-panel"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={STEP_TRANSITION}
            >
              <div className="q-search relative">
                <svg
                  className="q-search-icon"
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
                    stroke="#6b7280"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="10"
                    r="2.5"
                    stroke="#6b7280"
                    strokeWidth="2"
                  />
                </svg>
                <div className="relative min-w-0 flex-1">
                  <AddressAutocomplete
                    value={line}
                    onChange={setLine}
                    onOpenChange={setSuggesting}
                    onSelect={(formatted, postcode) =>
                      openFlow(formatted, postcode, formatted)
                    }
                    onSubmitText={(text) => {
                      if (text.trim().length > 3) openFlow(text, "", null);
                    }}
                    variant="bare"
                    placeholder="Enter your address"
                  />
                </div>
                <button
                  type="button"
                  className="q-go"
                  disabled={line.trim().length <= 3}
                  onClick={() => {
                    if (line.trim().length > 3) openFlow(line, "", null);
                  }}
                >
                  Get quote
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {!isDesktop && typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {flow ? (
                <motion.div
                  key={flow.key}
                  className="quote-surface fixed inset-0 z-[2147483000] overflow-hidden overscroll-none"
                  style={{
                    background: "rgba(255,255,255,0.55)",
                    backdropFilter: "blur(30px) saturate(1.8)",
                    WebkitBackdropFilter: "blur(30px) saturate(1.8)",
                  }}
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.985 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  {flowContent}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </MotionConfig>
  );
}

export function QuoteBubble(props: QuoteBubbleProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  if (!apiKey) return <QuoteBubbleShell {...props} mapsEnabled={false} />;
  return (
    <APIProvider
      apiKey={apiKey}
      libraries={["places"]}
      region="GB"
      language="en-GB"
      solutionChannel="quoter-bubble"
    >
      <QuoteBubbleShell {...props} mapsEnabled />
    </APIProvider>
  );
}
