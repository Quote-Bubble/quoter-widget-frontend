import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoofMeasurementLab } from "@/components/dev/RoofMeasurementLab";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roof Measurement Workbench",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DeveloperWorkbenchPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_DEV_LAB !== "true"
  ) {
    notFound();
  }

  return <RoofMeasurementLab />;
}
