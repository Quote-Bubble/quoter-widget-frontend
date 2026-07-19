import type { Metadata } from "next";

import { EmbedFrame } from "@/components/embed/EmbedFrame";

export const metadata: Metadata = {
  title: "Quoter",
  // The embed is meant to be framed, never indexed on its own.
  robots: { index: false, follow: false },
};

/**
 * Chromeless embed target. Renders only the quote bubble on a transparent
 * background. Host pages iframe this and resize it via the postMessage
 * protocol in EmbedFrame. The `roofer` query param attributes leads; it
 * defaults to the landing-page demo instance.
 */
export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ roofer?: string }>;
}) {
  const { roofer } = await searchParams;
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 0,
        background: "transparent",
      }}
    >
      <EmbedFrame rooferId={roofer ?? "quoter-landing-demo"} />
    </div>
  );
}
