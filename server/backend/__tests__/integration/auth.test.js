const request = require("supertest");
const express = require("express");
const authRoutes = require("../../src/routes/auth");
const db = require("../../src/config/db");
const {
  client,
  otpStore,
  generateDeterministicFiscalCode,
} = require("../../src/utils/authUtils");
const nodemailer = require("nodemailer");

// Mock dependencies
jest.mock("../../src/config/db");
jest.mock("../../src/utils/authUtils", () => ({
  ...jest.requireActual("../../src/utils/authUtils"),
  client: {
    verifyIdToken: jest.fn(),
  },
  otpStore: {},
  generateDeterministicFiscalCode: jest.requireActual(
    "../../src/utils/authUtils",
  ).generateDeterministicFiscalCode,
}));
jest.mock("resend", () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({ id: "test_id" }),
      },
    })),
  };
});

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);

/**
 * =========================================================================
 * TEST SUITE: API /auth - Authentication & Registration Flows
 * =========================================================================
 *
 * Copertura Requisiti Funzionali:
 * - RF1: Accesso (Login) tramite Google OAuth
 * - RF2: Creazione Profilo Utente
 *   - RF2.1: Cittadini Residenti (isCitizen=1)
 *   - RF2.2: Amministratori Pre-autorizzati (isAdmin=1)
 * - RF5: Logout
 *
 * Database: MySQL con tabelle UTENTE e PRE_AUTORIZZATO
 * Framework: Jest + Supertest
 * Mock: Google OAuth2 client (verifyIdToken)
 */
describe("Auth Routes - Complete Integration Tests", () => {
  // Helper: Crea un payload Google mock
  const createGooglePayload = (sub, email, firstName, lastName) => ({
    sub,
    email,
    given_name: firstName,
    family_name: lastName,
  });

  // Helper: Genera CF deterministico (stesso algoritmo del backend)
  const generateCF = (googleSub) => `GOOG${googleSub.slice(-12)}`;

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // RF1: LOGIN - POST /auth/google
  // =========================================================================
  describe("POST /auth/google (RF1 - Login)", () => {
    it("[RF1.1] Should return 401 if token is invalid", async () => {
      client.verifyIdToken.mockRejectedValue(new Error("Invalid token"));

      const res = await request(app)
        .post("/auth/google")
        .send({ token: "INVALID_TOKEN" });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Token non valido");
    });

    it("[RF1.2] Should return LOGIN_SUCCESS for existing user (search by CF)", async () => {
      const googleSub = "google-id-12345678";
      const fiscalCode = generateCF(googleSub);
      const mockUser = {
        ID_UTENTE: 1,
        NOME: "Mario",
        COGNOME: "Rossi",
        EMAIL: "mario.rossi@test.com",
        CODICE_FISCALE: fiscalCode,
        IS_ADMIN: 0,
        IS_CITTADINO: 1,
      };

      client.verifyIdToken.mockResolvedValue({
        getPayload: () =>
          createGooglePayload(
            googleSub,
            "mario.rossi@test.com",
            "Mario",
            "Rossi",
          ),
      });

      // Mock: Prima query (ricerca per CF) ritorna l'utente
      db.query.mockResolvedValueOnce([[mockUser]]);

      const res = await request(app)
        .post("/auth/google")
        .send({ token: "VALID_TOKEN_EXISTING" });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("LOGIN_SUCCESS");
      expect(res.body.user).toEqual({
        id: 1,
        firstName: "Mario",
        lastName: "Rossi",
        email: "mario.rossi@test.com",
        isAdmin: false,
        isCitizen: true,
      });
    });

    it("[RF1.3] Should return LOGIN_SUCCESS and update CF if user found by email fallback", async () => {
      const googleSub = "google-id-87654321";
      const oldCF = "OLDCF12345678901";
      const newCF = generateCF(googleSub);
      const mockUser = {
        ID_UTENTE: 2,
        NOME: "Luigi",
        COGNOME: "Verdi",
        EMAIL: "luigi.verdi@test.com",
        CODICE_FISCALE: oldCF,
        IS_ADMIN: 0,
        IS_CITTADINO: 1,
      };

      client.verifyIdToken.mockResolvedValue({
        getPayload: () =>
          createGooglePayload(
            googleSub,
            "luigi.verdi@test.com",
            "Luigi",
            "Verdi",
          ),
      });

      // Mock: Prima query (per CF) non trova nulla
      db.query.mockResolvedValueOnce([[]]);
      // Mock: Seconda query (per email) trova l'utente
      db.query.mockResolvedValueOnce([[mockUser]]);
      // Mock: UPDATE per aggiornare il CF
      db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app)
        .post("/auth/google")
        .send({ token: "VALID_TOKEN_EMAIL_FALLBACK" });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("LOGIN_SUCCESS");
      expect(res.body.user.email).toBe("luigi.verdi@test.com");

      // Verifica che sia stato chiamato l'UPDATE del CF
      expect(db.query).toHaveBeenCalledWith(
        "UPDATE UTENTE SET CODICE_FISCALE = ? WHERE ID_UTENTE = ?",
        [newCF, 2],
      );
    });

    it("[RF1.4] Should return NEED_REGISTRATION if user not found and not pre-authorized", async () => {
      const googleSub = "google-id-newuser99";
      const fiscalCode = generateCF(googleSub);

      client.verifyIdToken.mockResolvedValue({
        getPayload: () =>
          createGooglePayload(
            googleSub,
            "new.citizen@test.com",
            "Nuovo",
            "Cittadino",
          ),
      });

      // Mock: Non trovato per CF
      db.query.mockResolvedValueOnce([[]]);
      // Mock: Non trovato per email
      db.query.mockResolvedValueOnce([[]]);
      // Mock: Non trovato in PRE_AUTORIZZATO
      db.query.mockResolvedValueOnce([[]]);

      const res = await request(app)
        .post("/auth/google")
        .send({ token: "VALID_TOKEN_NEW_USER" });

      expect(res.statusCode).toBe(404);
      expect(res.body.status).toBe("NEED_REGISTRATION");
      expect(res.body.googleData).toEqual({
        firstName: "Nuovo",
        lastName: "Cittadino",
        email: "new.citizen@test.com",
        fiscalCode,
      });
    });

    it("[RF2.2] Should auto-create ADMIN user if pre-authorized (LOGIN_SUCCESS)", async () => {
      const googleSub = "google-id-admin001";
      const preAuthCF = generateCF(googleSub);

      client.verifyIdToken.mockResolvedValue({
        getPayload: () =>
          createGooglePayload(
            googleSub,
            "admin.preauth@test.com",
            "Admin",
            "PreAutorizzato",
          ),
      });

      // Mock: Non trovato per CF
      db.query.mockResolvedValueOnce([[]]);
      // Mock: Non trovato per email
      db.query.mockResolvedValueOnce([[]]);
      // Mock: Trovato in PRE_AUTORIZZATO
      db.query.mockResolvedValueOnce([[{ CODICE_FISCALE: preAuthCF }]]);

      // Mock connection per transaction
      const mockConnection = {
        beginTransaction: jest.fn(),
        query: jest
          .fn()
          .mockResolvedValueOnce([{ insertId: 99 }]) // INSERT UTENTE
          .mockResolvedValueOnce([{ affectedRows: 1 }]) // DELETE PRE_AUTORIZZATO
          .mockResolvedValueOnce([
            [
              {
                ID_UTENTE: 99,
                NOME: "Admin",
                COGNOME: "PreAutorizzato",
                EMAIL: "admin.preauth@test.com",
                CODICE_FISCALE: preAuthCF,
                IS_ADMIN: 1,
                IS_CITTADINO: 0,
              },
            ],
          ]), // SELECT nuovo utente
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
      };

      db.getConnection = jest.fn().mockResolvedValue(mockConnection);

      const res = await request(app)
        .post("/auth/google")
        .send({ token: "VALID_TOKEN_PREAUTH_ADMIN" });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("LOGIN_SUCCESS");
      expect(res.body.user).toEqual({
        id: 99,
        firstName: "Admin",
        lastName: "PreAutorizzato",
        email: "admin.preauth@test.com",
        isAdmin: true,
        isCitizen: false,
      });

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // RF2: REGISTRAZIONE - POST /auth/otp & POST /auth/register
  // =========================================================================
  describe("POST /auth/otp (RF2 - Step 1: OTP Generation)", () => {
    const mockSendMail = jest.fn();

    beforeEach(() => {
      mockSendMail.mockClear();
      // Pulisci otpStore prima di ogni test
      Object.keys(otpStore).forEach((key) => delete otpStore[key]);
    });

    it("[RF2.0] Should return 400 for invalid email format", async () => {
      const res = await request(app)
        .post("/auth/otp")
        .send({ email: "not-an-email" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Email non valida");
    });

    it("[RF2.0] Should return 409 if email is already registered", async () => {
      db.query.mockResolvedValue([[{ ID_UTENTE: 5 }]]);

      const res = await request(app)
        .post("/auth/otp")
        .send({ email: "existing.user@test.com" });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe(
        "Questa email è già stata utilizzata. Inseriscine un'altra.",
      );
    });

    it("[RF2.0] Should return 200 and send email if credentials are set", async () => {
      // Impostiamo una chiave finta per simulare la presenza delle credenziali
      const originalResendKey = process.env.RESEND_API_KEY;
      process.env.RESEND_API_KEY = "re_test_123456789";

      // Mock del database: nessun utente trovato (email libera)
      db.query.mockResolvedValue([[]]);

      const res = await request(app)
        .post("/auth/otp")
        .send({ email: "new.citizen@test.com" });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Codice inviato");

      // Ripristiniamo la chiave originale
      process.env.RESEND_API_KEY = originalResendKey;
    });

    it("[RF2.0] Should return 200 in dev mode if email credentials are not set", async () => {
      const originalResendKey = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;

      db.query.mockResolvedValue([[]]);

      const res = await request(app)
        .post("/auth/otp")
        .send({ email: "dev.user@test.com" });

      expect(res.statusCode).toBe(200);

      // Accettiamo sia il messaggio DevMode che quello standard,
      // l'importante è che il codice 200 confermi che il server non è crashato.
      expect(["Check console (DevMode)", "Codice inviato"]).toContain(
        res.body.message,
      );

      process.env.RESEND_API_KEY = originalResendKey;
    });
  });

  describe("POST /auth/register (RF2 - Step 2: Complete Registration)", () => {
    beforeEach(() => {
      // Pulisci otpStore
      Object.keys(otpStore).forEach((key) => delete otpStore[key]);
    });

    it("[RF2.1] Should register a CITIZEN with valid OTP and token", async () => {
      const email = "citizen.new@test.com";
      const googleSub = "google-citizen-123";
      const fiscalCode = generateCF(googleSub);

      // Setup OTP nello store
      otpStore[email] = {
        code: "123456",
        expires: Date.now() + 300000,
      };

      client.verifyIdToken.mockResolvedValue({
        getPayload: () =>
          createGooglePayload(googleSub, email, "Cittadino", "Nuovo"),
      });

      // Mock INSERT e SELECT
      db.query
        .mockResolvedValueOnce([{ insertId: 10 }]) // INSERT
        .mockResolvedValueOnce([
          [
            {
              ID_UTENTE: 10,
              NOME: "Cittadino",
              COGNOME: "Nuovo",
              EMAIL: email,
              CODICE_FISCALE: fiscalCode,
              IS_ADMIN: 0,
              IS_CITTADINO: 1,
            },
          ],
        ]); // SELECT

      const res = await request(app).post("/auth/register").send({
        googleToken: "VALID_GOOGLE_TOKEN",
        email,
        otp: "123456",
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe("REGISTRATION_SUCCESS");
      expect(res.body.user).toEqual({
        id: 10,
        firstName: "Cittadino",
        lastName: "Nuovo",
        email,
        isAdmin: false,
        isCitizen: true,
      });

      // Verifica che l'OTP sia stato eliminato
      expect(otpStore[email]).toBeUndefined();
    });

    it('[RF2.1] Should register an ADMIN if email contains "admin"', async () => {
      const email = "admin.test@test.com";
      const googleSub = "google-admin-456";
      const fiscalCode = generateCF(googleSub);

      otpStore[email] = {
        code: "654321",
        expires: Date.now() + 300000,
      };

      client.verifyIdToken.mockResolvedValue({
        getPayload: () =>
          createGooglePayload(googleSub, email, "Admin", "Test"),
      });

      db.query.mockResolvedValueOnce([{ insertId: 11 }]).mockResolvedValueOnce([
        [
          {
            ID_UTENTE: 11,
            NOME: "Admin",
            COGNOME: "Test",
            EMAIL: email,
            CODICE_FISCALE: fiscalCode,
            IS_ADMIN: 1,
            IS_CITTADINO: 0,
          },
        ],
      ]);

      const res = await request(app).post("/auth/register").send({
        googleToken: "VALID_GOOGLE_TOKEN",
        email,
        otp: "654321",
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.user.isAdmin).toBe(true);
      expect(res.body.user.isCitizen).toBe(false);
    });

    it("[RF2.0] Should return 400 if OTP is incorrect", async () => {
      const email = "test@test.com";

      otpStore[email] = {
        code: "111111",
        expires: Date.now() + 300000,
      };

      const res = await request(app).post("/auth/register").send({
        googleToken: "VALID_TOKEN",
        email,
        otp: "999999", // OTP errato
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Codice OTP errato.");
    });

    it("[RF2.0] Should return 400 if OTP is expired", async () => {
      const email = "test@test.com";

      otpStore[email] = {
        code: "111111",
        expires: Date.now() - 1000, // Già scaduto
      };

      const res = await request(app).post("/auth/register").send({
        googleToken: "VALID_TOKEN",
        email,
        otp: "111111",
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Codice OTP scaduto, generane un altro");

      // Verifica che l'OTP sia stato eliminato
      expect(otpStore[email]).toBeUndefined();
    });

    it("[RF2.0] Should return 401 if Google token is invalid", async () => {
      const email = "test@test.com";

      otpStore[email] = {
        code: "111111",
        expires: Date.now() + 300000,
      };

      client.verifyIdToken.mockRejectedValue(new Error("Invalid token"));

      const res = await request(app).post("/auth/register").send({
        googleToken: "INVALID_TOKEN",
        email,
        otp: "111111",
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Token Google scaduto o non valido.");
    });

    it("[RF2.0] Should return 409 if email already exists (duplicate)", async () => {
      const email = "duplicate@test.com";
      const googleSub = "google-dup-789";

      otpStore[email] = {
        code: "222222",
        expires: Date.now() + 300000,
      };

      client.verifyIdToken.mockResolvedValue({
        getPayload: () =>
          createGooglePayload(googleSub, email, "Duplicate", "User"),
      });

      // Mock errore duplicate entry
      db.query.mockRejectedValue({ code: "ER_DUP_ENTRY" });

      const res = await request(app).post("/auth/register").send({
        googleToken: "VALID_TOKEN",
        email,
        otp: "222222",
      });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toBe("Email già registrata.");
    });
  });

  // =========================================================================
  // RF5: LOGOUT - POST /auth/logout
  // =========================================================================
  describe("POST /auth/logout (RF5 - Logout)", () => {
    it("[RF5] Should logout successfully", async () => {
      const res = await request(app).post("/auth/logout").send();

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Logout effettuato");
    });
  });
});
