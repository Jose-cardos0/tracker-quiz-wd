/** @type {import('next').NextConfig} */
const nextConfig = {
  // Quizzes are served from /public/quizzes/<slug>/ as static assets.
  // The /q/[slug] route serves uploaded quizzes from Supabase Storage.

  // On Windows the webpack persistent (on-disk) cache frequently corrupts
  // (.next/cache/*.pack.gz ENOENT + unhandledRejection). Use an in-memory
  // cache in dev to avoid it — fast HMR, no flaky disk writes.
  webpack: (config, { dev }) => {
    if (dev) config.cache = { type: "memory" };
    return config;
  },

  async headers() {
    return [
      {
        source: "/track.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, s-maxage=300" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        // Allow the collector to be called from quizzes hosted on other domains too.
        source: "/api/collect",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
