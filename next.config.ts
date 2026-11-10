import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Stop leaking "Next.js" via the X-Powered-By response header — pure
    // info-disclosure hardening, doesn't change behavior.
    poweredByHeader: false,

    // Smaller client bundles: only the icons actually used get shipped.
    experimental: { optimizePackageImports: ["lucide-react"] },

    async headers() {
        return [
            {
                // Art is 1-bit and tiny; cache it for a week on the edge and browser, and let a stale copy serve while
                // it refreshes. Regenerated art keeps its name, so the window is short on purpose.
                source: "/naos/:path*",
                headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
            },
            {
                source: "/:path*",
                headers: [
                    // Vercel already sets a bare `Strict-Transport-Security:
                    // max-age=...` on every response. This overrides it with
                    // includeSubDomains + preload so the domain is eligible
                    // for hstspreload.org — the only real fix for the
                    // "connection isn't private" warning some visitors see
                    // on public/captive-portal Wi-Fi: once Chrome/Firefox
                    // ship nateanderson.dev in their built-in preload list,
                    // the browser refuses plain HTTP to this domain before
                    // ever asking the network, so a captive portal can't
                    // downgrade or intercept the very first request.
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=63072000; includeSubDomains; preload",
                    },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=(), payment=()",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
