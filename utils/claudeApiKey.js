const db = require('../config/database');

async function getClaudeApiKey() {
  const [[row]] = await db.query("SELECT value FROM user_settings WHERE name='claude_api_key'");
  return row ? row.value : null;
}

module.exports = { getClaudeApiKey };
