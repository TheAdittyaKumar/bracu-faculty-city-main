// next.config.js

const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  output: "export",
  images: {
    unoptimized: true
  },
  basePath: isProd ? "/bracu-faculty-city-main" : "",
  assetPrefix: isProd ? "/bracu-faculty-city-main/" : ""
};

module.exports = nextConfig;