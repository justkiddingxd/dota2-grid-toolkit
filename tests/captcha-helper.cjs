const { solveChallenge } = require('altcha-lib');
const { deriveKey } = require('altcha-lib/algorithms/pbkdf2');
async function solve(challenge) {
  const solution = await solveChallenge({ challenge, deriveKey, timeout: 20000 });
  if (!solution) throw new Error('ALTCHA solve timed out');
  return Buffer.from(JSON.stringify({ challenge, solution })).toString('base64');
}
async function proof(call, action='submit') {
  const response = await call('/captcha/challenge?action=' + action);
  if (response.status !== 200) throw new Error(JSON.stringify(response.body));
  return solve(response.body);
}
module.exports = { solve, proof };
