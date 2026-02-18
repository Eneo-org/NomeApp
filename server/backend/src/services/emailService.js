const { Resend } = require("resend");
require("dotenv").config();

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const DEFAULT_FROM = "Trento Partecipa <info@trentopartecipa.me>";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const buildAbsoluteUrl = (link) => {
  if (!link) return FRONTEND_URL;
  if (link.startsWith("http")) return link;
  const normalizedLink = link.startsWith("/") ? link : `/${link}`;
  return `${FRONTEND_URL}${normalizedLink}`;
};

const buildNotificationHtml = ({
  title,
  message,
  ctaUrl,
  ctaText,
  initiativeTitle,
  status,
  signatures,
  extraInfo,
}) => {
  const statusBadge = status
    ? `
    <div style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; margin: 12px 0; background-color: ${status === "Approvata" ? "#d4edda" : status === "Respinta" ? "#f8d7da" : status === "Scaduta" ? "#fff3cd" : "#e2e3e5"}; color: ${status === "Approvata" ? "#155724" : status === "Respinta" ? "#721c24" : status === "Scaduta" ? "#856404" : "#383d41"};">
      ${status}
    </div>
  `
    : "";

  const signaturesInfo =
    signatures !== undefined && signatures !== null
      ? `
    <p style="margin: 8px 0; font-size: 14px; color: #555;">
      <strong>✍️ Firme raccolte:</strong> ${signatures}
    </p>
  `
      : "";

  const extraSection = extraInfo
    ? `
    <p style="margin: 8px 0; font-size: 14px; color: #555;">${extraInfo}</p>
  `
    : "";

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f6f5f3; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding: 24px 0 32px 0;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; border: 1px solid #e0e0e0; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <tr>
              <td bgcolor="#C00D0E" style="padding: 32px 30px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px; color: #ffffff; letter-spacing: 1.5px; font-weight: 700;">🏛️ TRENTO PARTECIPA</h1>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">Piattaforma di Partecipazione Civica</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px 30px;">
                <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #C00D0E; font-weight: 600;">📢 ${title}</h2>
                ${statusBadge}
                <p style="margin: 16px 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">${message}</p>
                
                ${
                  initiativeTitle
                    ? `
                <div style="background-color: #f8f9fa; border-left: 4px solid #C00D0E; padding: 16px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0 0 8px 0; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Iniziativa</p>
                  <p style="margin: 0 0 8px 0; font-size: 16px; color: #1f1f1f; font-weight: 600;">${initiativeTitle}</p>
                  ${signaturesInfo}
                  ${extraSection}
                </div>
                `
                    : ""
                }
                
                <div style="text-align: center; padding: 24px 0 18px 0;">
                  <a href="${ctaUrl}" style="display: inline-block; background-color: #C00D0E; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(192,13,14,0.2); transition: background-color 0.3s;">${ctaText}</a>
                </div>
                
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
                
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #777;">Se il pulsante non funziona, copia questo link:</p>
                <p style="margin: 0; font-size: 12px; color: #C00D0E; word-break: break-all;">${ctaUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 30px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #666; text-align: center;">
                  Hai ricevuto questa email perché segui un'iniziativa su Trento Partecipa
                </p>
                <p style="margin: 0; font-size: 11px; color: #999; text-align: center;">
                  © ${new Date().getFullYear()} Trento Partecipa - Tutti i diritti riservati
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};

const sendNotificationEmail = async ({
  to,
  subject,
  title,
  message,
  link,
  ctaText,
  initiativeTitle,
  status,
  signatures,
  extraInfo,
}) => {
  if (!resend) {
    console.error("[EMAIL] RESEND_API_KEY is missing. Email not sent.");
    return { skipped: true };
  }

  const ctaUrl = buildAbsoluteUrl(link);
  const html = buildNotificationHtml({
    title,
    message,
    ctaUrl,
    ctaText: ctaText || "Apri iniziativa",
    initiativeTitle,
    status,
    signatures,
    extraInfo,
  });

  const data = await resend.emails.send({
    from: DEFAULT_FROM,
    to,
    subject,
    html,
  });

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data;
};

const sendNotificationEmailsBatch = async (emails, payload) => {
  const uniqueEmails = Array.from(
    new Set((emails || []).filter((email) => Boolean(email))),
  );

  if (uniqueEmails.length === 0) return [];

  return Promise.all(
    uniqueEmails.map((email) =>
      sendNotificationEmail({
        to: email,
        subject: payload.subject,
        title: payload.title,
        message: payload.message,
        link: payload.link,
        ctaText: payload.ctaText,
        initiativeTitle: payload.initiativeTitle,
        status: payload.status,
        signatures: payload.signatures,
        extraInfo: payload.extraInfo,
      }),
    ),
  );
};

module.exports = {
  sendNotificationEmail,
  sendNotificationEmailsBatch,
};
