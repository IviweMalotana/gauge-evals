/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep the heavy browser driver out of the bundler; load it at runtime.
    serverComponentsExternalPackages: ["playwright-core"],
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;
