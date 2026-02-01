const request = require('supertest');

// ========== MOCK AUTH (identico a initiatives.test.js) ==========
let mockActiveUser = null;
jest.mock('../../src/middleware/authMiddleware', () => {
  const mockMiddleware = (req, res, next) => {
    if (!mockActiveUser) {
      return res.status(401).json({ message: 'Accesso negato. Autenticazione mancante.' });
    }
    req.user = mockActiveUser;
    next();
  };
  mockMiddleware.checkAuth = mockMiddleware;
  mockMiddleware.verifyToken = mockMiddleware;
  mockMiddleware.default = mockMiddleware;
  mockMiddleware.isAdmin = (req, res, next) => {
    if (req.user && req.user.isAdmin) next();
    else res.status(403).json({ message: "Richiede privilegi admin" });
  };
  mockMiddleware.checkAdmin = mockMiddleware.isAdmin;
  return mockMiddleware;
});

const app = require('../../src/app');
const db = require('../../src/config/db');

// ========== ID UTENTI MOCK ==========
const mockCitizenId = 9001;
const mockAdminId = 9002;
const mockCitizen2Id = 9003; // Secondo cittadino per test aggiuntivi

afterEach(() => {
  mockActiveUser = null;
});

// ========== HELPER: Calcolo Date ==========
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
}

// ========== TEST SUITE PRINCIPALE ==========
describe('API /participatory-budgets (Bilancio Partecipativo - RF8, RF9, RF15)', () => {

  beforeAll(async () => {
    // Pulizia delle tabelle in ordine corretto (rispettando le FK)
    await db.query("SET FOREIGN_KEY_CHECKS = 0;");
    await db.query('DELETE FROM VOTI_BILANCIO WHERE ID_UTENTE IN (?, ?, ?)', [mockCitizenId, mockAdminId, mockCitizen2Id]);
    await db.query('DELETE FROM OPZIONI_BILANCIO WHERE ID_BIL IN (SELECT ID_BIL FROM BILANCIO_PARTECIPATIVO WHERE ID_CREATOR IN (?, ?))', [mockAdminId, mockCitizenId]);
    await db.query('DELETE FROM BILANCIO_PARTECIPATIVO WHERE ID_CREATOR IN (?, ?)', [mockAdminId, mockCitizenId]);
    await db.query('DELETE FROM UTENTE WHERE ID_UTENTE IN (?, ?, ?)', [mockCitizenId, mockAdminId, mockCitizen2Id]);
    await db.query("SET FOREIGN_KEY_CHECKS = 1;");

    // Creazione utenti di test
    await db.query(`
      INSERT INTO UTENTE (ID_UTENTE, NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_ADMIN, IS_CITTADINO) 
      VALUES (?, 'Test', 'Citizen', 'TESTCF00000001A', 'pbcitizen@test.com', 0, 1)
    `, [mockCitizenId]);

    await db.query(`
      INSERT INTO UTENTE (ID_UTENTE, NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_ADMIN, IS_CITTADINO) 
      VALUES (?, 'Test', 'Admin', 'TESTADM0000001A', 'pbadmin@test.com', 1, 0)
    `, [mockAdminId]);

    await db.query(`
      INSERT INTO UTENTE (ID_UTENTE, NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_ADMIN, IS_CITTADINO) 
      VALUES (?, 'Test', 'Citizen2', 'TESTCF00000002A', 'pbcitizen2@test.com', 0, 1)
    `, [mockCitizen2Id]);
  });

  afterAll(async () => {
    // Pulizia finale
    await db.query('DELETE FROM VOTI_BILANCIO WHERE ID_UTENTE IN (?, ?, ?)', [mockCitizenId, mockAdminId, mockCitizen2Id]);
    await db.query('DELETE FROM OPZIONI_BILANCIO WHERE ID_BIL IN (SELECT ID_BIL FROM BILANCIO_PARTECIPATIVO WHERE ID_CREATOR IN (?, ?))', [mockAdminId, mockCitizenId]);
    await db.query('DELETE FROM BILANCIO_PARTECIPATIVO WHERE ID_CREATOR IN (?, ?)', [mockAdminId, mockCitizenId]);
    await db.query('DELETE FROM UTENTE WHERE ID_UTENTE IN (?, ?, ?)', [mockCitizenId, mockAdminId, mockCitizen2Id]);
    
    if (db && db.end) await db.end();
  });

  // ========== CREAZIONE BILANCIO (RF8) ==========
  describe('POST /participatory-budgets (Creazione Bilancio - RF8)', () => {

    beforeEach(async () => {
      // Pulizia prima di ogni test di creazione
      await db.query('DELETE FROM VOTI_BILANCIO WHERE ID_UTENTE IN (?, ?, ?)', [mockCitizenId, mockAdminId, mockCitizen2Id]);
      await db.query('DELETE FROM OPZIONI_BILANCIO WHERE ID_BIL IN (SELECT ID_BIL FROM BILANCIO_PARTECIPATIVO WHERE ID_CREATOR = ?)', [mockAdminId]);
      await db.query('DELETE FROM BILANCIO_PARTECIPATIVO WHERE ID_CREATOR = ?', [mockAdminId]);
    });

    it('✅ Admin crea bilancio valido con 3 opzioni (scadenza 20 giorni)', async () => {
      mockActiveUser = { id: mockAdminId, isAdmin: true };

      const expirationDate = addDays(new Date(), 20);
      const payload = {
        title: 'Bilancio Test 2026',
        expirationDate,
        options: [
          { text: 'Opzione A - Parco Verde', position: 1 },
          { text: 'Opzione B - Biblioteca Digitale', position: 2 },
          { text: 'Opzione C - Pista Ciclabile', position: 3 }
        ]
      };

      const res = await request(app)
        .post('/participatory-budgets')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe(payload.title);
      expect(res.body.creatorId).toBe(mockAdminId);
      expect(res.body.options).toHaveLength(3);
      expect(res.body.options[0]).toHaveProperty('position');
    });

    it('❌ Cittadino tenta di creare bilancio (403 Forbidden)', async () => {
      mockActiveUser = { id: mockCitizenId, isAdmin: false };

      const expirationDate = addDays(new Date(), 20);
      const payload = {
        title: 'Tentativo Cittadino',
        expirationDate,
        options: [
          { text: 'Opzione 1', position: 1 },
          { text: 'Opzione 2', position: 2 },
          { text: 'Opzione 3', position: 3 }
        ]
      };

      const res = await request(app)
        .post('/participatory-budgets')
        .send(payload);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('admin');
    });

    it('❌ Durata insufficiente: scadenza tra 5 giorni (< 14 giorni)', async () => {
      mockActiveUser = { id: mockAdminId, isAdmin: true };

      const expirationDate = addDays(new Date(), 5);
      const payload = {
        title: 'Bilancio Troppo Breve',
        expirationDate,
        options: [
          { text: 'Opzione 1', position: 1 },
          { text: 'Opzione 2', position: 2 },
          { text: 'Opzione 3', position: 3 }
        ]
      };

      const res = await request(app)
        .post('/participatory-budgets')
        .send(payload);

      expect([400, 422]).toContain(res.status);
      expect(res.body.message || res.body.details).toBeDefined();
    });

    it('❌ Validazione opzioni: 1 sola opzione (minimo 2)', async () => {
      mockActiveUser = { id: mockAdminId, isAdmin: true };

      const expirationDate = addDays(new Date(), 20);
      const payload = {
        title: 'Bilancio con 1 opzione',
        expirationDate,
        options: [
          { text: 'Unica Opzione', position: 1 }
        ]
      };

      const res = await request(app)
        .post('/participatory-budgets')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.details).toBeDefined();
    });

    it('❌ Validazione opzioni: 6 opzioni (massimo 5)', async () => {
      mockActiveUser = { id: mockAdminId, isAdmin: true };

      const expirationDate = addDays(new Date(), 20);
      const payload = {
        title: 'Bilancio con 6 opzioni',
        expirationDate,
        options: [
          { text: 'Opzione 1', position: 1 },
          { text: 'Opzione 2', position: 2 },
          { text: 'Opzione 3', position: 3 },
          { text: 'Opzione 4', position: 4 },
          { text: 'Opzione 5', position: 5 },
          { text: 'Opzione 6', position: 6 }
        ]
      };

      const res = await request(app)
        .post('/participatory-budgets')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message || res.body.details).toBeDefined();
    });

    it('❌ Conflitto: tentativo di creare secondo bilancio mentre uno è attivo (409)', async () => {
      mockActiveUser = { id: mockAdminId, isAdmin: true };

      // Crea primo bilancio attivo
      const expirationDate = addDays(new Date(), 20);
      const firstPayload = {
        title: 'Bilancio Attivo 1',
        expirationDate,
        options: [
          { text: 'Opzione A', position: 1 },
          { text: 'Opzione B', position: 2 },
          { text: 'Opzione C', position: 3 }
        ]
      };

      const res1 = await request(app)
        .post('/participatory-budgets')
        .send(firstPayload);
      expect(res1.status).toBe(201);

      // Tenta di crearne un secondo
      const secondPayload = {
        title: 'Bilancio Attivo 2',
        expirationDate: addDays(new Date(), 25),
        options: [
          { text: 'Opzione X', position: 1 },
          { text: 'Opzione Y', position: 2 },
          { text: 'Opzione Z', position: 3 }
        ]
      };

      const res2 = await request(app)
        .post('/participatory-budgets')
        .send(secondPayload);

      expect(res2.status).toBe(409);
      expect(res2.body.message).toContain('attivo');
    });

  });

  // ========== CONSULTAZIONE BILANCIO ATTIVO ==========
  describe('GET /participatory-budgets/active (Consultazione Bilancio Attivo)', () => {

    let activeBudgetId;

    beforeAll(async () => {
      // Pulizia
      await db.query('DELETE FROM VOTI_BILANCIO WHERE ID_UTENTE IN (?, ?, ?)', [mockCitizenId, mockAdminId, mockCitizen2Id]);
      await db.query('DELETE FROM OPZIONI_BILANCIO WHERE ID_BIL IN (SELECT ID_BIL FROM BILANCIO_PARTECIPATIVO WHERE ID_CREATOR = ?)', [mockAdminId]);
      await db.query('DELETE FROM BILANCIO_PARTECIPATIVO WHERE ID_CREATOR = ?', [mockAdminId]);

      // Crea un bilancio attivo di test
      mockActiveUser = { id: mockAdminId, isAdmin: true };

      const expirationDate = addDays(new Date(), 30);
      const payload = {
        title: 'Bilancio Consultabile',
        expirationDate,
        options: [
          { text: 'Progetto A', position: 1 },
          { text: 'Progetto B', position: 2 },
          { text: 'Progetto C', position: 3 }
        ]
      };

      const res = await request(app)
        .post('/participatory-budgets')
        .send(payload);

      activeBudgetId = res.body.id;
      mockActiveUser = null;
    });

    it('✅ Restituisce il bilancio attivo con tutte le opzioni', async () => {
      const res = await request(app).get('/participatory-budgets/active');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(activeBudgetId);
      expect(res.body.data.title).toBe('Bilancio Consultabile');
      expect(res.body.data.options).toHaveLength(3);
      expect(res.body.data.votedOptionId).toBeNull();
    });

    it('✅ Mostra votedOptionId se l\'utente ha già votato', async () => {
      mockActiveUser = { id: mockCitizenId, isAdmin: false };

      // Prima vota
      await request(app)
        .post(`/participatory-budgets/${activeBudgetId}/votes`)
        .send({ position: 2 });

      // Poi consulta (GET è pubblico, quindi uso l'header X-Mock-User-Id)
      const res = await request(app)
        .get('/participatory-budgets/active')
        .set('X-Mock-User-Id', mockCitizenId);

      expect(res.status).toBe(200);
      expect(res.body.data.votedOptionId).toBe(2);
    });

    it('✅ Nessun bilancio attivo: restituisce null o 200 con data: null', async () => {
      // Elimina temporaneamente il bilancio
      await db.query('DELETE FROM VOTI_BILANCIO WHERE ID_BIL = ?', [activeBudgetId]);
      await db.query('DELETE FROM OPZIONI_BILANCIO WHERE ID_BIL = ?', [activeBudgetId]);
      await db.query('DELETE FROM BILANCIO_PARTECIPATIVO WHERE ID_BIL = ?', [activeBudgetId]);

      const res = await request(app).get('/participatory-budgets/active');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
      expect(res.body.message).toContain('Nessun bilancio attivo');
    });

  });

  // ========== VOTAZIONE (RF15) ==========
  describe('POST /participatory-budgets/:id/votes (Votazione - RF15)', () => {

    let budgetForVoting;

    beforeAll(async () => {
      // Pulizia
      await db.query('DELETE FROM VOTI_BILANCIO WHERE ID_UTENTE IN (?, ?, ?)', [mockCitizenId, mockAdminId, mockCitizen2Id]);
      await db.query('DELETE FROM OPZIONI_BILANCIO WHERE ID_BIL IN (SELECT ID_BIL FROM BILANCIO_PARTECIPATIVO WHERE ID_CREATOR = ?)', [mockAdminId]);
      await db.query('DELETE FROM BILANCIO_PARTECIPATIVO WHERE ID_CREATOR = ?', [mockAdminId]);

      // Crea bilancio per votazioni
      mockActiveUser = { id: mockAdminId, isAdmin: true };

      const expirationDate = addDays(new Date(), 25);
      const payload = {
        title: 'Bilancio Votazioni Test',
        expirationDate,
        options: [
          { text: 'Opzione Voto 1', position: 1 },
          { text: 'Opzione Voto 2', position: 2 },
          { text: 'Opzione Voto 3', position: 3 }
        ]
      };

      const res = await request(app)
        .post('/participatory-budgets')
        .send(payload);

      budgetForVoting = res.body;
      mockActiveUser = null;
    });

    it('✅ Cittadino vota con successo un\'opzione valida (200)', async () => {
      mockActiveUser = { id: mockCitizen2Id, isAdmin: false };

      const res = await request(app)
        .post(`/participatory-budgets/${budgetForVoting.id}/votes`)
        .send({ position: 1 });

      expect(res.status).toBe(200);
      expect(res.body.votedOptionId).toBe(1);
      expect(res.body.id).toBe(budgetForVoting.id);
    });

    it('❌ Cittadino tenta di votare due volte (409 Conflict)', async () => {
      mockActiveUser = { id: mockCitizenId, isAdmin: false };

      // Primo voto
      const res1 = await request(app)
        .post(`/participatory-budgets/${budgetForVoting.id}/votes`)
        .send({ position: 2 });
      expect(res1.status).toBe(200);

      // Secondo voto (duplicato)
      const res2 = await request(app)
        .post(`/participatory-budgets/${budgetForVoting.id}/votes`)
        .send({ position: 3 });

      expect(res2.status).toBe(409);
      expect(res2.body.message).toContain('già votato');
    });

    it('❌ Admin tenta di votare (403 Forbidden - solo cittadini)', async () => {
      mockActiveUser = { id: mockAdminId, isAdmin: true };

      const res = await request(app)
        .post(`/participatory-budgets/${budgetForVoting.id}/votes`)
        .send({ position: 1 });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('cittadini');
    });

    it('❌ Voto su bilancio scaduto (403 Forbidden)', async () => {
      mockActiveUser = { id: mockAdminId, isAdmin: true };

      // Crea bilancio scaduto (ieri)
      const expiredDate = addDays(new Date(), -1);
      const expiredPayload = {
        title: 'Bilancio Scaduto',
        expirationDate: expiredDate,
        options: [
          { text: 'Opt 1', position: 1 },
          { text: 'Opt 2', position: 2 },
          { text: 'Opt 3', position: 3 }
        ]
      };

      // Bypass validazione per test (inserimento diretto se necessario)
      // Oppure uso data passata a livello DB
      const [result] = await db.query(
        'INSERT INTO BILANCIO_PARTECIPATIVO (ID_CREATOR, TITOLO, DATA_SCADENZA) VALUES (?, ?, ?)',
        [mockAdminId, expiredPayload.title, expiredDate]
      );
      const expiredId = result.insertId;

      await db.query(
        'INSERT INTO OPZIONI_BILANCIO (ID_BIL, TEXT, POSITION) VALUES (?, ?, ?)',
        [expiredId, 'Opt 1', 1]
      );

      // Tentativo di voto da cittadino
      mockActiveUser = { id: mockCitizenId, isAdmin: false };

      const res = await request(app)
        .post(`/participatory-budgets/${expiredId}/votes`)
        .send({ position: 1 });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('scaduto');
    });

    it('❌ Tentativo di votare opzione inesistente (400 Bad Request)', async () => {
      mockActiveUser = { id: mockCitizen2Id, isAdmin: false };

      const res = await request(app)
        .post(`/participatory-budgets/${budgetForVoting.id}/votes`)
        .send({ position: 99 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('non esiste');
    });

    it('❌ Voto su bilancio inesistente (404 Not Found)', async () => {
      mockActiveUser = { id: mockCitizenId, isAdmin: false };

      const res = await request(app)
        .post('/participatory-budgets/999999/votes')
        .send({ position: 1 });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('non trovato');
    });

  });

  // ========== ARCHIVIO (RF9) ==========
  describe('GET /participatory-budgets (Archivio Storico - RF9)', () => {

    beforeAll(async () => {
      // Pulizia
      await db.query('DELETE FROM VOTI_BILANCIO WHERE ID_UTENTE IN (?, ?, ?)', [mockCitizenId, mockAdminId, mockCitizen2Id]);
      await db.query('DELETE FROM OPZIONI_BILANCIO WHERE ID_BIL IN (SELECT ID_BIL FROM BILANCIO_PARTECIPATIVO WHERE ID_CREATOR = ?)', [mockAdminId]);
      await db.query('DELETE FROM BILANCIO_PARTECIPATIVO WHERE ID_CREATOR = ?', [mockAdminId]);

      // Crea 3 bilanci scaduti per test archivio
      for (let i = 1; i <= 3; i++) {
        const pastDate = addDays(new Date(), -10 * i);
        const [res] = await db.query(
          'INSERT INTO BILANCIO_PARTECIPATIVO (ID_CREATOR, TITOLO, DATA_SCADENZA) VALUES (?, ?, ?)',
          [mockAdminId, `Bilancio Storico ${i}`, pastDate]
        );

        const budgetId = res.insertId;
        await db.query(
          'INSERT INTO OPZIONI_BILANCIO (ID_BIL, TEXT, POSITION) VALUES (?, ?, ?)',
          [budgetId, `Opzione A`, 1]
        );
        await db.query(
          'INSERT INTO OPZIONI_BILANCIO (ID_BIL, TEXT, POSITION) VALUES (?, ?, ?)',
          [budgetId, `Opzione B`, 2]
        );
      }
    });

    it('✅ Admin recupera lista bilanci scaduti con paginazione', async () => {
      mockActiveUser = { id: mockAdminId, isAdmin: true };

      const res = await request(app)
        .get('/participatory-budgets')
        .query({ currentPage: 1, objectsPerPage: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta).toHaveProperty('currentPage');
      expect(res.body.meta).toHaveProperty('totalObjects');
    });

    it('✅ Paginazione: recupera solo 2 elementi per pagina', async () => {
      mockActiveUser = { id: mockAdminId, isAdmin: true };

      const res = await request(app)
        .get('/participatory-budgets')
        .query({ currentPage: 1, objectsPerPage: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.meta.objectsPerPage).toBe(2);
    });

    it('❌ Cittadino tenta di accedere all\'archivio (403 Forbidden)', async () => {
      mockActiveUser = { id: mockCitizenId, isAdmin: false };

      const res = await request(app)
        .get('/participatory-budgets');

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('amministratori');
    });

    it('✅ Archivio include conteggio voti per ogni opzione', async () => {
      mockActiveUser = { id: mockAdminId, isAdmin: true };

      const res = await request(app)
        .get('/participatory-budgets')
        .query({ currentPage: 1, objectsPerPage: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data[0].options).toBeDefined();
      expect(res.body.data[0].options[0]).toHaveProperty('votes');
    });

  });

});
