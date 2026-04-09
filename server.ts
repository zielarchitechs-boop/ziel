import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import { Resend } from 'resend';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. CORS MUST BE FIRST
  app.use(cors());
  app.options("*", cors()); // Handle preflight for all routes
  
  app.use(express.json());

  // 2. Logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // 3. API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/test", (req, res) => {
    res.json({ 
      message: "Server is reachable", 
      timestamp: new Date().toISOString(),
      env: {
        hasUrl: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
        hasServiceKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY)
      }
    });
  });

  // Explicitly handle OPTIONS for all API routes to ensure CORS works
  app.options("*", (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
  });

  // Explicitly handle the delete profile route with more logging
  app.delete("/api/delete-profile", async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] /api/delete-profile (DELETE) called`);
    
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
  });

  app.post("/api/delete-profile", async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] /api/delete-profile (POST) called`);
    
    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ error: "User ID is required" });

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                               process.env.SERVICE_ROLE_KEY || 
                               process.env.SUPABASE_SERVICE_KEY || 
                               process.env.SUPABASE_ADMIN_KEY ||
                               "";

    try {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      res.status(200).json({ success: true, message: "Deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint to delete user by email (useful when ID is unknown)
  app.all("/api/delete-user-by-email", async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] /api/delete-user-by-email called with method: ${req.method}`);

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
      return res.status(500).json({ 
        error: "Supabase Admin credentials missing on server. Please set SUPABASE_SERVICE_ROLE_KEY in your environment variables." 
      });
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
  });

  // Email sending endpoint
  app.all("/api/send-email", async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] /api/send-email called with method: ${req.method}`);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: `Method ${req.method} not allowed. Use POST.` });
    }

    const { to, subject, html } = req.body;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Missing required fields: to, subject, or html" });
    }

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY is missing. Email will not be sent.");
      return res.status(500).json({ error: "Email service not configured on server." });
    }

    try {
      const resend = new Resend(resendApiKey);
      const { data, error } = await resend.emails.send({
      from: 'Ziel Architects <noreply@ziel-architects.store>',
        to,
        subject,
        html,
      });

      if (error) {
        console.error("Resend Error:", error);
        return res.status(500).json({ error: error.message });
      }

      res.status(200).json({ success: true, data });
    } catch (error: any) {
      console.error("Unexpected Email Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 4. Serve static files from the public directory explicitly
  // This ensures Google can find sitemap.xml, robots.txt, etc.
  app.get(['/sitemap.xml', '/robots.txt', '/manifest.json', '/favicon.svg'], (req, res) => {
    const filePath = path.resolve(__dirname, 'public', req.path.substring(1));
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // SPA fallback for development
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        // 1. Read index.html
        let template = await fs.promises.readFile(
          path.resolve(__dirname, "index.html"),
          "utf-8"
        );

        // 2. Apply Vite HTML transforms.
        template = await vite.transformIndexHtml(url, template);

        // 3. Send the rendered HTML back.
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
