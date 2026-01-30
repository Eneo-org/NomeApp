// backend/__tests__/integration/initiatives.test.js

const request = require('supertest');
const app = require('../../src/app');

// Importa il pool del database per gestire le connessioni
const db = require('../../src/config/db');

const mockCitizenId = 1; // ID utente fittizio per un cittadino
const mockAdminId = 2;   // ID utente fittizio per un admin

describe('API /initiatives (SQL Backend)', () => {

    // Eseguito una volta prima di tutti i test
    beforeAll(async () => {
        // Pulisce le tabelle per garantire l'isolamento dei test
        await db.query("SET FOREIGN_KEY_CHECKS = 0;");
        await db.query("TRUNCATE TABLE ALLEGATO;");
        await db.query("TRUNCATE TABLE INIZIATIVA;");
        await db.query("TRUNCATE TABLE UTENTE;");
        await db.query("TRUNCATE TABLE CATEGORIA;"); // Aggiunto per coerenza
        await db.query("SET FOREIGN_KEY_CHECKS = 1;");

        // Inserisce dati mock necessari per i test
        await db.query("INSERT INTO CATEGORIA (ID_CATEGORIA, NOME) VALUES (1, 'Ambiente')");
        await db.query("INSERT INTO UTENTE (ID_UTENTE, NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_CITTADINO, IS_ADMIN) VALUES (?, 'Test', 'Citizen', 'CITTEST01', 'citizen@test.com', 1, 0)", [mockCitizenId]);
        await db.query("INSERT INTO UTENTE (ID_UTENTE, NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_CITTADINO, IS_ADMIN) VALUES (?, 'Test', 'Admin', 'ADMTEST01', 'admin@test.com', 0, 1)", [mockAdminId]);
    });

    // Eseguito alla fine di tutti i test
    afterAll(async () => {
        // Chiude il pool di connessioni al DB per permettere a Jest di terminare
        if (db) await db.end();
    });

    /**
     * TEST: CREATE INITIATIVE (POST)
     * Riferimento: POST /initiatives
     */
    describe('POST /initiatives', () => {
        
        it('should return 201 and create a new initiative with valid data and image', async () => {
            // Nota: I campi corrispondono alle colonne della tabella INIZIATIVA + ALLEGATO
            const response = await request(app)
                .post('/initiatives')
                .set('X-Mock-User-Id', mockCitizenId)
                .field('title', 'Nuova Ciclabile')
                .field('description', 'Progetto per collegare la zona nord.')
                .field('place', 'Trento Nord')
                .field('categoryId', 1) // Assumiamo che ID_CATEGORIA 1 esista (popolato nel seed)
                // attach invia file come multipart/form-data
                .attach('attachments', Buffer.from('fake_image_data'), 'project.jpg');

            expect(response.status).toBe(201);
            
            // Verifica che il body della risposta contenga i campi generati dal DB (es. id auto_increment)
            expect(response.body).toHaveProperty('id');
            expect(response.body.title).toBe('Nuova Ciclabile');
            
            // Se l'API restituisce lo stato di default, verifichiamo che corrisponda al DEFAULT SQL ('In corso')
            if (response.body.status) {
                expect(response.body.status).toBe('In corso');
            }
        });

        it('should return 400 if required fields (like description) are missing', async () => {
            // Inviamo una richiesta incompleta
            const response = await request(app)
                .post('/initiatives')
                .set('X-Mock-User-Id', mockCitizenId)
                .field('title', 'Titolo orfano'); // Manca descrizione, luogo, categoria

            expect(response.status).toBe(400);
        });
    });

    /**
     * TEST: GET INITIATIVES LIST (GET)
     * Riferimento: GET /initiatives
     */
    describe('GET /initiatives', () => {
        
        it('should return 200 and a paginated list', async () => {
            const response = await request(app)
                .get('/initiatives')
                .set('X-Mock-User-Id', mockCitizenId)
                .query({ currentPage: 1, objectsPerPage: 10 });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    /**
     * TEST: GET INITIATIVE DETAILS (GET ID)
     * Riferimento: GET /initiatives/{id}
     */
    describe('GET /initiatives/:id', () => {
        let createdId;

        // Creiamo un dato reale su cui fare i test di lettura
        beforeAll(async () => {
            const res = await request(app)
                .post('/initiatives')
                .set('X-Mock-User-Id', mockCitizenId)
                .field('title', 'Iniziativa Test Dettaglio')
                .field('description', 'Descrizione test dettaglio')
                .field('place', 'Trento')
                .field('categoryId', 1)
                .attach('attachments', Buffer.from('img'), 'det.jpg');
            
            createdId = res.body.id;
        });

        it('should return 200 and correct details for existing ID', async () => {
            const response = await request(app).get(`/initiatives/${createdId}`).set('X-Mock-User-Id', mockCitizenId);

            expect(response.status).toBe(200);
            expect(parseInt(response.body.id)).toBe(parseInt(createdId));
            expect(response.body.title).toBe('Iniziativa Test Dettaglio');
        });

        it('should return 404 for a non-existent ID', async () => {
            // Usiamo un ID che sicuramente non esiste (o molto alto)
            const response = await request(app).get('/initiatives/9999999').set('X-Mock-User-Id', mockCitizenId);
            expect(response.status).toBe(404);
        });
    });

    /**
     * TEST: CHANGE EXPIRATION (PATCH)
     * Riferimento: PATCH /initiatives/{id}
     */
    describe('PATCH /initiatives/:id', () => {
        let createdId;

        beforeAll(async () => {
            const res = await request(app)
                .post('/initiatives')
                .set('X-Mock-User-Id', mockCitizenId)
                .field('title', 'Iniziativa Patch')
                .field('description', 'Da modificare')
                .field('place', 'Roma')
                .field('categoryId', 1)
                .attach('attachments', Buffer.from('..'), 'patch.pdf');
            createdId = res.body.id;
        });

        it('should return 200 and update expiration date if user is admin', async () => {
            const newDate = '2030-01-01';
            
            const response = await request(app)
                .patch(`/initiatives/${createdId}`)
                .set('X-Mock-User-Id', mockAdminId) // Usa l'ID dell'admin per questa operazione
                .send({ expirationDate: newDate });

            expect(response.status).toBe(200);
            
            // Opzionale: verificare che la data sia stata salvata correttamente chiamando la GET
            const check = await request(app).get(`/initiatives/${createdId}`);
            // Nota: SQL restituisce date spesso in formato ISO string o YYYY-MM-DD
            expect(check.body.expirationDate).toMatch(/2030-01-01/);
        });

        it('should return 403 if user is not admin', async () => {
            const newDate = '2030-01-01';
            
            const response = await request(app)
                .patch(`/initiatives/${createdId}`)
                .set('X-Mock-User-Id', mockCitizenId) // Usa l'ID di un non-admin
                .send({ expirationDate: newDate });

            expect(response.status).toBe(403);
        });
    });
});