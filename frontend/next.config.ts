import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export',
  // basePath is only needed for GitHub Pages deployment
  // Uncomment the lines below when deploying to GitHub Pages:
  // output: 'export',
  // basePath: '/NeuroVault',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
