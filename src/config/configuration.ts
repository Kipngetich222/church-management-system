const toList = (value?: string): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default () => ({
  env: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),
  apiPublicUrl: process.env.API_PUBLIC_URL ?? "http://localhost:4000",
  corsOrigins: toList(process.env.CORS_ORIGINS) ?? [],
  cronSecret: process.env.CRON_SECRET ?? "",
  supabase: {
    url: process.env.SUPABASE_URL ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    anonKey: process.env.SUPABASE_ANON_KEY ?? "",
  },
  mpesa: {
    env: process.env.MPESA_ENV ?? "sandbox",
    consumerKey: process.env.MPESA_CONSUMER_KEY ?? "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "",
    passkey: process.env.MPESA_PASSKEY ?? "",
    shortcode: process.env.MPESA_SHORTCODE ?? "",
  },
  sms: {
    username: process.env.AFRICAS_TALKING_USERNAME ?? "",
    apiKey: process.env.AFRICAS_TALKING_API_KEY ?? "",
    senderId: process.env.AFRICAS_TALKING_SENDER_ID ?? "",
    env: process.env.AFRICAS_TALKING_ENV ?? "sandbox",
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    from: process.env.RESEND_FROM ?? "noreply@yourchurch.app",
    contactEmail: process.env.CONTACT_EMAIL ?? "hello@yourchurch.app",
  },
  mapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
});