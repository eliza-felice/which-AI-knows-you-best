"use client";
import dynamic from "next/dynamic";

// Uses this tab's saved result (sessionStorage) when there is one, so it renders in the browser only.
const WithoutMask = dynamic(() => import("@/components/app/WithoutMask"), {
  ssr: false,
  loading: () => <main className="flex-1 bg-cream" />,
});

export default function WithoutMaskPage() {
  return <WithoutMask />;
}
