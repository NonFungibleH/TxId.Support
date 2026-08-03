/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // The Platform page was renamed to /api. Keep old links + search results working.
      { source: "/platform", destination: "/api", permanent: true },
      // /capabilities was renamed to /features shortly after launch.
      { source: "/capabilities", destination: "/features", permanent: true },
      // The three Solutions sub-pages were folded into one page with anchors.
      { source: "/solutions/protocols", destination: "/solutions#protocols", permanent: true },
      { source: "/solutions/issuers", destination: "/solutions#issuers", permanent: true },
      { source: "/solutions/institutions", destination: "/solutions#institutions", permanent: true },
    ];
  },
};

export default nextConfig;
