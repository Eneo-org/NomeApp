const db = require('../config/db');

// API: GET /categories
exports.getAllCategories = async (req, res) => {
    try {
        const query = 'SELECT ID_CATEGORIA, NOME FROM CATEGORIA';
        const [rows] = await db.query(query);

        const formattedData = rows.map(row => ({
            id: row.ID_CATEGORIA,
            name: row.NOME
        }));

        res.status(200).json({
            data: formattedData
        });

    } catch (err) {
        console.error("Errore getAllCategories:", err);
        res.status(500).json({ 
            timeStamp: new Date().toISOString(),
            message: "Errore interno del server durante il recupero delle categorie",
            details: process.env.NODE_ENV === 'development' ? [{ field: "server", issue: err.message }] : undefined
        });
    }
};

// API: GET /platforms
exports.getAllPlatforms = async (req, res) => {
    try {
        const query = 'SELECT ID_PIATTAFORMA, NOME_PIATTAFORMA, PATH_ICONA, LINK_BASE_PIATTAFORMA FROM PIATTAFORMA';
        const [rows] = await db.query(query);

        const formattedData = rows.map(row => ({
            id: row.ID_PIATTAFORMA,
            platformName: row.NOME_PIATTAFORMA,
            iconPath: row.PATH_ICONA,
            platformLink: row.LINK_BASE_PIATTAFORMA
        }));

        res.status(200).json({
            data: formattedData
        });

    } catch (err) {
        console.error("Errore getAllPlatforms:", err);
        res.status(500).json({ 
            timeStamp: new Date().toISOString(),
            message: "Errore interno del server durante il recupero delle piattaforme",
            details: process.env.NODE_ENV === 'development' ? [{ field: "server", issue: err.message }] : undefined
        });
    }
};