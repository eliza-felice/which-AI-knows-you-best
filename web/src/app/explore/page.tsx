"use client";
import dynamic from "next/dynamic";

// Uses this tab's saved result (sessionStorage), so it renders in the browser only.
const Explore = dynamic(() => import("@/views/explore/Explore"), {
  ssr: false,
  loading: () => <main className="flex-1 bg-paper" />,
});

export default function ExplorePage() {
  return <Explore />;
}
