/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // /check is parked for now (too many streams) — send old links home.
    return [{ source: "/check", destination: "/", permanent: false }];
  },
};

export default nextConfig;
