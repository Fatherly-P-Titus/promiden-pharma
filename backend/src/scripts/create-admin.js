require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
const readline = require('node:readline/promises');
const bcrypt = require('bcryptjs');
const { stdin, stdout } = require('node:process');
const { createClient } = require('@supabase/supabase-js');
const { validateEnv } = require('../config/env');

(async () => {
  validateEnv();
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const username = (await rl.question('New administrator username (3-100 characters): ')).trim();
    const password = await rl.question('Password (12-256 characters): ');
    const confirm = await rl.question('Confirm password: ');
    if (!/^[a-zA-Z0-9._-]{3,100}$/.test(username)) throw new Error('Username must use letters, numbers, dots, underscores, or hyphens and be 3-100 characters.');
    if (password.length < 12 || password.length > 256) throw new Error('Password must be between 12 and 256 characters.');
    if (password !== confirm) throw new Error('Passwords do not match.');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const password_hash = await bcrypt.hash(password, 12);
    const { data, error } = await supabase.from('admin_users').insert({ username, username_normalized: username.toLowerCase(), password_hash, is_active: true }).select('id,username').single();
    if (error) throw new Error(`Administrator creation failed. Check the schema and whether the username already exists. ${error.code || ''}`.trim());
    console.log(`Administrator created: ${data.username} (${data.id})`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally { rl.close(); }
})();
