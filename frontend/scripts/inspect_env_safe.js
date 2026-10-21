const fs = require('fs');
const path = require('path');

function inspectEnvFile(filePath) {
  console.log(`\n--- Inspecting: ${filePath} ---`);
  if (!fs.existsSync(filePath)) {
    console.log(`File does not exist.`);
    return;
  }
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    let summary = 'present';
    if (!val) {
      summary = 'empty';
    } else if (key.toUpperCase().includes('URL') || val.startsWith('http://') || val.startsWith('https://')) {
      if (val.includes('127.0.0.1') || val.includes('localhost')) {
        summary = `local URL (${val})`;
      } else {
        try {
          const u = new URL(val);
          summary = `remote URL (origin: ${u.origin})`;
        } catch {
          summary = `remote URL (${val.slice(0, 30)}...)`;
        }
      }
    } else if (val.startsWith('sb_publishable_')) {
      summary = `Supabase publishable key format (length ${val.length})`;
    } else if (val.startsWith('eyJ')) {
      summary = `JWT format (length ${val.length})`;
    } else {
      summary = `string value (length ${val.length})`;
    }
    console.log(`  ${key}: [${summary}]`);
  }
}

inspectEnvFile(path.join(__dirname, '../.env.local'));
inspectEnvFile(path.join(__dirname, '../.env'));
inspectEnvFile(path.join(__dirname, '../../backend/.env'));
