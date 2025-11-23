const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || `http://localhost:${PORT}`;
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 2 * 1024 * 1024 * 1024; // 2GB default

// Directories
const UPLOAD_DIR = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
const OUTPUT_DIR = path.join(__dirname, process.env.OUTPUT_DIR || 'output');
const ZSIGN_PATH = process.env.ZSIGN_PATH || 'zsign';

// Ensure directories exist
[UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || DOMAIN).split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());
app.use(express.static('public'));
app.use('/output', express.static(OUTPUT_DIR));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = req.body.sessionId || uuidv4();
    const sessionDir = path.join(UPLOAD_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.ipa', '.p12', '.mobileprovision'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`));
    }
  }
});

// API: Sign IPA
app.post('/api/sign', upload.fields([
  { name: 'ipa', maxCount: 1 },
  { name: 'certificate', maxCount: 1 },
  { name: 'provision', maxCount: 1 }
]), async (req, res) => {
  try {
    const { password, bundleId } = req.body;
    const sessionId = uuidv4();

    // Validate files
    if (!req.files || !req.files.ipa || !req.files.certificate || !req.files.provision) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required files. Please upload IPA, P12 certificate, and provisioning profile.' 
      });
    }

    const ipaFile = req.files.ipa[0];
    const certFile = req.files.certificate[0];
    const provisionFile = req.files.provision[0];

    const outputFileName = `${path.parse(ipaFile.originalname).name}_signed_${Date.now()}.ipa`;
    const outputPath = path.join(OUTPUT_DIR, outputFileName);

    // Build zsign command
    let zsignCmd = `${ZSIGN_PATH} -k "${certFile.path}"`;
    
    if (password) {
      zsignCmd += ` -p "${password}"`;
    }
    
    zsignCmd += ` -m "${provisionFile.path}"`;
    
    if (bundleId) {
      zsignCmd += ` -b "${bundleId}"`;
    }
    
    zsignCmd += ` -o "${outputPath}" "${ipaFile.path}"`;

    // Execute zsign
    exec(zsignCmd, (error, stdout, stderr) => {
      // Cleanup uploaded files
      const cleanupFiles = [ipaFile.path, certFile.path, provisionFile.path];
      cleanupFiles.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });

      // Cleanup session directory
      const sessionDir = path.dirname(ipaFile.path);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }

      if (error) {
        console.error('Signing error:', stderr || error.message);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to sign IPA. Please check your certificate and provisioning profile.',
          details: stderr || error.message
        });
      }

      // Generate install link
      const downloadUrl = `${DOMAIN}/output/${outputFileName}`;
      const installUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(`${DOMAIN}/api/manifest/${outputFileName}`)}`;

      res.json({
        success: true,
        message: 'IPA signed successfully',
        data: {
          fileName: outputFileName,
          downloadUrl: downloadUrl,
          installUrl: installUrl,
          size: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0
        }
      });
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// API: Generate manifest for OTA installation
app.get('/api/manifest/:filename', (req, res) => {
  const { filename } = req.params;
  const ipaUrl = `${DOMAIN}/output/${filename}`;
  
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${ipaUrl}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>com.example.app</string>
        <key>bundle-version</key>
        <string>1.0</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>Signed App</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;

  res.type('application/xml');
  res.send(manifest);
});

// API: List signed IPAs
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(OUTPUT_DIR)
      .filter(file => file.endsWith('.ipa'))
      .map(file => {
        const filePath = path.join(OUTPUT_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime,
          downloadUrl: `${DOMAIN}/output/${file}`
        };
      })
      .sort((a, b) => b.created - a.created);

    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Delete signed IPA
app.delete('/api/files/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(OUTPUT_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Health check
app.get('/api/health', (req, res) => {
  exec(`${ZSIGN_PATH} --version`, (error, stdout) => {
    res.json({
      status: 'ok',
      zsign: error ? 'not found' : 'available',
      version: stdout ? stdout.trim() : 'unknown'
    });
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 IPA Resign Server running on ${DOMAIN}`);
  console.log(`📁 Upload directory: ${UPLOAD_DIR}`);
  console.log(`📦 Output directory: ${OUTPUT_DIR}`);
  console.log(`🔧 zsign path: ${ZSIGN_PATH}`);
});