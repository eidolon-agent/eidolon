#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || 'avatars/eidolon-avatar.png';

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const stats = fs.statSync(filePath);
if (stats.size > 1024 * 1024) {
  console.error('File too large (max 1MB):', stats.size, 'bytes');
  process.exit(1);
}

const form = new (require('form-data'))();
form.append('image', fs.createReadStream(filePath));

axios.post('https://img402.dev/api/free', form, {
  headers: form.getHeaders(),
})
.then(res => {
  console.log('Upload successful!');
  console.log(JSON.stringify(res.data, null, 2));
})
.catch(err => {
  console.error('Upload failed:', err.response?.status, err.response?.statusText);
  if (err.response?.data) {
    console.error('Details:', err.response.data);
  }
  process.exit(1);
});
