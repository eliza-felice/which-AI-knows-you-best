"use client";
import dynamic from "next/dynamic";

// Starts from this tab's saved result (sessionStorage), so it renders in the browser only.
const WhatIf = dynamic(() => import("@/components/app/WhatIf"), {
  ssr: false,
  loading: () => <main className="flex-1 bg-paper" />,
});

export default function WhatIfPage() {
  return <WhatIf />;
}
