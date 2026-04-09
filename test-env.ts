export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    hasUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    hasServiceKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ADMIN_KEY),
    urlPrefix: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").substring(0, 10),
    serviceKeyLength: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ADMIN_KEY || "").length,
    nodeEnv: process.env.NODE_ENV
  });
}
