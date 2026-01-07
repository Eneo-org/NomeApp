const { OAuth2Client } = require("google-auth-library");
const db = require("../config/db");

// 1. Assicurati che questo ID sia IDENTICO a quello del frontend
const CLIENT_ID =
  "86056164816-hta85akkjjfc5h53p17vrgoo531ebsv7.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

exports.loginAndAuth = async (req, res) => {
  const { token } = req.body;

  try {
    // 2. Verifica del token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID, // <--- L'errore nasceva qui se diverso
    });
    const payload = ticket.getPayload();

    const googleEmail = payload.email;
    const googleFirstName = payload.given_name;
    const googleLastName = payload.family_name;

    // 3. Controllo o Creazione Utente nel DB
    const [rows] = await db.query("SELECT * FROM UTENTE WHERE EMAIL = ?", [
      googleEmail,
    ]);

    let user;

    if (rows.length > 0) {
      user = rows[0];
    } else {
      // Logica creazione nuovo utente
      const fakeFiscalCode = `GOOG${payload.sub.slice(-12)}`;
      // Admin se l'email contiene "admin", altrimenti cittadino
      const isAdmin = googleEmail.includes("admin") ? 1 : 0;
      const isCitizen = isAdmin ? 0 : 1;

      const insertQuery = `
                INSERT INTO UTENTE (NOME, COGNOME, EMAIL, CODICE_FISCALE, IS_ADMIN, IS_CITTADINO, PASSWORD, CREATED_AT)
                VALUES (?, ?, ?, ?, ?, ?, 'GOOGLE_AUTH', NOW())
            `;

      const [result] = await db.query(insertQuery, [
        googleFirstName,
        googleLastName,
        googleEmail,
        fakeFiscalCode,
        isAdmin,
        isCitizen,
      ]);

      const [newUserRows] = await db.query(
        "SELECT * FROM UTENTE WHERE ID_UTENTE = ?",
        [result.insertId]
      );
      user = newUserRows[0];
    }

    res.status(200).json({
      message: "Login successo",
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
    console.error("Errore verifica Google:", err);
    res
      .status(401)
      .json({ message: "Token Google non valido o ID non corrispondente" });
  }
};

exports.logout = async (req, res) => {
  res.status(200).json({ message: "Logout effettuato" });
};
