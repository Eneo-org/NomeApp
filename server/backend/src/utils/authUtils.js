const { OAuth2Client } = require("google-auth-library");

// ID CLIENT (Deve coincidere con quello del Frontend)
const CLIENT_ID =
  "86056164816-hta85akkjjfc5h53p17vrgoo531ebsv7.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

// Store temporaneo OTP
const otpStore = {};

// Helper: Genera CF fisso basato sull'ID univoco di Google
const generateDeterministicFiscalCode = (googleSub) => {
  return `GOOG${googleSub.slice(-12)}`;
};

module.exports = {
  CLIENT_ID,
  client,
  otpStore,
  generateDeterministicFiscalCode,
};
