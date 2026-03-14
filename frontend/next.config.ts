import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // Use the repository name as the base path for GitHub Pages
  basePath: '/NeuroVault',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
