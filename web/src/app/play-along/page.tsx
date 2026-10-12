"use client";
import dynamic from "next/dynamic";

// Uses this tab's saved result (sessionStorage), so it renders in the browser only.
const PlayAlong = dynamic(() => import("@/components/app/PlayAlong"), {
  ssr: false,
  loading: () => <main className="flex-1 bg-paper" />,
});

export default function PlayAlongPage() {
  return <PlayAlong />;
}
