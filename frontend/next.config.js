/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      'topojson-client': 'topojson-client',
    },
  },
};

module.exports = nextConfig;