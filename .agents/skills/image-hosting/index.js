const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

/**
 * Image Hosting Skill
 * Uploads images to img402.dev
 */
module.exports = {
  name: 'image-hosting',
  version: '0.1.0',

  async uploadImage({ filePath }) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const maxSize = 1024 * 1024; // 1MB
    if (stats.size > maxSize) {
      throw new Error(`File too large (max 1MB). Got ${stats.size} bytes.`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    if (!allowed.includes(ext)) {
      throw new Error(`Unsupported format: ${ext}. Allowed: ${allowed.join(', ')}`);
    }

    const form = new FormData();
    form.append('image', fs.createReadStream(filePath));

    try {
      const response = await axios.post('https://img402.dev/api/free', form, {
        headers: {
          ...form.getHeaders(),
        },
      });

      const data = response.data;
      if (data.url) {
        return {
          success: true,
          url: data.url,
          id: data.id,
          expiresAt: data.expiresAt,
        };
      } else {
        throw new Error('No URL in response');
      }
    } catch (error) {
      if (error.response) {
        throw new Error(`Upload failed: ${error.response.status} ${error.response.statusText}`);
      }
      throw error;
    }
  },
};
