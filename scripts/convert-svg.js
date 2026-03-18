const sharp = require('sharp');
const fs = require('fs');

(async () => {
  const svg = fs.readFileSync('avatars/eidolon-avatar.svg', 'utf8');
  await sharp(Buffer.from(svg))
    .png()
    .toFile('avatars/eidolon-avatar.png');
  console.log('PNG generated at avatars/eidolon-avatar.png');
})().catch(err => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
