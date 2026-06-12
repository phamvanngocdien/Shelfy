/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.testnet.shelby.xyz',
        pathname: '/shelby/v1/blobs/**',
      },
    ],
    // Images are served from external Shelby gateway — disable Next.js image
    // optimization to avoid proxy issues and unnecessary re-encoding.
    unoptimized: true,
  },
};

export default nextConfig;