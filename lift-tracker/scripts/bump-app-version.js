const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const raw = fs.readFileSync(appJsonPath, 'utf8');
const config = JSON.parse(raw);

const parts = config.expo.version.split('.').map(Number);
parts[2] += 1;
const nextVersion = parts.join('.');

const updated = raw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${nextVersion}$2`);

fs.writeFileSync(appJsonPath, updated);
console.log(nextVersion);
