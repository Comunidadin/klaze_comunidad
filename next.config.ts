import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Portadas de curso (mocks) sirven desde Unsplash — ver src/lib/mocks/courses.ts.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
