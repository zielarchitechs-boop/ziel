import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] /api/delete-profile (Vercel) called with method: ${req.method}`);

  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: `Method ${req.method} not allowed. Use POST or DELETE.` });
  }

  const userId = req.body?.userId || req.query?.userId;
  console.log(`[${timestamp}] DELETE-PROFILE data:`, { userId, body: req.body, query: req.query });

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                            process.env.SERVICE_ROLE_KEY || 
                            process.env.SUPABASE_SERVICE_KEY || 
                            process.env.SUPABASE_ADMIN_KEY ||
                            "";

  if (!supabaseUrl || !supabaseServiceKey) {
    const missing = [];
    if (!supabaseUrl) missing.push("SUPABASE_URL (or VITE_SUPABASE_URL)");
    if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    
    const errorMsg = `Supabase Admin credentials missing on server. Missing: ${missing.join(", ")}. Please ensure these are set in your environment variables.`;
    console.error(`[${timestamp}] ${errorMsg}`);
    return res.status(500).json({ error: errorMsg });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authError) {
      console.error(`[${timestamp}] Auth Error:`, authError);
      return res.status(500).json({ error: authError.message });
    }

    // Explicitly delete from profiles too
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error: any) {
    console.error(`[${timestamp}] Unexpected Error:`, error);
    res.status(500).json({ error: error.message });
  }
}
