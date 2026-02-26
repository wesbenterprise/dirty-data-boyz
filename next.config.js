/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['xlsx'],
    serverActionsBodySizeLimit: '25mb',
  },
};

module.exports = nextConfig;
