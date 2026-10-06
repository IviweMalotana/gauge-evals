/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Run instrumentation.ts on server boot (starts the job worker).
    instrumentationHook: true,
    // Keep the heavy browser driver out of the bundler; load it at runtime.
    serverComponentsExternalPackages: ["playwright-core"],
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Next compiles instrumentation.ts for BOTH the nodejs and edge runtimes
  // (it can't tell ahead of time which one register() needs), even though
  // its body only reaches the worker/browser-agent chain (fs/path/http) when
  // `process.env.NEXT_RUNTIME === "nodejs"`. The edge pass still has to
  // resolve those Node built-ins at build time even though that branch never
  // runs under edge. Stub them out for the edge compile only — safe, since
  // the code that imports them is unreachable there.
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === "edge") {
      // The chain (worker → orchestrator → browser agent/playwright-core →
      // requirements format) uses several Node built-ins (bare and
      // "node:"-prefixed) plus playwright-core itself, all unreachable under
      // edge: instrumentation.ts only awaits this import when
      // `NEXT_RUNTIME === "nodejs"`. Stub every built-in and externalize
      // playwright-core for the edge pass rather than whack-a-moling each
      // thing webpack trips over next.
      const builtins = require("module").builtinModules;
      const fallback = { ...config.resolve.fallback };
      for (const name of builtins) {
        fallback[name] = false;
        fallback[`node:${name}`] = false;
      }
      config.resolve.fallback = fallback;
      config.externals = [...(config.externals ?? []), "playwright-core"];
    }
    return config;
  },
};

module.exports = nextConfig;
