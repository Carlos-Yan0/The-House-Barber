// src/services/email.service.ts
// Serviço de envio de e-mail via API REST do Resend.
// Docs: https://resend.com/docs/api-reference/emails/send-email
//
// Vantagem sobre SMTP: no plano gratuito do Resend, usando a API diretamente
// com o domínio padrão (onboarding@resend.dev), é possível enviar para
// qualquer destinatário — sem precisar verificar domínio próprio.
//
// Variáveis de ambiente necessárias no .env:
//   RESEND_API_KEY  → chave da API (começa com re_...)
//   RESEND_FROM     → remetente (ex: "The House Barber <onboarding@resend.dev>")
//   APP_URL         → URL do frontend (ex: https://the-house-barber-web.vercel.app)

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM    = process.env.RESEND_FROM    ?? "The House Barber <onboarding@resend.dev>";
const APP_URL        = process.env.APP_URL        ?? "http://localhost:5173";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

interface ResendResponse {
  id?: string;
  statusCode?: number;
  message?: string;
  name?: string;
}

// ── Função central de envio ───────────────────────────────────────────────────

async function sendMail(options: SendMailOptions): Promise<void> {
  // Sem chave configurada → exibe no console (modo dev)
  if (!RESEND_API_KEY) {
    console.log("\n📧 [EMAIL — RESEND_API_KEY não configurada, exibindo no console]");
    console.log(`   Para:    ${options.to}`);
    console.log(`   Assunto: ${options.subject}`);
    console.log(`   Preview: ${options.html.replace(/<[^>]+>/g, " ").trim().slice(0, 300)}\n`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    RESEND_FROM,
      to:      [options.to],
      subject: options.subject,
      html:    options.html,
    }),
  });

  const data = await res.json() as ResendResponse;

  if (!res.ok) {
    throw new Error(
      `[Resend] Erro ${res.status}: ${data.message ?? data.name ?? "Falha ao enviar e-mail"}`
    );
  }

  console.log(`[Resend] E-mail enviado com sucesso — id: ${data.id}`);
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const resetUrl = `${APP_URL}/redefinir-senha?token=${token}`;

  await sendMail({
    to,
    subject: "Redefinição de senha — The House Barber",
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#111111;font-family:'DM Sans',Arial,sans-serif;color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#1c1c1c;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">

        <!-- Header -->
        <tr><td style="padding:28px 32px;border-bottom:1px solid #2a2a2a;">
          <span style="font-family:Georgia,serif;font-size:18px;font-weight:700;letter-spacing:2px;">
            <span style="color:#d4920f;">THE HOUSE</span>
            <span style="color:#f5f5f5;"> BARBER</span>
          </span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">
            Redefinição de senha
          </h2>
          <p style="margin:0 0 24px;color:#a0a0a0;font-size:14px;line-height:1.6;">
            Olá, <strong style="color:#f5f5f5;">${name}</strong>. Recebemos uma solicitação para redefinir a senha da sua conta.
          </p>

          <a href="${resetUrl}"
             style="display:inline-block;background:#d4920f;color:#111;font-weight:700;font-size:14px;
                    text-decoration:none;padding:14px 28px;border-radius:12px;letter-spacing:0.5px;">
            Redefinir minha senha
          </a>

          <p style="margin:24px 0 0;color:#666;font-size:12px;line-height:1.6;">
            Este link expira em <strong style="color:#a0a0a0;">1 hora</strong>.<br>
            Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.
          </p>

          <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0;">

          <p style="margin:0;color:#444;font-size:11px;">
            Ou copie e cole no navegador:<br>
            <span style="color:#666;word-break:break-all;">${resetUrl}</span>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #2a2a2a;text-align:center;">
          <p style="margin:0;color:#444;font-size:11px;">© 2025 The House Barber</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}