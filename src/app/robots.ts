import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api", "/auth", "/login", "/register", "/onboarding"],
    },
    sitemap: `${env.APP_URL}/sitemap.xml`,
  };
}
