import { Resend } from 'resend';

export default async function handler(req: any, res: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] /api/send-email (Vercel) called with method: ${req.method}`);

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
      from: 'Ziel Architects <enquiries@ziel-architects.store>',
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
}
