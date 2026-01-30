const db = require("../config/db");
const nodemailer = require("nodemailer");
const {
  CLIENT_ID,
  client,
  otpStore,
  generateDeterministicFiscalCode,
} = require("../utils/authUtils");

// Configurazione Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});



// --- 1. LOGIN: Cerca SOLO per Codice Fiscale ---
exports.googleLogin = async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();

    // Generiamo il CF univoco basato sull'ID Google (non cambia mai)
    const deterministicCF = generateDeterministicFiscalCode(payload.sub);

    console.log(`[LOGIN] Cerco utente con CF: ${deterministicCF}`);

    // Cerca l'utente prima per CODICE_FISCALE (metodo preferito)
    const [rowsByCF] = await db.query(
      "SELECT * FROM UTENTE WHERE CODICE_FISCALE = ?",
      [deterministicCF]
    );

    if (rowsByCF.length > 0) {
      // TROVATO con CF -> LOGIN
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

    // Se non trovato, Cerca per EMAIL (fallback per utenti esistenti senza CF deterministico)
    const [rowsByEmail] = await db.query(
      "SELECT * FROM UTENTE WHERE EMAIL = ?",
      [payload.email]
    );

    if (rowsByEmail.length > 0) {
      // TROVATO con EMAIL -> Utente esistente, aggiorniamo il CF e facciamo login
      const user = rowsByEmail[0];
      console.log(`[LOGIN] Utente trovato tramite email (fallback): ${user.EMAIL}. Aggiorno il CF.`);
      
      // Aggiorna il codice fiscale per le future ricerche
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

    // Se non trovato né con CF né con Email, controlliamo la pre-autorizzazione
    console.log(`[LOGIN] Utente non trovato. Verifico pre-autorizzazione per CF: ${deterministicCF}`);

    const [preAuthRows] = await db.query(
      "SELECT * FROM PRE_AUTORIZZATO WHERE CODICE_FISCALE = ?",
      [deterministicCF]
    );

    if (preAuthRows.length > 0) {
      // --- TROVATO IN PRE_AUTORIZZATO -> CREA ADMIN E LOGIN ---
      console.log(`[LOGIN] CF trovato nella tabella di pre-autorizzazione. Creo utente admin.`);
      
      const firstName = payload.given_name || "Utente";
      const lastName = payload.family_name || "Pre-autorizzato";

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // 1. Inserisci il nuovo utente come admin
        const [insertResult] = await connection.query(
          `INSERT INTO UTENTE (NOME, COGNOME, EMAIL, CODICE_FISCALE, IS_ADMIN, IS_CITTADINO, CREATED_AT)
           VALUES (?, ?, ?, ?, 1, 0, NOW())`,
          [firstName, lastName, payload.email, deterministicCF]
        );
        const newUserId = insertResult.insertId;

        // 2. Rimuovi dalla tabella di pre-autorizzazione
        await connection.query(
          "DELETE FROM PRE_AUTORIZZATO WHERE CODICE_FISCALE = ?",
          [deterministicCF]
        );

        await connection.commit();

        // 3. Recupera l'utente appena creato per la risposta
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


    // --- NESSUNA CORRISPONDENZA -> REGISTRAZIONE ---
    console.log(`[LOGIN] Utente non trovato e non pre-autorizzato. Avvio registrazione per: ${payload.email}`);
    return res.status(200).json({
      status: "NEED_REGISTRATION",
      googleData: {
        firstName: payload.given_name,
        lastName: payload.family_name,
        email: payload.email,
        fiscalCode: deterministicCF, // Passiamo il CF calcolato
      },
    });
  } catch (err) {
    console.error("Errore Login Google:", err);
    res.status(401).json({ message: "Token non valido" });
  }
};

// --- 2. INVIO OTP: Controlla se l'EMAIL esiste già ---
exports.sendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ message: "Email non valida" });
  }

  try {
    // MODIFICA RICHIESTA: Qui controlliamo se l'email è occupata
    const [existingUser] = await db.query(
      "SELECT ID_UTENTE FROM UTENTE WHERE EMAIL = ?",
      [email]
    );

    if (existingUser.length > 0) {
      // STOP: L'email è già usata da qualcun altro
      return res.status(409).json({
        message: "Questa email è già stata utilizzata. Inseriscine un'altra.",
      });
    }

    // Se l'email è libera, procediamo
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
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verifica Email</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td style="padding: 20px 0 30px 0;">
                        
                        <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; border: 1px solid #dedede; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                            
                            <tr>
                                <td bgcolor="#C00D0E" style="padding: 30px 30px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 24px; color: #ffffff; letter-spacing: 1px;">TRENTO PARTECIPA</h1>
                                </td>
                            </tr>

                            <tr>
                                <td style="padding: 40px 30px;">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td style="color: #333333; font-size: 16px; line-height: 24px;">
                                                Ciao,
                                                <br><br>
                                                Grazie per esserti unito a <strong>Trento Partecipa</strong>. Per completare la tua registrazione e verificare il tuo account, utilizza il codice OTP qui sotto.
                                            </td>
                                        </tr>
                                        
                                        <tr>
                                            <td style="padding: 30px 0; text-align: center;">
                                                <span style="display: inline-block; padding: 15px 30px; font-size: 32px; font-family: monospace; font-weight: bold; color: #C00D0E; background-color: #fdf0f0; border-radius: 6px; border: 1px dashed #C00D0E; letter-spacing: 5px;">
                                                    ${otp}
                                                </span>
                                            </td>
                                        </tr>

                                        <tr>
                                            <td style="color: #666666; font-size: 14px; line-height: 20px;">
                                                ⚠️ <strong>Importante:</strong>
                                                <ul>
                                                    <li>Questo codice scadrà tra <strong>5 minuti</strong>.</li>
                                                    <li>Se non hai richiesto tu questo codice, ignora pure questa email.</li>
                                                    <li>Non condividere questo codice con nessuno.</li>
                                                </ul>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <tr>
                                <td bgcolor="#eeeeee" style="padding: 20px 30px;">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td style="color: #999999; font-size: 12px; text-align: center;">
                                                &copy; ${new Date().getFullYear()} Comune di Trento - Piattaforma di Partecipazione.<br>
                                                Questa è una email automatica, per favore non rispondere.
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                        </table>
                    </td>
                </tr>
            </table>

        </body>
        </html>
      `,
    };

    // Se le credenziali email non sono configurate, salta l'invio e usa la modalità dev
    if (process.env.MAIL_USER && process.env.MAIL_PASS) {
      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "Codice inviato" });
    } else {
      console.log("⚠️  [MODALITÀ SVILUPPO] Le credenziali email non sono impostate. L'invio è stato saltato.");
      res.status(200).json({ message: "Check console (DevMode)", devMode: true });
    }
  } catch (error) {
    console.error("Errore sendOtp:", error);
    if (otpStore[email]) {
      return res
        .status(200)
        .json({ message: "Check console (DevMode)", devMode: true });
    }
    res.status(500).json({ message: "Errore server" });
  }
};



exports.logout = async (req, res) => {
  res.status(200).json({ message: "Logout effettuato" });
};
