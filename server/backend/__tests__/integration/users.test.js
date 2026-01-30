// backend/__tests__/integration/users.test.js

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');

describe('API /users (Integration)', () => {
    let mockCitizenId;
    let mockAdminId;
    let mockCitizenToPromoteId;
    let createdInitiativeId;
    let signedInitiativeId;
    let followedInitiativeId;

    beforeAll(async () => {
        // Pulisce e popola il database per i test
        await db.query("SET FOREIGN_KEY_CHECKS = 0;");
        await db.query("TRUNCATE TABLE FIRMA_INIZIATIVA;");
        await db.query("TRUNCATE TABLE INIZIATIVA_SALVATA;");
        await db.query("TRUNCATE TABLE INIZIATIVA;");
        await db.query("TRUNCATE TABLE UTENTE;");
        await db.query("TRUNCATE TABLE CATEGORIA;");
        await db.query("TRUNCATE TABLE PRE_AUTORIZZATO;");
        await db.query("SET FOREIGN_KEY_CHECKS = 1;");

        // Popolamento Utenti
        const [citizenResult] = await db.query("INSERT INTO UTENTE (NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_CITTADINO, IS_ADMIN) VALUES ('Citizen', 'Test', 'CITTST01XX', 'citizen@test.com', 1, 0)");
        mockCitizenId = citizenResult.insertId;

        const [adminResult] = await db.query("INSERT INTO UTENTE (NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_CITTADINO, IS_ADMIN) VALUES ('Admin', 'Test', 'ADMINTST01XX', 'admin@test.com', 0, 1)");
        mockAdminId = adminResult.insertId;

        const [citizenToPromoteResult] = await db.query("INSERT INTO UTENTE (NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_CITTADINO, IS_ADMIN) VALUES ('To', 'Promote', 'PROMOTETSTXX', 'promote@test.com', 1, 0)");
        mockCitizenToPromoteId = citizenToPromoteResult.insertId;

        // Popolamento dati per test dashboard
        await db.query("INSERT INTO CATEGORIA (ID_CATEGORIA, NOME) VALUES (1, 'Test Category')");
        
        const [createdInitiativeResult] = await db.query("INSERT INTO INIZIATIVA (TITOLO, DESCRIZIONE, ID_CATEGORIA, ID_AUTORE) VALUES ('My Created Initiative', 'Desc', 1, ?)", [mockCitizenId]);
        createdInitiativeId = createdInitiativeResult.insertId;

        const [signedInitiativeResult] = await db.query("INSERT INTO INIZIATIVA (TITOLO, DESCRIZIONE, ID_CATEGORIA, ID_AUTORE) VALUES ('My Signed Initiative', 'Desc', 1, ?)", [mockAdminId]);
        signedInitiativeId = signedInitiativeResult.insertId;
        await db.query("INSERT INTO FIRMA_INIZIATIVA (ID_UTENTE, ID_INIZIATIVA) VALUES (?, ?)", [mockCitizenId, signedInitiativeId]);

        const [followedInitiativeResult] = await db.query("INSERT INTO INIZIATIVA (TITOLO, DESCRIZIONE, ID_CATEGORIA, ID_AUTORE) VALUES ('My Followed Initiative', 'Desc', 1, ?)", [mockAdminId]);
        followedInitiativeId = followedInitiativeResult.insertId;
        await db.query("INSERT INTO INIZIATIVA_SALVATA (ID_UTENTE, ID_INIZIATIVA) VALUES (?, ?)", [mockCitizenId, followedInitiativeId]);
    });

    afterAll(async () => {
        if (db) await db.end();
    });

    /**
     * TEST: GET /users/me
     */
    describe('GET /users/me', () => {
        it('should return 401 if X-Mock-User-Id is missing', async () => {
            const response = await request(app).get('/users/me');
            expect(response.status).toBe(401);
        });

        it('should return 404 for a non-existent user', async () => {
            const response = await request(app).get('/users/me').set('X-Mock-User-Id', '99999');
            expect(response.status).toBe(404);
        });

        it('should return the correct user profile for a valid ID', async () => {
            const response = await request(app).get('/users/me').set('X-Mock-User-Id', mockCitizenId);
            expect(response.status).toBe(200);
            expect(response.body.id).toBe(mockCitizenId);
            expect(response.body.firstName).toBe('Citizen');
            expect(response.body.isCitizen).toBe(true);
            expect(response.body.isAdmin).toBe(false);
        });
    });

    /**
     * TEST: GET /users/me/initiatives (Dashboard)
     */
    describe('GET /users/me/initiatives', () => {
        it('should return 400 if relation parameter is missing', async () => {
            const response = await request(app).get('/users/me/initiatives').set('X-Mock-User-Id', mockCitizenId);
            expect(response.status).toBe(400);
        });

        it('should return initiatives created by the user', async () => {
            const response = await request(app)
                .get('/users/me/initiatives?relation=created')
                .set('X-Mock-User-Id', mockCitizenId);
            
            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].id).toBe(createdInitiativeId);
        });

        it('should return initiatives signed by the user', async () => {
            const response = await request(app)
                .get('/users/me/initiatives?relation=signed')
                .set('X-Mock-User-Id', mockCitizenId);

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].id).toBe(signedInitiativeId);
        });

        it('should return initiatives followed by the user', async () => {
            const response = await request(app)
                .get('/users/me/initiatives?relation=followed')
                .set('X-Mock-User-Id', mockCitizenId);

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].id).toBe(followedInitiativeId);
        });
    });

    /**
     * TEST: GET /users/admin/list
     */
    describe('GET /users/admin/list', () => {
        it('should return 403 if requested by a non-admin', async () => {
            const response = await request(app).get('/users/admin/list').set('X-Mock-User-Id', mockCitizenId);
            expect(response.status).toBe(403);
        });

        it('should return a list of admin users', async () => {
            const response = await request(app).get('/users/admin/list').set('X-Mock-User-Id', mockAdminId);
            expect(response.status).toBe(200);
            expect(response.body.data.length).toBeGreaterThanOrEqual(1);
            expect(response.body.data.every(u => u.isAdmin === true)).toBe(true);
        });

        it('should filter admin users by fiscalCode', async () => {
            await db.query("INSERT INTO UTENTE (NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_CITTADINO, IS_ADMIN) VALUES ('Searchable', 'Admin', 'SEARCHME01XX', 'search@test.com', 0, 1)");

            const response = await request(app)
                .get('/users/admin/list?fiscalCode=SEARCHME')
                .set('X-Mock-User-Id', mockAdminId);
            
            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].fiscalCode).toBe('SEARCHME01XX');
        });
    });

    /**
     * TEST: GET /users/search
     */
    describe('GET /users/search', () => {
        it('should return 400 if fiscalCode is missing', async () => {
            const response = await request(app).get('/users/search').set('X-Mock-User-Id', mockAdminId);
            expect(response.status).toBe(400);
        });

        it('should return 404 if user is not found', async () => {
            const response = await request(app).get('/users/search?fiscalCode=NONEXISTENT').set('X-Mock-User-Id', mockAdminId);
            expect(response.status).toBe(404);
        });

        it('should return user data for a given fiscalCode', async () => {
            const response = await request(app).get('/users/search?fiscalCode=CITTST01XX').set('X-Mock-User-Id', mockAdminId);
            expect(response.status).toBe(200);
            expect(response.body.id).toBe(mockCitizenId);
            expect(response.body.fiscalCode).toBe('CITTST01XX');
        });
    });

    /**
     * TEST: POST /users/admin/pre-authorize
     */
    describe('POST /users/admin/pre-authorize', () => {
        // Questo test fallirà con l'implementazione attuale, evidenziando una potenziale mancanza di controllo dei permessi.
        it('should return 403 if requested by a non-admin', async () => {
            const response = await request(app)
                .post('/users/admin/pre-authorize')
                .set('X-Mock-User-Id', mockCitizenId)
                .send({ fiscalCode: 'NEWADMINCFCODE' });
            expect(response.status).toBe(403);
        });

        it('should return 409 if fiscal code already exists', async () => {
            const response = await request(app)
                .post('/users/admin/pre-authorize')
                .set('X-Mock-User-Id', mockAdminId)
                .send({ fiscalCode: 'CITTST01XX' });
            expect(response.status).toBe(409);
        });

        it('should pre-authorize a new admin fiscal code', async () => {
            const newFiscalCode = 'PREAUTHCF12345';
            const response = await request(app)
                .post('/users/admin/pre-authorize')
                .set('X-Mock-User-Id', mockAdminId)
                .send({ fiscalCode: newFiscalCode });
            
            expect(response.status).toBe(201);
            
            const [rows] = await db.query("SELECT * FROM PRE_AUTORIZZATO WHERE CODICE_FISCALE = ?", [newFiscalCode]);
            expect(rows).toHaveLength(1);
        });
    });

    /**
     * TEST: PATCH /users/:id/role
     */
    describe('PATCH /users/:id/role', () => {
        it('should return 403 if a non-admin tries to change roles', async () => {
            const response = await request(app)
                .patch(`/users/${mockCitizenId}/role`)
                .set('X-Mock-User-Id', mockCitizenId)
                .send({ isAdmin: true });
            expect(response.status).toBe(403);
        });

        it('should return 403 if an admin tries to revoke their own privileges', async () => {
            const response = await request(app)
                .patch(`/users/${mockAdminId}/role`)
                .set('X-Mock-User-Id', mockAdminId)
                .send({ isAdmin: false });
            expect(response.status).toBe(403);
        });

        it('should return 400 for invalid body', async () => {
            const response = await request(app)
                .patch(`/users/${mockCitizenToPromoteId}/role`)
                .set('X-Mock-User-Id', mockAdminId)
                .send({ isAdmin: 'not-a-boolean' });
            
            expect(response.status).toBe(400);
        });

        it('should promote a citizen to admin', async () => {
            const response = await request(app)
                .patch(`/users/${mockCitizenToPromoteId}/role`)
                .set('X-Mock-User-Id', mockAdminId)
                .send({ isAdmin: true });
            
            expect(response.status).toBe(200);

            const [user] = await db.query("SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?", [mockCitizenToPromoteId]);
            expect(user[0].IS_ADMIN).toBe(1);
        });

        it('should revoke admin role from another admin', async () => {
            // Prima promuoviamo l'utente per essere sicuri che sia admin
            await db.query("UPDATE UTENTE SET IS_ADMIN = 1 WHERE ID_UTENTE = ?", [mockCitizenToPromoteId]);

            // Poi revochiamo
            const response = await request(app)
                .patch(`/users/${mockCitizenToPromoteId}/role`)
                .set('X-Mock-User-Id', mockAdminId)
                .send({ isAdmin: false });

            expect(response.status).toBe(200);

            const [user] = await db.query("SELECT IS_ADMIN FROM UTENTE WHERE ID_UTENTE = ?", [mockCitizenToPromoteId]);
            expect(user[0].IS_ADMIN).toBe(0);
        });
    });
});