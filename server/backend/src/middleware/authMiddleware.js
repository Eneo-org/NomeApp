module.exports = (req, res, next) => {
  // 1. Cerchiamo l'ID utente nell'header (come fai già negli altri controller)
  // In futuro, qui controlleremo il token JWT vero e proprio.
  const userId = req.header("X-Mock-User-Id");

  // 2. Se non c'è l'ID, blocchiamo tutto
  if (!userId) {
    return res
      .status(401)
      .json({ message: "Accesso negato. Autenticazione mancante." });
  }

  // 3. Se c'è, lo "attacchiamo" alla richiesta così i controller possono usarlo facilmente
  // Invece di dover scrivere ogni volta req.header("..."), useremo req.user.id
  req.user = { id: userId };

  // 4. "NEXT!" -> Passa la palla al prossimo pezzo di codice (il controller vero e proprio)
  next();
};
