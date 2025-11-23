# IPA Resign Web Application with API

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

A modern web application and API for resigning iOS IPA files using [zsign](https://github.com/zhlynn/zsign). This tool allows you to resign iOS applications with your own certificates and provisioning profiles through an intuitive web interface or programmatic API.

![IPA Resign Tool](https://img.shields.io/badge/IPA-Resign-brightgreen)

## 🌟 Features

- **🎨 Modern Web Interface** - Clean, responsive UI for easy IPA resigning
- **🔌 RESTful API** - Programmatic access for automation and integration
- **📦 Batch Processing** - Handle multiple IPA files efficiently
- **🔐 Secure** - Files are automatically cleaned up after processing
- **📱 OTA Installation** - Generate install links for direct device installation
- **💾 File Management** - View, download, and delete signed IPAs
- **🚀 Fast & Efficient** - Built with Express.js for optimal performance

## 📋 Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   ```bash
   # Check version
   node --version
   npm --version
   ```

2. **zsign** - iOS signing tool
   
   **macOS/Linux:**
   ```bash
   # Clone and install zsign
   git clone https://github.com/zhlynn/zsign.git
   cd zsign
   chmod +x INSTALL.sh
   ./INSTALL.sh
   
   # Copy to system path
   sudo cp bin/zsign /usr/local/bin/
   # or
   sudo cp bin/zsign /usr/bin/
   ```

   **Verify installation:**
   ```bash
   zsign --version
   ```

### Required Files for Signing

1. **IPA File** - The iOS application to be resigned
2. **P12 Certificate** - Your signing certificate (exported from Keychain Access)
3. **Provisioning Profile** - Mobile provisioning file (.mobileprovision)
4. **Certificate Password** - Password for the P12 file (if set)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/iStoreBox-Dev/ipa-resign-app.git
cd ipa-resign-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Upload Configuration
MAX_FILE_SIZE=2147483648
UPLOAD_DIR=./uploads
OUTPUT_DIR=./output

# Domain Configuration (important for OTA installation)
DOMAIN=https://yourdomain.com

# zsign Configuration
ZSIGN_PATH=/usr/local/bin/zsign

# Security
ALLOWED_ORIGINS=https://yourdomain.com
```

### 4. Start the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

The application will be available at `http://localhost:3000`

## 📖 Usage

### Web Interface

1. Open your browser and navigate to `http://localhost:3000`
2. Upload your IPA file
3. Upload your P12 certificate
4. Upload your provisioning profile
5. Enter certificate password (if required)
6. Optionally specify a custom bundle ID
7. Click "Sign IPA"
8. Download or install the signed IPA

### API Endpoints

#### 1. Sign IPA

**POST** `/api/sign`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `ipa` (file) - IPA file to sign
- `certificate` (file) - P12 certificate
- `provision` (file) - Provisioning profile
- `password` (string, optional) - Certificate password
- `bundleId` (string, optional) - Custom bundle identifier

**Example with cURL:**

```bash
curl -X POST http://localhost:3000/api/sign \
  -F "ipa=@app.ipa" \
  -F "certificate=@cert.p12" \
  -F "provision=@profile.mobileprovision" \
  -F "password=mypassword" \
  -F "bundleId=com.example.newapp"
```

**Example with JavaScript:**

```javascript
const formData = new FormData();
formData.append('ipa', ipaFile);
formData.append('certificate', certFile);
formData.append('provision', provisionFile);
formData.append('password', 'mypassword');
formData.append('bundleId', 'com.example.newapp');

const response = await fetch('http://localhost:3000/api/sign', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

**Response:**

```json
{
  "success": true,
  "message": "IPA signed successfully",
  "data": {
    "fileName": "app_signed_1234567890.ipa",
    "downloadUrl": "http://localhost:3000/output/app_signed_1234567890.ipa",
    "installUrl": "itms-services://?action=download-manifest&url=...",
    "size": 45678901
  }
}
```

#### 2. List Signed Files

**GET** `/api/files`

```bash
curl http://localhost:3000/api/files
```

**Response:**

```json
{
  "success": true,
  "files": [
    {
      "name": "app_signed_1234567890.ipa",
      "size": 45678901,
      "created": "2024-01-15T10:30:00.000Z",
      "downloadUrl": "http://localhost:3000/output/app_signed_1234567890.ipa"
    }
  ]
}
```

#### 3. Delete File

**DELETE** `/api/files/:filename`

```bash
curl -X DELETE http://localhost:3000/api/files/app_signed_1234567890.ipa
```

#### 4. Health Check

**GET** `/api/health`

```bash
curl http://localhost:3000/api/health
```

**Response:**

```json
{
  "status": "ok",
  "zsign": "available",
  "version": "zsign 0.5"
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|----------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `MAX_FILE_SIZE` | Max upload size (bytes) | `2147483648` (2GB) |
| `UPLOAD_DIR` | Temporary upload directory | `./uploads` |
| `OUTPUT_DIR` | Signed files directory | `./output` |
| `DOMAIN` | Public domain URL | `http://localhost:3000` |
| `ZSIGN_PATH` | Path to zsign binary | `zsign` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:3000` |

### zsign Options

The API supports the following zsign options:

- `-k` : P12 certificate path (required)
- `-p` : Certificate password (optional)
- `-m` : Provisioning profile path (required)
- `-b` : Custom bundle identifier (optional)
- `-o` : Output IPA path (automatic)

## 🐳 Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

# Install dependencies for zsign
RUN apk add --no-cache git g++ make openssl-dev

# Install zsign
WORKDIR /tmp
RUN git clone https://github.com/zhlynn/zsign.git && \
    cd zsign && \
    chmod +x INSTALL.sh && \
    ./INSTALL.sh && \
    cp bin/zsign /usr/local/bin/

# Setup application
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

# Create directories
RUN mkdir -p uploads output

EXPOSE 3000
CMD ["npm", "start"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  ipa-resign:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - DOMAIN=http://localhost:3000
      - ZSIGN_PATH=/usr/local/bin/zsign
    volumes:
      - ./uploads:/app/uploads
      - ./output:/app/output
    restart: unless-stopped
```

**Run with Docker:**

```bash
docker-compose up -d
```

## 📱 OTA Installation

For over-the-air installation to work:

1. **Use HTTPS** - iOS requires secure connections
2. **Set correct DOMAIN** - Must be publicly accessible
3. **Configure DNS** - Point your domain to your server

**Example nginx configuration:**

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 2G;
    }
}
```

## 🛡️ Security Considerations

1. **File Cleanup** - Uploaded files are automatically deleted after processing
2. **CORS** - Configure `ALLOWED_ORIGINS` to restrict access
3. **File Size Limits** - Prevent DoS attacks with `MAX_FILE_SIZE`
4. **HTTPS** - Always use HTTPS in production
5. **Authentication** - Consider adding authentication for production use
6. **Rate Limiting** - Implement rate limiting to prevent abuse

## 🔍 Troubleshooting

### zsign not found

```bash
# Verify installation
which zsign
zsign --version

# Update .env with correct path
ZSIGN_PATH=/usr/local/bin/zsign
```

### Certificate errors

- Ensure P12 certificate is valid
- Check password is correct
- Verify certificate hasn't expired

### Provisioning profile mismatch

- Ensure provisioning profile matches the certificate
- Check bundle ID in provisioning profile
- Verify device UDIDs are included (for development profiles)

### Upload fails

- Check `MAX_FILE_SIZE` setting
- Ensure disk space is available
- Verify file permissions for `uploads` and `output` directories

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

If you have any questions or run into issues, please:

- Open an [issue](https://github.com/iStoreBox-Dev/ipa-resign-app/issues)
- Check existing issues for solutions

## 🙏 Acknowledgments

- [zsign](https://github.com/zhlynn/zsign) - iOS signing tool
- [Express.js](https://expressjs.com/) - Web framework
- [Multer](https://github.com/expressjs/multer) - File upload handling

## 📚 Resources

- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [iOS App Distribution](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
- [zsign Documentation](https://github.com/zhlynn/zsign)

---

**Made with ❤️ by iStoreBox-Dev**