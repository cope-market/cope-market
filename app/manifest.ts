import type {MetadataRoute} from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cope Market",
    short_name: "Cope",
    description:
      "Social trading of real-world events. Post a thesis, back it, copy one you believe.",
    start_url: "/feed",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08090b",
    theme_color: "#08090b",
    categories: ["finance", "social"],
    icons: [
      {src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any"},
      {src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any"},
      {src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable"},
    ],
  };
}
