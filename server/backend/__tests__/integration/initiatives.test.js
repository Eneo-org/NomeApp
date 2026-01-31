// Set Node environment to 'test'
process.env.NODE_ENV = 'test';

// backend/__tests__/integration/initiatives.test.js

const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Variabile di controllo per l'utente loggato (DEVE iniziare con "mock")
let mockActiveUser = null;

// --- MOCK DEFINITIVO AUTH ---
// Mock del middleware di autenticazione. Il modulo reale esporta una singola funzione,
// quindi il nostro mock deve fare lo stesso per essere compatibile con Express.
jest.mock('../../src/middleware/authMiddleware', () => {
    // Questa è la funzione che verrà usata al posto del middleware reale.
    const mockMiddleware = (req, res, next) => {
        // Controlliamo la variabile `mockActiveUser` definita nello scope del test.
        if (!mockActiveUser) {
            // Se non è impostata, simuliamo un utente non autenticato.
            return res.status(401).json({
                message: 'Accesso negato. Autenticazione mancante.'
            });
        }
        // Se `mockActiveUser` esiste, lo attacchiamo a `req.user`.
        req.user = mockActiveUser;
        next(); // Proseguiamo al controller successivo.
    };
    return mockMiddleware;
});




const app = require('../../src/app');
const db = require('../../src/config/db');

// --- ID Utenti Mock ---
const mockCitizenId = 1;
const mockCitizen2Id = 3;
const mockAdminId = 2;

// --- Funzioni di Utility per Date ---
const getFutureDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};
const getPastDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
};


describe('API /initiatives - Integration Tests', () => {

    // --- SETUP E TEARDOWN ---
    beforeAll(async () => {
        // Pulisce e prepara il database prima di tutti i test
        await db.query("SET FOREIGN_KEY_CHECKS = 0;");
        // Elenco tabelle da svuotare
        const tablesToTruncate = ["FIRMA_INIZIATIVA", "INIZIATIVA_SALVATA", "RISPOSTA", "ALLEGATO", "INIZIATIVA", "UTENTE", "CATEGORIA", "PIATTAFORMA"];
        for (const table of tablesToTruncate) {
            await db.query(`TRUNCATE TABLE ${table};`);
        }
        await db.query("SET FOREIGN_KEY_CHECKS = 1;");

        // Inserisce dati di seed completi
        await db.query("INSERT INTO PIATTAFORMA (ID_PIATTAFORMA, NOME_PIATTAFORMA) VALUES (1, 'Trento Partecipa')");
        await db.query("INSERT INTO CATEGORIA (ID_CATEGORIA, NOME) VALUES (1, 'Ambiente'), (2, 'Cultura'), (3, 'Trasporti')");
        await db.query("INSERT INTO UTENTE (ID_UTENTE, NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_CITTADINO, IS_ADMIN) VALUES (?, 'Test', 'Citizen', 'CITTEST01', 'citizen@test.com', 1, 0)", [mockCitizenId]);
        await db.query("INSERT INTO UTENTE (ID_UTENTE, NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_CITTADINO, IS_ADMIN) VALUES (?, 'Test', 'Admin', 'ADMTEST01', 'admin@test.com', 0, 1)", [mockAdminId]);
        await db.query("INSERT INTO UTENTE (ID_UTENTE, NOME, COGNOME, CODICE_FISCALE, EMAIL, IS_CITTADINO, IS_ADMIN) VALUES (?, 'Another', 'Citizen', 'CITTEST02', 'citizen2@test.com', 1, 0)", [mockCitizen2Id]);

        // Inserisce iniziative con stati diversi
        await db.query(
            "INSERT INTO INIZIATIVA (ID_INIZIATIVA, TITOLO, DESCRIZIONE, LUOGO, DATA_CREAZIONE, DATA_SCADENZA, STATO, ID_AUTORE, ID_CATEGORIA, ID_PIATTAFORMA) VALUES " +
            "(101, 'Parco Pulito', 'Pulizia del parco cittadino', 'Parco di Gocciadoro', ?, ?, 'Approvata', ?, 1, 1)," +
            "(102, 'Festival del Libro', 'Evento culturale', 'Biblioteca Comunale', ?, ?, 'Approvata', ?, 2, 1)," +
            "(103, 'Pista Ciclabile', 'Nuova pista', 'Da Gardolo a Trento', ?, ?, 'Respinta', ?, 3, 1)," +
            "(104, 'Concerto Rock', 'Musica dal vivo', 'Piazza Fiera', ?, ?, 'Scaduta', ?, 2, 1)",
            [getPastDate(20), getFutureDate(20), mockCitizenId, getPastDate(40), getFutureDate(50), mockCitizenId, getPastDate(30), getFutureDate(60), mockCitizen2Id, getPastDate(50), getPastDate(5), mockCitizenId]
        );
        
        await db.query("UPDATE INIZIATIVA SET NUM_FIRME = 50 WHERE ID_INIZIATIVA=101");
        await db.query("UPDATE INIZIATIVA SET NUM_FIRME = 150 WHERE ID_INIZIATIVA=102");
    });

    afterEach(() => {
        // Resetta l'utente attivo dopo ogni test
        mockActiveUser = null;
    });

    afterAll(async () => {
        // Chiude la connessione al DB alla fine di tutto
        if (db) await db.end();
    });


    // --- 1. CREAZIONE INIZIATIVE (POST /initiatives) ---
    describe('POST /initiatives', () => {

        it('RF1-Successo: Un cittadino autenticato crea un\'iniziativa con tutti i campi e allegato (201)', async () => {
            mockActiveUser = {
                id: mockCitizenId,
                isAdmin: false
            };
            const response = await request(app)
                .post('/initiatives')
                .field('title', 'Nuova iniziativa di test')
                .field('description', 'Descrizione completa e dettagliata.')
                .field('place', 'Luogo Fittizio')
                .field('categoryId', 2)
.attach('attachments', Buffer.from('fake'), 'test.jpg');
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('id');
        });

        it('Validazione: Tentativo di creazione con campi obbligatori mancanti (400)', async () => {
            mockActiveUser = {
                id: mockCitizen2Id,
                isAdmin: false
            };
const response = await request(app)
                .post('/initiatives')
                .field('title', 'Titolo orfano')
                .attach('attachments', Buffer.from('fake'), 'test.jpg'); // Manca description

            expect(response.status).toBe(400);
        });

        it('Permessi: Tentativo di creazione da parte di un utente non autenticato (401)', async () => {
            mockActiveUser = null; // Nessun utente loggato
            const response = await request(app)
                .post('/initiatives')
                .field('title', 'Titolo non autenticato')
                .field('description', 'Descrizione.')
                .attach('attachments', Buffer.from('fake'), 'test.jpg');

            expect(response.status).toBe(401);
        });
        
        it('RF13 (Cooldown): Un utente non può creare iniziative se ne ha creata una negli ultimi 14 giorni (422)', async () => {
            mockActiveUser = {
                id: mockCitizenId,
                isAdmin: false
            };
            
            // Inseriamo un'iniziativa "recente" per questo utente
            await db.query("INSERT INTO INIZIATIVA (TITOLO, DESCRIZIONE, LUOGO, DATA_CREAZIONE, STATO, ID_AUTORE, ID_CATEGORIA, ID_PIATTAFORMA) VALUES ('Test Cooldown', 'Desc.', 'Qui', ?, 'In corso', ?, 1, 1)", [getPastDate(5), mockCitizenId]);

            const response = await request(app)
                .post('/initiatives')
                .field('title', 'Secondo tentativo troppo presto')
                .field('description', 'Non dovrebbe funzionare.')
                .field('categoryId', 1) // Categoria è richiesta
                .attach('attachments', Buffer.from('fake'), 'test.jpg');
            
            expect(response.status).toBe(422);
            expect(response.body.message).toMatch(/Hai già creato un\'iniziativa di recente/);
            
            // Pulizia
            await db.query("DELETE FROM INIZIATIVA WHERE TITOLO = 'Test Cooldown'");
        });
    });


    // --- 2. CONSULTAZIONE LISTA (GET /initiatives) ---
    describe('GET /initiatives', () => {

        it('Paginazione: Verifica il funzionamento di currentPage e objectsPerPage', async () => {
            const response = await request(app)
                .get('/initiatives')
                .query({
                    currentPage: 1,
                    objectsPerPage: 2,
                    status: 'Approvata'
                });
            expect(response.status).toBe(200);
            expect(response.body.data.length).toBe(2);
            expect(response.body.meta).toHaveProperty('currentPage', 1);
            expect(response.body.meta).toHaveProperty('totalPages');
        });

        it('RF3-Filtri: Filtra per status "Approvata"', async () => {
            const response = await request(app).get('/initiatives').query({
                status: 'Approvata'
            });
            expect(response.status).toBe(200);
            expect(response.body.data.every(item => item.status === 'Approvata')).toBe(true);
        });
        
        it('RF3-Filtri: Filtra per categoryID', async () => {
            const response = await request(app).get('/initiatives').query({
                category: 3
            });
            expect(response.status).toBe(200);
            expect(response.body.data.every(item => item.categoryId === 3)).toBe(true);
        });

        it('RF3-Filtri: Filtra per intervallo firme (minSignatures)', async () => {
            const response = await request(app).get('/initiatives').query({
                minSignatures: 100
            });
            expect(response.status).toBe(200);
            expect(response.body.data.every(item => item.signatures >= 100)).toBe(true);
        });

        it('Ricerca: Verifica il parametro "search" per titolo', async () => {
            const response = await request(app).get('/initiatives').query({
                search: 'Libro',
                status: 'Approvata'
            });
            expect(response.status).toBe(200);
            expect(response.body.data[0].title).toBe('Festival del Libro');
        });


        it('Ordinamento: Verifica sortBy per data creazione (asc)', async () => {
            const response = await request(app).get('/initiatives').query({
                sortBy: 'creationDate',
                order: 'asc'
            });
            expect(response.status).toBe(200);
            const dates = response.body.data.map(item => new Date(item.creationDate));
            for (let i = 0; i < dates.length - 1; i++) {
                expect(dates[i].getTime()).toBeLessThanOrEqual(dates[i + 1].getTime());
            }
        });
    });
    

    // --- 3. DETTAGLIO INIZIATIVA (GET /initiatives/{id}) ---
    describe('GET /initiatives/:id', () => {

        it('Successo: Recupero di un ID esistente (200)', async () => {
            const response = await request(app).get('/initiatives/101');
            expect(response.status).toBe(200);
            expect(response.body.id).toBe(101);
            expect(response.body.title).toBe('Parco Pulito');
            // Verifica che ci siano i campi separati per allegati
            expect(response.body).toHaveProperty('images');
            expect(response.body).toHaveProperty('documents');
        });

        it('Errore: Richiesta di un ID inesistente (404)', async () => {
            const response = await request(app).get('/initiatives/9999');
            expect(response.status).toBe(404);
        });
    });


    // --- 4. MODIFICA AMMINISTRATIVA (PATCH /initiatives/{id}) - RF7 ---
    describe('PATCH /initiatives/:id', () => {

        it('RF7-Successo Admin: Un admin estende la data di scadenza (200)', async () => {
            mockActiveUser = {
                id: mockAdminId,
                isAdmin: true
            };
            const newDate = '2099-12-31';

            const response = await request(app)
                .patch('/initiatives/101')
                .send({
                    expirationDate: newDate
                });

            expect(response.status).toBe(200);

            // Verifica che la data sia stata aggiornata nel DB
            const [rows] = await db.query("SELECT DATA_SCADENZA FROM INIZIATIVA WHERE ID_INIZIATIVA = 101");
            expect(rows[0].DATA_SCADENZA.toISOString()).toMatch(/2099-12-31|2099-12-30/);
        });

        it('RF7-Sicurezza: Un cittadino non può estendere la data (403)', async () => {
            mockActiveUser = {
                id: mockCitizenId,
                isAdmin: false
            };
            const newDate = '2098-01-01';

            const response = await request(app)
                .patch('/initiatives/101')
                .send({
                    expirationDate: newDate
                });

            expect(response.status).toBe(403);
        });
    });


    // --- 5. RISPOSTA AMMINISTRAZIONE (POST /initiatives/{id}/responses) - RF7 ---
    describe('POST /initiatives/:id/responses', () => {

        it('RF7-Admin Reply: Admin risponde cambiando stato in "Approvata" (200)', async () => {
            mockActiveUser = {
                id: mockAdminId,
                isAdmin: true
            };
            const response = await request(app)
                .post('/initiatives/101/responses')
                .field('status', 'Approvata')
                .field('motivations', 'L\'iniziativa è stata approvata dal consiglio.')
                .attach('attachments', Buffer.from('fake'), 'test.jpg');

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('id');

            // Verifica che lo stato sia cambiato nel DB
            const [rows] = await db.query("SELECT STATO FROM INIZIATIVA WHERE ID_INIZIATIVA = 101");
            expect(rows[0].STATO).toBe('Approvata');
        });
        
        it('RF7-Citizen Forbidden: Un cittadino non può rispondere (403)', async () => {
            mockActiveUser = {
                id: mockCitizenId,
                isAdmin: false
            };
            const response = await request(app)
                .post('/initiatives/103/responses')
                .field('status', 'Approvata')
                .field('motivations', 'Tento di approvare da cittadino')
                .attach('attachments', Buffer.from('fake'), 'test.jpg');

            expect(response.status).toBe(403);
        });
        
        it('Stato Invalido: Admin invia uno stato non valido (400)', async () => {
            mockActiveUser = {
                id: mockAdminId,
                isAdmin: true
            };
            const response = await request(app)
                .post('/initiatives/103/responses')
                .field('status', 'StatoInventato')
                .field('motivations', 'Test con stato invalido')
                .attach('attachments', Buffer.from('fake'), 'test.jpg');
            
            expect(response.status).toBe(400);
        });
    });


    // --- 6. FIRMA_INIZIATIVA INIZIATIVA (POST /initiatives/{id}/signatures) - RF11 ---
    describe('POST /initiatives/:id/signatures', () => {
        const initiativeToSignId = 103;

        it('RF11-Firma Valida: Un cittadino firma un\'iniziativa (201)', async () => {
            mockActiveUser = {
                id: mockCitizenId,
                isAdmin: false
            };
            
            const [beforeRows] = await db.query("SELECT NUM_FIRME FROM INIZIATIVA WHERE ID_INIZIATIVA = ?", [initiativeToSignId]);
            const signaturesBefore = beforeRows[0].NUM_FIRME;
            
            const response = await request(app).post(`/initiatives/${initiativeToSignId}/signatures`);
            
            expect(response.status).toBe(201);
            expect(response.body.message).toBe('Firma registrata con successo');

            // Verifica che il contatore sia aumentato
            const [afterRows] = await db.query("SELECT NUM_FIRME FROM INIZIATIVA WHERE ID_INIZIATIVA = ?", [initiativeToSignId]);
            expect(afterRows[0].NUM_FIRME).toBe(signaturesBefore + 1);
        });

        it('RF11-Doppia Firma: Lo stesso cittadino non può firmare di nuovo (409)', async () => {
            mockActiveUser = {
                id: mockCitizenId,
                isAdmin: false
            }; // Lo stesso utente del test precedente
            
            const response = await request(app).post(`/initiatives/${initiativeToSignId}/signatures`);
            
            expect(response.status).toBe(409);
            expect(response.body.message).toBe('Hai già firmato questa iniziativa.');
        });

        it('RF11-Utente Anonimo: Tentativo di firma senza login (401)', async () => {
            mockActiveUser = null;
            const response = await request(app).post(`/initiatives/${initiativeToSignId}/signatures`);
            expect(response.status).toBe(401);
        });
    });


    // --- 7. SEGUI / SMETTI DI SEGUIRE (POST & DELETE /initiatives/{id}/follows) - RF14 ---
    describe('POST & DELETE /initiatives/:id/follows', () => {
        const initiativeToFollowId = 104;

        it('RF14-Follow: Cittadino inizia a seguire un\'iniziativa (200)', async () => {
            mockActiveUser = {
                id: mockCitizen2Id,
                isAdmin: false
            };
            const response = await request(app).post(`/initiatives/${initiativeToFollowId}/follows`);
            
            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Iniziativa aggiunta ai preferiti');

            const [rows] = await db.query("SELECT * FROM INIZIATIVA_SALVATA WHERE ID_UTENTE = ? AND ID_INIZIATIVA = ?", [mockCitizen2Id, initiativeToFollowId]);
            expect(rows.length).toBe(1);
        });

        it('Idempotenza: Seguire un\'iniziativa già seguita non dà errore (200)', async () => {
            mockActiveUser = {
                id: mockCitizen2Id,
                isAdmin: false
            }; // Stesso utente
            const response = await request(app).post(`/initiatives/${initiativeToFollowId}/follows`);
            
            expect(response.status).toBe(200); // O 204, a seconda dell\'implementazione. 200 è ok.
        });

        it('RF14-Unfollow: Cittadino smette di seguire (200)', async () => {
            mockActiveUser = {
                id: mockCitizen2Id,
                isAdmin: false
            }; // Stesso utente
            const response = await request(app).delete(`/initiatives/${initiativeToFollowId}/follows`);
            
            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Iniziativa rimossa dai seguiti con successo');
            
            const [rows] = await db.query("SELECT * FROM INIZIATIVA_SALVATA WHERE ID_UTENTE = ? AND ID_INIZIATIVA = ?", [mockCitizen2Id, initiativeToFollowId]);
            expect(rows.length).toBe(0);
        });
    });

});
