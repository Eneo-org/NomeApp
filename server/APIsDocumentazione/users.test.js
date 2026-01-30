const request = require('supertest');
const express = require('express');
const userRoutes = require('../src/routes/users');
const db = require('../src/config/db');

// Mock del database per isolare i test dalla connessione reale
jest.mock('../src/config/db');

const app = express();
app.use(express.json());
app.use('/users', userRoutes);

describe('User API Endpoints', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    // Suite di test per GET /users/me
    describe('GET /users/me', () => {
        it('should return 401 if no user ID is provided', async () => {
            const res = await request(app).get('/users/me');
            expect(res.statusCode).toEqual(401);
            expect(res.body.message).toContain('Autenticazione mancante');
        });

        it('should return 404 if user is not found', async () => {
            db.query.mockResolvedValue([[]]);
            const res = await request(app).get('/users/me').set('X-Mock-User-Id', '999');
            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toBe('Utente non trovato');
        });

        it('should return user data for a valid user ID', async () => {
            const mockUser = [{
                ID_UTENTE: 1,
                NOME: 'Mario',
                COGNOME: 'Rossi',
                CODICE_FISCALE: 'RSSMRA80A01H501U',
                EMAIL: 'mario.rossi@test.it',
                IS_ADMIN: 1,
                IS_CITTADINO: 0,
                CREATED_AT: new Date().toISOString()
            }];
            db.query.mockResolvedValue([mockUser]);

            const res = await request(app).get('/users/me').set('X-Mock-User-Id', '1');

            expect(res.statusCode).toEqual(200);
            expect(res.body.id).toBe(1);
            expect(res.body.firstName).toBe('Mario');
            expect(res.body.isAdmin).toBe(true);
            expect(res.body.isCitizen).toBe(false);
        });
    });

    // Suite di test per GET /users/admin/list
    describe('GET /users/admin/list', () => {
        it('should return 401 if no user ID is provided', async () => {
            const res = await request(app).get('/users/admin/list');
            expect(res.statusCode).toEqual(401);
        });

        it('should return 403 if the user is not an admin', async () => {
            db.query.mockResolvedValue([[{ IS_ADMIN: 0 }]]); // Mock utente non-admin
            const res = await request(app).get('/users/admin/list').set('X-Mock-User-Id', '2');
            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toContain('Accesso negato');
        });

        it('should return a list of admin users if requester is an admin', async () => {
            const mockAdminList = [
                { ID_UTENTE: 1, NOME: 'Admin', COGNOME: 'User', CODICE_FISCALE: 'ADMINCF...', EMAIL: 'admin@test.it' },
                { ID_UTENTE: 3, NOME: 'Another', COGNOME: 'Admin', CODICE_FISCALE: 'ADMINCF2...', EMAIL: 'admin2@test.it' }
            ];
            const mockCount = [{ total: 2 }];

            // Mock delle chiamate al DB: 1. controllo admin, 2. lista, 3. conteggio
            db.query
                .mockResolvedValueOnce([[{ IS_ADMIN: 1 }]]) // Il richiedente è admin
                .mockResolvedValueOnce([mockAdminList])      // La lista degli admin
                .mockResolvedValueOnce([mockCount]);         // Il conteggio totale

            const res = await request(app).get('/users/admin/list').set('X-Mock-User-Id', '1');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].firstName).toBe('Admin');
            expect(res.body.meta.totalObjects).toBe(2);
        });
    });

    // Suite di test per PATCH /users/:id/role
    describe('PATCH /users/:id/role', () => {
        it('should return 403 if a non-admin tries to change roles', async () => {
            db.query.mockResolvedValue([[{ IS_ADMIN: 0 }]]); // Richiedente non è admin
            const res = await request(app)
                .patch('/users/2/role')
                .set('X-Mock-User-Id', '2')
                .send({ isAdmin: true });
            expect(res.statusCode).toEqual(403);
        });

        it('should return 403 if an admin tries to revoke their own role', async () => {
            db.query.mockResolvedValue([[{ IS_ADMIN: 1 }]]); // Richiedente è admin
            const res = await request(app)
                .patch('/users/1/role')
                .set('X-Mock-User-Id', '1')
                .send({ isAdmin: false });
            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toContain('non puoi revocare i tuoi stessi privilegi');
        });

        it('should return 404 if target user does not exist', async () => {
            db.query
                .mockResolvedValueOnce([[{ IS_ADMIN: 1 }]]) // Richiedente è admin
                .mockResolvedValueOnce([[]]); // Utente target non trovato

            const res = await request(app)
                .patch('/users/999/role')
                .set('X-Mock-User-Id', '1')
                .send({ isAdmin: false });

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toBe('Utente non trovato.');
        });

        it('should successfully change a user role', async () => {
            db.query
                .mockResolvedValueOnce([[{ IS_ADMIN: 1 }]]) // Richiedente è admin
                .mockResolvedValueOnce([[{ ID_UTENTE: 2 }]]) // Utente target esiste
                .mockResolvedValueOnce([{}]); // Mock del risultato della query UPDATE

            const res = await request(app)
                .patch('/users/2/role')
                .set('X-Mock-User-Id', '1')
                .send({ isAdmin: false });

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toContain('Privilegi aggiornati con successo');
            expect(db.query).toHaveBeenCalledWith(
                "UPDATE UTENTE SET IS_ADMIN = ? WHERE ID_UTENTE = ?",
                [0, '2']
            );
        });
    });

    // Suite di test per GET /users/me/initiatives
    describe('GET /users/me/initiatives', () => {
        it('should return 400 for an invalid relation type', async () => {
            const res = await request(app)
                .get('/users/me/initiatives?relation=invalid_relation')
                .set('X-Mock-User-Id', '1');
            expect(res.statusCode).toEqual(400);
        });

        it('should fetch created initiatives', async () => {
            const mockInitiatives = [{ ID_INIZIATIVA: 1, TITOLO: 'Test' }];
            const mockCount = [{ total: 1 }];
            db.query
                .mockResolvedValueOnce([mockCount])
                .mockResolvedValueOnce([mockInitiatives]);

            const res = await request(app)
                .get('/users/me/initiatives?relation=created')
                .set('X-Mock-User-Id', '1');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data[0].title).toBe('Test');
            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE i.ID_AUTORE = ?'), expect.anything());
        });
    });

    // Suite di test per GET /users/me/notifications
    describe('GET /users/me/notifications', () => {
        it('should fetch all notifications for a user', async () => {
            const mockNotifications = [
                { ID_NOTIFICA: 1, TESTO: 'Notifica 1', LETTA: 1, DATA_CREAZIONE: new Date() },
                { ID_NOTIFICA: 2, TESTO: 'Notifica 2', LETTA: 0, DATA_CREAZIONE: new Date() }
            ];
            const mockCount = [{ total: 2 }];
            db.query
                .mockResolvedValueOnce([mockCount])
                .mockResolvedValueOnce([mockNotifications]);

            const res = await request(app)
                .get('/users/me/notifications')
                .set('X-Mock-User-Id', '1');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].isRead).toBe(true);
            expect(res.body.data[1].isRead).toBe(false);
        });

        it('should fetch only unread notifications if read=false', async () => {
            const mockNotifications = [
                { ID_NOTIFICA: 2, TESTO: 'Notifica 2', LETTA: 0, DATA_CREAZIONE: new Date() }
            ];
            const mockCount = [{ total: 1 }];
            db.query
                .mockResolvedValueOnce([mockCount])
                .mockResolvedValueOnce([mockNotifications]);

            const res = await request(app)
                .get('/users/me/notifications?read=false')
                .set('X-Mock-User-Id', '1');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].isRead).toBe(false);
            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('AND LETTA = 0'), expect.anything());
        });
    });

    // Suite di test per PATCH /users/me/notifications/:id
    describe('PATCH /users/me/notifications/:id', () => {
        it('should return 400 if body is not { isRead: true }', async () => {
            const res = await request(app)
                .patch('/users/me/notifications/1')
                .set('X-Mock-User-Id', '1')
                .send({ isRead: false });
            expect(res.statusCode).toEqual(400);
        });

        it('should mark a notification as read', async () => {
            const mockNotification = [{ ID_NOTIFICA: 1, TESTO: 'Test', LETTA: 0 }];
            db.query
                .mockResolvedValueOnce([mockNotification]) // per la query di controllo
                .mockResolvedValueOnce([{}]); // per la query di update

            const res = await request(app)
                .patch('/users/me/notifications/1')
                .set('X-Mock-User-Id', '1')
                .send({ isRead: true });

            expect(res.statusCode).toEqual(200);
            expect(res.body.isRead).toBe(true);
            expect(db.query).toHaveBeenCalledWith(
                "UPDATE NOTIFICA SET LETTA = 1 WHERE ID_NOTIFICA = ?",
                ['1']
            );
        });
    });
});