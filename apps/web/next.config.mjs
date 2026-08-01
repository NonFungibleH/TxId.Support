/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // The Platform page was renamed to /api. Keep old links + search results working.
      { source: "/platform", destination: "/api", permanent: true },
      // /capabilities was renamed to /features shortly after launch.
      { source: "/capabilities", destination: "/features", permanent: true },
    ];
  },
};

export default nextConfig;
