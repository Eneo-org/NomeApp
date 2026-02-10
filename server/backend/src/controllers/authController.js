const db = require("../config/db");
// We removed nodemailer. Now we use Resend.
const { Resend } = require("resend");
require("dotenv").config();

const {
  CLIENT_ID,
  client,
  otpStore,
  generateDeterministicFiscalCode,
} = require("../utils/authUtils");

const TEACHER_LOGIN_SECRET = process.env.TEACHER_LOGIN_SECRET;

const TEACHER_TEST_ACCOUNTS = [
  {
    key: "mario-rossi",
    firstName: "Mario",
    lastName: "Rossi",
    email: "mario.rossi@example.com",
    isAdmin: 0,
    isCitizen: 1,
  },
  {
    key: "luigi-verdi",
    firstName: "Luigi",
    lastName: "Verdi",
    email: "admin.luigi@example.com",
    isAdmin: 1,
    isCitizen: 0,
  },
  {
    key: "giulia-bianchi",
    firstName: "Giulia",
    lastName: "Bianchi",
    email: "super.giulia@example.com",
    isAdmin: 1,
    isCitizen: 1,
  },
];

const buildTestFiscalCode = (email) => {
  const hex = Buffer.from(email).toString("hex").toUpperCase();
  return `TEST${hex.slice(0, 12).padEnd(12, "0")}`;
};

// Initialize Resend
// (Make sure RESEND_API_KEY is set in Render Environment Variables)
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// --- 1. GOOGLE LOGIN (Unchanged) ---
exports.googleLogin = async (req, res) => {
  const { tokenId } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const deterministicCF = generateDeterministicFiscalCode(payload.sub);

    console.log(`[LOGIN] Cerco utente con CF: ${deterministicCF}`);

    const [rowsByCF] = await db.query(
      "SELECT * FROM UTENTE WHERE CODICE_FISCALE = ?",
      [deterministicCF],
    );

    if (rowsByCF.length > 0) {
      const user = rowsByCF[0];
      return res.status(200).json({
        status: "LOGIN_SUCCESS",
        user: {
          id: user.ID_UTENTE,
          firstName: user.NOME,
          lastName: user.COGNOME,
          email: user.EMAIL,
          isAdmin: Boolean(user.IS_ADMIN),
          isCitizen: Boolean(user.IS_CITTADINO),
        },
      });
    }

    const [rowsByEmail] = await db.query(
      "SELECT * FROM UTENTE WHERE EMAIL = ?",
      [payload.email],
    );

    if (rowsByEmail.length > 0) {
      const user = rowsByEmail[0];
      await db.query(
        "UPDATE UTENTE SET CODICE_FISCALE = ? WHERE ID_UTENTE = ?",
        [deterministicCF, user.ID_UTENTE],
      );

      return res.status(200).json({
        status: "LOGIN_SUCCESS",
        user: {
          id: user.ID_UTENTE,
          firstName: user.NOME,
          lastName: user.COGNOME,
          email: user.EMAIL,
          isAdmin: Boolean(user.IS_ADMIN),
          isCitizen: Boolean(user.IS_CITTADINO),
        },
      });
    }

    // Pre-authorized and New Users Management...
    const [preAuthRows] = await db.query(
      "SELECT * FROM PRE_AUTORIZZATO WHERE CODICE_FISCALE = ?",
      [deterministicCF],
    );

    if (preAuthRows.length > 0) {
      const firstName = payload.given_name || "Utente";
      const lastName = payload.family_name || "Pre-autorizzato";
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [insertResult] = await connection.query(
          `INSERT INTO UTENTE (NOME, COGNOME, EMAIL, CODICE_FISCALE, IS_ADMIN, IS_CITTADINO, CREATED_AT) VALUES (?, ?, ?, ?, 1, 0, NOW())`,
          [firstName, lastName, payload.email, deterministicCF],
        );
        const newUserId = insertResult.insertId;
        await connection.query(
          "DELETE FROM PRE_AUTORIZZATO WHERE CODICE_FISCALE = ?",
          [deterministicCF],
        );
        await connection.commit();
        const [newUserRows] = await connection.query(
          "SELECT * FROM UTENTE WHERE ID_UTENTE = ?",
          [newUserId],
        );
        const user = newUserRows[0];
        return res.status(200).json({
          status: "LOGIN_SUCCESS",
          user: {
            id: user.ID_UTENTE,
            firstName: user.NOME,
            lastName: user.COGNOME,
            email: user.EMAIL,
            isAdmin: Boolean(user.IS_ADMIN),
            isCitizen: Boolean(user.IS_CITTADINO),
          },
        });
      } catch (e) {
        await connection.rollback();
        throw e;
      } finally {
        connection.release();
      }
    }

    return res.status(404).json({
      status: "NEED_REGISTRATION",
      googleData: {
        firstName: payload.given_name,
        lastName: payload.family_name,
        email: payload.email,
        fiscalCode: deterministicCF,
      },
    });
  } catch (err) {
    console.error("Errore Login Google:", err);
    res.status(401).json({ message: "Token non valido" });
  }
};

// --- 1b. TEACHER LOGIN (Test Accounts) ---
exports.teacherLogin = async (req, res) => {
  const { secret, accountKey } = req.body;

  if (!TEACHER_LOGIN_SECRET) {
    return res.status(503).json({ message: "Teacher login not configured" });
  }

  if (!secret || secret !== TEACHER_LOGIN_SECRET) {
    return res.status(403).json({ message: "Accesso negato" });
  }

  const account = TEACHER_TEST_ACCOUNTS.find((item) => item.key === accountKey);
  if (!account) {
    return res.status(400).json({ message: "Account test non valido" });
  }

  try {
    const [rowsByEmail] = await db.query(
      "SELECT * FROM UTENTE WHERE EMAIL = ?",
      [account.email],
    );

    if (rowsByEmail.length > 0) {
      const user = rowsByEmail[0];
      return res.status(200).json({
        status: "LOGIN_SUCCESS",
        user: {
          id: user.ID_UTENTE,
          firstName: user.NOME,
          lastName: user.COGNOME,
          email: user.EMAIL,
          isAdmin: Boolean(user.IS_ADMIN),
          isCitizen: Boolean(user.IS_CITTADINO),
        },
      });
    }

    const fiscalCode = buildTestFiscalCode(account.email);
    const insertQuery = `
      INSERT INTO UTENTE (NOME, COGNOME, EMAIL, CODICE_FISCALE, IS_ADMIN, IS_CITTADINO, CREATED_AT)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    const [insertResult] = await db.query(insertQuery, [
      account.firstName,
      account.lastName,
      account.email,
      fiscalCode,
      account.isAdmin,
      account.isCitizen,
    ]);

    const [newUserRows] = await db.query(
      "SELECT * FROM UTENTE WHERE ID_UTENTE = ?",
      [insertResult.insertId],
    );

    const user = newUserRows[0];
    return res.status(200).json({
      status: "LOGIN_SUCCESS",
      user: {
        id: user.ID_UTENTE,
        firstName: user.NOME,
        lastName: user.COGNOME,
        email: user.EMAIL,
        isAdmin: Boolean(user.IS_ADMIN),
        isCitizen: Boolean(user.IS_CITTADINO),
      },
    });
  } catch (err) {
    console.error("Errore teacherLogin:", err);
    res.status(500).json({ message: "Errore server" });
  }
};

// --- 2. SEND OTP (UPDATED TO USE RESEND API) ---
exports.sendOtp = async (req, res) => {
  const { email } = req.body;

  // *** DIAGNOSTIC LOG ***
  console.log("\n------------------------------------------------");
  console.log("🚀 [RESEND PROD] STARTING OTP SEND VIA API");
  console.log("📧 Target Email:", email);
  console.log("------------------------------------------------\n");

  if (!email || !email.includes("@")) {
    return res.status(400).json({ message: "Email non valida" });
  }

  try {
    const [existingUser] = await db.query(
      "SELECT ID_UTENTE FROM UTENTE WHERE EMAIL = ?",
      [email],
    );
    if (existingUser.length > 0) {
      return res.status(409).json({
        message: "Questa email è già stata utilizzata. Inseriscine un'altra.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { code: otp, expires: Date.now() + 300000 };

    console.log(`🔵 [OTP LOG] Generated Code: ${otp}`);

    // SAFETY CHECK
    if (!resend) {
      console.error(
        "🔴 ERROR: RESEND_API_KEY is missing in Render environment variables!",
      );
      // We return success in dev mode to not block you, but check Render Dashboard!
      return res
        .status(200)
        .json({ message: "API Key Missing (Check Logs)", devMode: true });
    }

    // SEND VIA API (No SMTP!)
    const data = await resend.emails.send({
      // ✅ UPDATED: Using verified domain sender
      from: "Trento Partecipa <info@trentopartecipa.me>",
      to: email,
      subject: "🔐 Il tuo codice di verifica - Trento Partecipa",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verifica Email</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td style="padding: 20px 0 30px 0;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; border: 1px solid #dedede; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                            <tr>
                                <td bgcolor="#C00D0E" style="padding: 30px 30px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 24px; color: #ffffff;">TRENTO PARTECIPA</h1>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 40px 30px;">
                                    <p style="color: #333; font-size: 16px;">Ciao,<br><br>Usa questo codice per verificare il tuo account:</p>
                                    <div style="text-align: center; padding: 30px 0;">
                                        <span style="display: inline-block; padding: 15px 30px; font-size: 32px; font-weight: bold; color: #C00D0E; background-color: #fdf0f0; border: 1px dashed #C00D0E; letter-spacing: 5px;">
                                            ${otp}
                                        </span>
                                    </div>
                                    <p style="color: #666; font-size: 14px;">Scade tra 5 minuti.</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `,
    });

    if (data.error) {
      console.error("❌ Resend API Error:", data.error);
      return res
        .status(500)
        .json({ message: "Resend API Error: " + data.error.message });
    }

    console.log("✅ Mail successfully sent via API. ID:", data.id);
    res.status(200).json({ message: "Codice inviato" });
  } catch (error) {
    console.error("❌ SERVER ERROR:", error);
    res.status(500).json({ message: "Internal Error: " + error.message });
  }
};

// --- 3. LOGOUT ---
exports.logout = async (req, res) => {
  res.status(200).json({ message: "Logout effettuato" });
};
