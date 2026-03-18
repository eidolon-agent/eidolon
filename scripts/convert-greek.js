const sharp = require('sharp');
const fs = require('fs');

const input = process.argv[2] || 'avatars/eidolon-greek.svg';
const output = process.argv[3] || 'avatars/eidolon-greek.png';

(async () => {
  try {
    const svg = fs.readFileSync(input, 'utf8');
    await sharp(Buffer.from(svg))
      .png()
      .toFile(output);
    console.log(`Converted ${input} → ${output}`);
  } catch (err) {
    console.error('Conversion failed:', err);
    process.exit(1);
  }
})().catch(console.error);
