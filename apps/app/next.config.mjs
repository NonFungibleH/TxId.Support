/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["recharts", "react-smooth"],
  async headers() {
    return [
      {
        // The embed loader is loaded by third-party sites via <script src>.
        // Never let it cache long-term, or customers keep running an old copy
        // (e.g. missing the close-button message listener) after we ship fixes.
        source: "/widget.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
