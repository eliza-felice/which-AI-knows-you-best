"use client";
import dynamic from "next/dynamic";

// The app reads this tab's saved progress (sessionStorage), so it renders in
// the browser only.
const App = dynamic(() => import("@/components/app/App"), {
  ssr: false,
  loading: () => <main className="flex-1 bg-paper" />,
});

export default function Home() {
  return <App />;
}
