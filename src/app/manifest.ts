import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Calorie Calculator",
    short_name: "Calories",
    description: "Photo of a meal in, estimated calories and macros out.",
    start_url: "/",
    display: "standalone",
    background_color: "#1b1a16",
    theme_color: "#1b1a16",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
