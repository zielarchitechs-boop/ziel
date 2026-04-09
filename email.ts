

export const getEmailTemplate = (title: string, content: string) => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = `https://img.icons8.com/fluency/96/layers.png`; // Using a high-quality PNG from a reliable CDN

  return `
    <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
      <div style="background-color: #064e3b; padding: 32px 20px; text-align: center;">
        <div style="display: inline-block; vertical-align: middle;">
          <div style="display: inline-block; vertical-align: middle;">
            <img src="${logoUrl}" alt="Logo" width="44" height="44" style="display: block; border-radius: 12px;" />
          </div>
          <div style="display: inline-block; vertical-align: middle; text-align: left; margin-left: 12px;">
            <div style="color: #ffffff; font-size: 18px; font-weight: 900; text-transform: uppercase; line-height: 1;">Intelligent</div>
            <div style="color: #38bdf8; font-size: 9px; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.1em;">Prospect Solution</div>
          </div>
        </div>
      </div>
      <div style="padding: 40px 32px;">
        <h2 style="color: #064e3b; font-size: 22px; font-weight: 800; margin-bottom: 24px;">${title}</h2>
        <div style="color: #475569; line-height: 1.6; font-size: 16px;">
          ${content}
        </div>
        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">This is an automated message from Intelligent Prospect Solution. Please do not reply directly to this email.</p>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #64748b; font-size: 14px; margin: 0;">&copy; 2026 Intelligent Prospect Solution. All rights reserved.</p>
      </div>
    </div>
  `;
};

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, subject, html }),
    });

    if (!response.ok) {
      let error = { message: `Error ${response.status}` };
      const responseText = await response.text();
      try {
        if (responseText) {
          error = JSON.parse(responseText);
        }
      } catch (e) {
        console.warn('Failed to parse email response as JSON:', responseText);
        error = { message: responseText || `Error ${response.status}` };
      }
      console.error('Email sending failed:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};
