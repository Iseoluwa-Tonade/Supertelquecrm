import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "otpzsnsrxcfuysjfnguk.supabase.co" },
    ],
  },
};

export default nextConfig;
