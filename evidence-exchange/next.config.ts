import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads are streamed to disk by the storage adapter; raise the action
    // body limit so scanned PDFs and photo-of-a-form uploads go through.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
