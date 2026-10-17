import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No "N" badge in the corner during `npm run dev` (it never shows in production anyway).
  devIndicators: false,
};

export default nextConfig;
