"use client";
import dynamic from "next/dynamic";

// Uses this tab's saved result (sessionStorage), so it renders in the browser only.
const Reliability = dynamic(() => import("@/views/explore/Reliability"), {
  ssr: false,
  loading: () => <main className="flex-1 bg-paper" />,
});

export default function ReliabilityPage() {
  return <Reliability />;
}
