// convex/auth.config.ts
const authConfig = {
  providers: [
    {
      domain: "https://alive-monkey-7506.clerk.accounts.dev",
      applicationID: "convex", // ← must be "convex", not a dynamic env var
    },
  ],
};

export default authConfig;
