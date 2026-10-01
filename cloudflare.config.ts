/**
 * Cloudflare Worker that serves the site (built by vinext; deployed by
 * `npm run deploy`, which Cloudflare runs on every push to `main`).
 *
 * Everything here is committed, so ONLY non-secret values belong in this
 * file. The Supabase URL and publishable key are browser-safe by design
 * (Row Level Security protects the data). Never put SUPABASE_SECRET_KEY or
 * R2 keys here — the site doesn't need them.
 */
import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "wedding-website",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-01",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    // Attached on every deploy; Cloudflare creates the DNS records.
    domains: ["kevinandsarina.com", "www.kevinandsarina.com"],
    env: {
      ASSETS: bindings.assets(),
      // Canonical origin for invitation links and QR codes. Never change
      // this after invitations are printed.
      APP_BASE_URL: bindings.text("https://kevinandsarina.com"),
      // Supabase Dashboard → Project Settings → Data API → Project URL
      NEXT_PUBLIC_SUPABASE_URL: bindings.text("https://mwkyrynliaaavtsbnvrg.supabase.co"),
      // Supabase Dashboard → Project Settings → API Keys → Publishable key
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: bindings.text("sb_publishable_KoqOGWi6k3bk1c4gKerLVA_QqqRzcWz"),
    },
  }),
});
