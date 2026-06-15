/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactStrictMode: false,
  experimental: {
    serverActions: {
      // Next.js 15 default is 1MB; AOP/TLP Excel uploads need larger payloads
      bodySizeLimit: '20mb',
    },
  },
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};
 
module.exports = nextConfig; 