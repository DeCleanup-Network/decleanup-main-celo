/** @type {import('next').NextConfig} */
const nextConfig = {
  // Serve .well-known directory correctly
  async headers() {
    return [
      {
        source: "/.well-known/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Content-Type",
            value: "application/json",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

