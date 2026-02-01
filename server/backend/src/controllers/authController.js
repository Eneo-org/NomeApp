const db = require("../config/db");
const nodemailer = require("nodemailer");
const {
  CLIENT_ID,
  client,
  otpStore,
  generateDeterministicFiscalCode,
} = require("../utils/authUtils");

// RIMOSSO: const transporter = ... (Lo spostiamo dentro la funzione per sicurezza)

// --- 1. LOGIN: Cerca SOLO per Codice Fiscale ---
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
      [deterministicCF]
    );

    if (rowsByCF.length > 0) {
      const user = rowsByCF[0];
      console.log(`[LOGIN] Utente trovato tramite CF: ${user.EMAIL}`);
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
      [payload.email]
    );

    if (rowsByEmail.length > 0) {
      const user = rowsByEmail[0];
      console.log(`[LOGIN] Utente trovato tramite email (fallback): ${user.EMAIL}. Aggiorno il CF.`);
      
      await db.query("UPDATE UTENTE SET CODICE_FISCALE = ? WHERE ID_UTENTE = ?", [
        deterministicCF,
        user.ID_UTENTE,
      ]);

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

    console.log(`[LOGIN] Utente non trovato. Verifico pre-autorizzazione per CF: ${deterministicCF}`);

    const [preAuthRows] = await db.query(
      "SELECT * FROM PRE_AUTORIZZATO WHERE CODICE_FISCALE = ?",
      [deterministicCF]
    );

    if (preAuthRows.length > 0) {
      console.log(`[LOGIN] CF trovato nella tabella di pre-autorizzazione. Creo utente admin.`);
      
      const firstName = payload.given_name || "Utente";
      const lastName = payload.family_name || "Pre-autorizzato";

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const [insertResult] = await connection.query(
          `INSERT INTO UTENTE (NOME, COGNOME, EMAIL, CODICE_FISCALE, IS_ADMIN, IS_CITTADINO, CREATED_AT)
           VALUES (?, ?, ?, ?, 1, 0, NOW())`,
          [firstName, lastName, payload.email, deterministicCF]
        );
        const newUserId = insertResult.insertId;

        await connection.query(
          "DELETE FROM PRE_AUTORIZZATO WHERE CODICE_FISCALE = ?",
          [deterministicCF]
        );

        await connection.commit();

        const [newUserRows] = await connection.query(
          "SELECT * FROM UTENTE WHERE ID_UTENTE = ?",
          [newUserId]
        );
        const user = newUserRows[0];

        console.log(`[LOGIN] Utente admin creato con successo. ID: ${user.ID_UTENTE}`);
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

      } catch (error) {
        await connection.rollback();
        console.error("Errore durante la creazione dell'utente pre-autorizzato:", error);
        return res.status(500).json({ message: "Errore durante la creazione dell'utente pre-autorizzato." });
      } finally {
        connection.release();
      }
    }

    console.log(`[LOGIN] Utente non trovato e non pre-autorizzato. Avvio registrazione per: ${payload.email}`);
    return res.status(200).json({
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

// --- 2. INVIO OTP ---
exports.sendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ message: "Email non valida" });
  }

  try {
    const [existingUser] = await db.query(
      "SELECT ID_UTENTE FROM UTENTE WHERE EMAIL = ?",
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        message: "Questa email è già stata utilizzata. Inseriscine un'altra.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { code: otp, expires: Date.now() + 300000 };

    console.log(`\n🔵 [DEMO OTP] Per ${email}: ${otp}\n`);

    const mailOptions = {
      from: '"Trento Partecipa" <' + process.env.MAIL_USER + ">",
      to: email,
      subject: "🔐 Il tuo codice di verifica - Trento Partecipa",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Verifica Email</title>
        </head>
        <body style="font-family: sans-serif; padding: 20px;">
            <h1>Il tuo codice OTP: ${otp}</h1>
            <p>Inserisci questo codice per completare la registrazione.</p>
        </body>
        </html>
      `,
    };

    // --- CORREZIONE QUI ---
    // Creiamo il transporter SOLO se ci sono le credenziali e SOLO al momento dell'invio
    if (process.env.MAIL_USER && process.env.MAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });

      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "Codice inviato" });
    } else {
      console.log("⚠️  [MODALITÀ SVILUPPO] Le credenziali email non sono impostate. L'invio è stato saltato.");
      res.status(200).json({ message: "Check console (DevMode)", devMode: true });
    }
  } catch (error) {
    console.error("Errore sendOtp:", error);
    // Anche in caso di errore (es. login fallito su Gmail), se siamo in dev torniamo l'OTP in console
    if (otpStore[email]) {
      return res
        .status(200) // Ritorniamo 200 così il frontend non si blocca
        .json({ message: "Check console (DevMode)", devMode: true });
    }
    res.status(500).json({ message: "Errore server" });
  }
};

exports.logout = async (req, res) => {
  res.status(200).json({ message: "Logout effettuato" });
};