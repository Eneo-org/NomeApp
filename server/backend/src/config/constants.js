// Mappatura per l'ordinamento delle iniziative
// Chiave: ID parametro API
// Valore: Colonna Database
exports.INITIATIVE_SORT_MAP = {
    1: 'i.DATA_CREAZIONE',
    2: 'i.TITOLO',
    3: 'i.NUM_FIRME'
};

// Puoi aggiungere qui altre costanti future (es. stati validi)
exports.INITIATIVE_STATUS = {
    IN_CORSO: 'In corso',
    APPROVATA: 'Approvata',
    RESPINTA: 'Respinta'
};