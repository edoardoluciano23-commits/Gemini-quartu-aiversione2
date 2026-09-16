const isDev = process.env.NODE_ENV === "development";

// Domini Firebase (Auth + Firestore)
const firebaseDomains = [
  "https://*.googleapis.com",
  "https://*.firebaseio.com",
  "wss://*.firebaseio.com",
  "https://*.firebaseapp.com",
  "https://firestore.googleapis.com",
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
];

// Domini WebLLM (download modelli MLC via browser)
const webLlmDomains = [
  "https://huggingface.co",
  "https://cdn-lfs.huggingface.co",
  "https://cdn-lfs-us-1.huggingface.co",
  "https://cdn.jsdelivr.net",
  "https://raw.githubusercontent.com",
  "https://mlc.ai",
  "https://raw.githubusercontent.com",
];

// LM Studio / Ollama locale (fetch diretto dal browser)
const localAiDomains = [
  "http://127.0.0.1:1234",
  "http://localhost:1234",
  "http://127.0.0.1:11434",
  "http://localhost:11434",
];

const connectSrc = [
  "'self'",
  ...firebaseDomains,
  ...webLlmDomains,
  ...localAiDomains,
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${connectSrc}`,
  // WebLLM gira su Web Worker con blob URL
  "worker-src blob: 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  cleanDistDir: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
