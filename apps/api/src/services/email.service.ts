// src/services/email.service.ts
// Serviço de envio de e-mail via SMTP usando nodemailer.
// Configurar as variáveis de ambiente no .env:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// Provedores recomendados (gratuitos):
//   - Resend (resend.com) — 3.000 e-mails/mês grátis, SMTP simples
//   - Brevo (brevo.com)  — 300 e-mails/dia grátis
//   - Gmail SMTP         — para testes locais

const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const SMTP_FROM = process.env.SMTP_FROM ?? "The House Barber <noreply@thehousebarber.com>";
const APP_URL   = process.env.APP_URL   ?? "http://localhost:5173";

// Nodemailer é instalado com: bun add nodemailer @types/nodemailer
let transporter: any = null;

async function getTransporter() {
  if (transporter) return transporter;

  const nodemailer = await import("nodemailer");
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendMail(options: SendMailOptions): Promise<void> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // Em desenvolvimento sem SMTP configurado, apenas loga o e-mail no console.
    console.log("\n📧 [EMAIL — sem SMTP configurado, exibindo no console]");
    console.log(`   Para:     ${options.to}`);
    console.log(`   Assunto:  ${options.subject}`);
    console.log(`   Conteúdo: ${options.html.replace(/<[^>]+>/g, " ").trim().slice(0, 300)}\n`);
    return;
  }

  const t = await getTransporter();
  await t.sendMail({ from: SMTP_FROM, ...options });
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
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
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