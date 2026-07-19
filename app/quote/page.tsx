import type { Metadata } from "next";

import { QuoteFlow } from "@/components/quote/QuoteFlow";

export const metadata: Metadata = {
  title: "Get your roof quote — Quoter",
  description:
    "Answer a few questions, outline your roof on satellite imagery, and get an instant indicative price range.",
};

export default function QuotePage() {
  return <QuoteFlow />;
}
