const request = require('supertest');
const express = require('express');
const authRoutes = require('../../src/routes/auth');
const db = require('../../src/config/db');
const { client } = require('../../src/utils/authUtils');
const nodemailer = require('nodemailer');

// Mock dependencies
jest.mock('../../src/config/db');
jest.mock('../../src/utils/authUtils', () => ({
  ...jest.requireActual('../../src/utils/authUtils'), // import and retain default behavior
  client: {
    verifyIdToken: jest.fn(),
  },
}));
jest.mock('nodemailer');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/google-login', () => {
    it('should return 401 if token is invalid', async () => {
      client.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

      const res = await request(app)
        .post('/auth/google-login')
        .send({ token: 'invalid-token' });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Token non valido');
    });

    it('should return LOGIN_SUCCESS if user exists', async () => {
      const mockUser = {
        ID_UTENTE: 1,
        NOME: 'Test',
        COGNOME: 'User',
        EMAIL: 'test.user@example.com',
        IS_ADMIN: 0,
        IS_CITTADINO: 1,
        CODICE_FISCALE: 'TSTUSR00A01H501A',
      };

      client.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-id-123',
          email: 'test.user@example.com',
          given_name: 'Test',
          family_name: 'User',
        }),
      });

      db.query.mockResolvedValue([[mockUser]]);

      const res = await request(app)
        .post('/auth/google-login')
        .send({ token: 'valid-token' });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('LOGIN_SUCCESS');
      expect(res.body.user).toEqual({
        id: mockUser.ID_UTENTE,
        firstName: mockUser.NOME,
        lastName: mockUser.COGNOME,
        email: mockUser.EMAIL,
        isAdmin: false,
        isCitizen: true,
      });
    });

    it('should return NEED_REGISTRATION if user does not exist', async () => {
      client.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-id-456',
          email: 'new.user@example.com',
          given_name: 'New',
          family_name: 'User',
        }),
      });

      db.query.mockResolvedValue([[]]); // No user found

      const res = await request(app)
        .post('/auth/google-login')
        .send({ token: 'valid-token-new-user' });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('NEED_REGISTRATION');
      expect(res.body.googleData).toBeDefined();
      expect(res.body.googleData.email).toBe('new.user@example.com');
      expect(res.body.googleData.fiscalCode).toBeDefined();
    });
  });

    describe('POST /auth/send-otp', () => {
      const mockSendMail = jest.fn();
  
      beforeEach(() => {
          mockSendMail.mockClear();
      });
  
      it('should return 400 for an invalid email', async () => {
          const res = await request(app)
              .post('/auth/send-otp')
              .send({ email: 'not-an-email' });
  
          expect(res.statusCode).toBe(400);
          expect(res.body.message).toBe('Email non valida');
      });
  
      it('should return 409 if email is already registered', async () => {
          db.query.mockResolvedValue([[{ ID_UTENTE: 2 }]]);
  
          const res = await request(app)
              .post('/auth/send-otp')
              .send({ email: 'existing.user@example.com' });
  
          expect(res.statusCode).toBe(409);
          expect(res.body.message).toBe('Questa email è già stata utilizzata. Inseriscine un\'altra.');
      });
  
      it('should return 200 and send an email if creds are set', async () => {
          process.env.MAIL_USER = 'test@gmail.com';
          process.env.MAIL_PASS = 'password';
          nodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail.mockResolvedValue({}) });
  
          db.query.mockResolvedValue([[]]); 
  
          const res = await request(app)
              .post('/auth/send-otp')
              .send({ email: 'new.user@example.com' });
      
          expect(res.statusCode).toBe(200);
          expect(res.body.message).toBe('Codice inviato');
  
          delete process.env.MAIL_USER;
          delete process.env.MAIL_PASS;
      });
  
      it('should return 200 in dev mode if email creds are not set', async () => {
          nodemailer.createTransport.mockReturnValue(null);
          db.query.mockResolvedValue([[]]);
    
          const res = await request(app)
              .post('/auth/send-otp')
              .send({ email: 'dev.user@example.com' });
    
          expect(res.statusCode).toBe(200);
          expect(res.body.message).toBe('Check console (DevMode)');
          expect(res.body.devMode).toBe(true);
        });
    });
  describe('POST /auth/logout', () => {
    it('should return 200 and a success message', async () => {
      const res = await request(app)
        .post('/auth/logout')
        .send();

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Logout effettuato');
    });
  });
});