/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // The Platform page was renamed to /api. Keep old links + search results working.
      { source: "/platform", destination: "/api", permanent: true },
    ];
  },
};

export default nextConfig;
