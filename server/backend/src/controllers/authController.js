const { OAuth2Client } = require("google-auth-library");
const db = require("../config/db");
const nodemailer = require("nodemailer");

// ID CLIENT (Deve coincidere con quello del Frontend)
const CLIENT_ID =
  "86056164816-hta85akkjjfc5h53p17vrgoo531ebsv7.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

// Configurazione Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Store temporaneo OTP
const otpStore = {};

// Helper: Genera CF fisso basato sull'ID univoco di Google
const generateDeterministicFiscalCode = (googleSub) => {
  return `GOOG${googleSub.slice(-12)}`;
};

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

    // MODIFICA RICHIESTA: Cerca SOLO per CODICE_FISCALE
    const [rows] = await db.query(
      "SELECT * FROM UTENTE WHERE CODICE_FISCALE = ?",
      [deterministicCF]
    );

    if (rows.length > 0) {
      // TROVATO -> LOGIN
      const user = rows[0];
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
    } else {
      // NON TROVATO -> REGISTRAZIONE
      // Nota: Qui non ci interessa se l'email esiste già, lo controllerà "sendOtp" dopo.
      return res.status(200).json({
        status: "NEED_REGISTRATION",
        googleData: {
          firstName: payload.given_name,
          lastName: payload.family_name,
          email: payload.email,
          fiscalCode: deterministicCF, // Passiamo il CF calcolato
        },
      });
    }
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

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Codice inviato" });
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

// --- 3. REGISTRAZIONE FINALE ---
exports.registerUser = async (req, res) => {
  const { googleToken, email, otp } = req.body;

  // 1. Recupero OTP dallo store
  const storedOtp = otpStore[email];

  // A. Controllo esistenza e corrispondenza codice
  // Se non c'è l'OTP in memoria o il codice digitato non combacia
  if (!storedOtp || storedOtp.code !== otp) {
    return res.status(400).json({ message: "Codice OTP errato." });
  }

  // B. Controllo SCADENZA (Nuova logica aggiunta)
  // Se l'orario attuale è maggiore della scadenza impostata
  if (Date.now() > storedOtp.expires) {
    // Cancelliamo il codice scaduto per pulizia, così non può essere riusato
    delete otpStore[email];
    // Restituiamo ESATTAMENTE il messaggio che il frontend si aspetta per mostrare l'errore in rosso
    return res
      .status(400)
      .json({ message: "Codice OTP scaduto, generane un altro" });
  }

  // --- Da qui in poi procediamo con la verifica Google e il salvataggio DB ---

  // Verifica Token Google e Ricalcolo CF (Sicurezza)
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Token Google scaduto o non valido." });
  }

  // Ricalcoliamo lo stesso CF deterministico usato nel login
  const deterministicCF = generateDeterministicFiscalCode(payload.sub);

  const firstName = payload.given_name || "Utente";
  const lastName = payload.family_name || "Google";

  try {
    const isAdmin = email.toLowerCase().includes("admin") ? 1 : 0;
    const isCitizen = isAdmin ? 0 : 1;

    // Tentativo di inserimento nel DB
    const query = `
        INSERT INTO UTENTE (NOME, COGNOME, EMAIL, CODICE_FISCALE, IS_ADMIN, IS_CITTADINO, PASSWORD, CREATED_AT)
        VALUES (?, ?, ?, ?, ?, ?, 'GOOGLE_AUTH_SPID', NOW())
    `;

    const [result] = await db.query(query, [
      firstName,
      lastName,
      email,
      deterministicCF,
      isAdmin,
      isCitizen,
    ]);

    // Recuperiamo l'utente appena creato per restituirlo al frontend
    const [rows] = await db.query("SELECT * FROM UTENTE WHERE ID_UTENTE = ?", [
      result.insertId,
    ]);
    const user = rows[0];

    // Pulizia finale: rimuoviamo l'OTP usato con successo
    delete otpStore[email];

    res.status(201).json({
      status: "REGISTRATION_SUCCESS",
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
    console.error("Errore DB:", err);
    // Gestione specifica duplicati (se nel frattempo qualcuno ha preso l'email)
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email già registrata." });
    }
    res.status(500).json({ message: "Errore durante il salvataggio utente." });
  }
};

exports.logout = async (req, res) => {
  res.status(200).json({ message: "Logout effettuato" });
};
