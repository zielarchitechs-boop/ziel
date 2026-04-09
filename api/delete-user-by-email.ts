import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] /api/delete-user-by-email (Vercel) called with method: ${req.method}`);

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

  const { email } = req.body;
  console.log(`[${timestamp}] DELETE-USER-BY-EMAIL called for: ${email}`);

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
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
    
    // 1. Find user by email
    const { data: userData, error: findError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (findError) {
      console.error(`[${timestamp}] Find Error:`, findError);
      return res.status(500).json({ error: findError.message });
    }

    const userToDelete = userData.users.find(u => u.email === email);
    
    if (!userToDelete) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = userToDelete.id;

    // 2. Delete from Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authError) {
      console.error(`[${timestamp}] Auth Error:`, authError);
      return res.status(500).json({ error: authError.message });
    }

    // 3. Delete from profiles
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    res.status(200).json({ success: true, message: `User ${email} deleted successfully` });
  } catch (error: any) {
    console.error(`[${timestamp}] Unexpected Error:`, error);
    res.status(500).json({ error: error.message });
  }
}
