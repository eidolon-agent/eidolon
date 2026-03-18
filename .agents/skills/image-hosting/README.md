# Image Hosting Skill

Upload an image to img402.dev and get a public URL.

## Features

- No API key required
- Supports PNG, JPEG, GIF, WebP
- Max size 1MB
- Public CDN URL returned
- Retention: 7 days (free tier)

## Usage

```bash
# Upload an image
upload image to img402 from /path/to/image.png

# The agent will return:
# {
#   "url": "https://i.img402.dev/abc123.png",
#   "id": "abc123",
#   "expiresAt": "2026-03-25T..."
# }
```

## Paid tier

For longer persistence (1 year, up to 5MB), use the paid endpoint ($0.01 USDC via x402). See https://img402.dev/blog/paying-x402-apis.

## Implementation

This skill wraps https://img402.dev/api/free (POST multipart/form-data).
