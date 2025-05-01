import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { analyzeScreenplay } from './llm.js';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Add timing utility at the top of the file
const getTimestamp = () => new Date().toISOString();
const logWithTime = (message, data = {}) => {
  console.log(`[${getTimestamp()}] ${message}`, data);
};

// Memory monitoring
const logMemoryUsage = () => {
  const used = process.memoryUsage();
  console.log('Memory usage:', {
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(used.external / 1024 / 1024)}MB`
  });
};

// Configure CORS with more permissive settings for development
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

// Add JSON body parsing middleware
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage with unique filenames
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer upload with validation
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only PDF and text files
    const allowedTypes = ['application/pdf', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and text files are allowed.'));
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Store analysis progress and results
const progressMap = new Map();
const analysisResults = new Map();

// Cleanup function for temporary files
const cleanupFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Cleaned up temporary file:', filePath);
    }
  } catch (error) {
    console.error('Error cleaning up file:', filePath, error);
  }
};

app.post('/api/upload', upload.single('screenplay'), async (req, res) => {
  const startTime = Date.now();
  const requestId = Date.now().toString();
  
  logWithTime(`[${requestId}] Starting upload request`);
  logMemoryUsage();

  try {
    if (!req.file) {
      logWithTime(`[${requestId}] No file uploaded`);
      return res.status(400).json({ 
        error: 'No file uploaded',
        requestId
      });
    }

    logWithTime(`[${requestId}] File received`, {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    const analysisId = req.file.filename;
    progressMap.set(analysisId, { status: 'Processing file...' });

    let text;
    try {
      if (req.file.mimetype === 'application/pdf') {
        logWithTime(`[${requestId}] Processing PDF file`, { path: req.file.path });
        
        const scriptPath = path.join(__dirname, 'extract_text.py');
        if (!fs.existsSync(scriptPath)) {
          logWithTime(`[${requestId}] Python script not found`, { path: scriptPath });
          throw new Error('PDF processing script not found');
        }

        const venvPython = path.join(__dirname, 'venv', 'bin', 'python3');
        const command = `"${venvPython}" "${scriptPath}" "${req.file.path}"`;
        logWithTime(`[${requestId}] Executing Python script`, { command });
        
        const timeout = setTimeout(() => {
          logWithTime(`[${requestId}] Python script execution timed out`);
          cleanupFile(req.file.path);
          return res.status(500).json({ 
            error: 'PDF processing timed out',
            requestId
          });
        }, 30000);

        exec(command, (error, stdout, stderr) => {
          clearTimeout(timeout);
          
          if (error) {
            logWithTime(`[${requestId}] Python script error`, { 
              error: error.message,
              stderr: stderr,
              code: error.code
            });
            cleanupFile(req.file.path);
            return res.status(500).json({ 
              error: 'Failed to extract text from PDF',
              details: error.message,
              stderr: stderr,
              requestId
            });
          }

          if (stderr) {
            logWithTime(`[${requestId}] Python script warning`, { stderr });
          }

          if (!stdout || stdout.trim() === '') {
            logWithTime(`[${requestId}] Python script returned empty output`);
            cleanupFile(req.file.path);
            return res.status(500).json({ 
              error: 'PDF text extraction returned empty result',
              requestId
            });
          }

          text = stdout;
          logWithTime(`[${requestId}] Text extracted successfully`, { 
            length: text.length,
            preview: text.substring(0, 100)
          });

          processAnalysis();
        });
      } else {
        logWithTime(`[${requestId}] Processing text file`, { path: req.file.path });
        text = fs.readFileSync(req.file.path, 'utf-8');
        logWithTime(`[${requestId}] Text file read successfully`, { 
          length: text.length,
          preview: text.substring(0, 100)
        });
        processAnalysis();
      }
    } catch (fileError) {
      logWithTime(`[${requestId}] File processing error`, { 
        error: fileError.message,
        stack: fileError.stack
      });
      cleanupFile(req.file.path);
      return res.status(500).json({ 
        error: 'Failed to process file',
        details: fileError.message,
        requestId
      });
    }

    async function processAnalysis() {
      try {
        logWithTime(`[${requestId}] Starting screenplay analysis`);
        const analysis = await analyzeScreenplay(text, (status) => {
          logWithTime(`[${requestId}] Analysis status update`, { status });
          progressMap.set(analysisId, { status });
        });

        const endTime = Date.now();
        logWithTime(`[${requestId}] Analysis complete`, { 
          duration: `${endTime - startTime}ms`,
          analysisId
        });
        
        cleanupFile(req.file.path);
        progressMap.delete(analysisId);
        // Store the completed analysis
        analysisResults.set(analysisId, analysis);
        logMemoryUsage();
        
        return res.status(200).json({
          success: true,
          message: 'Analysis complete',
          analysis,
          analysisId,
          requestId
        });
      } catch (analysisError) {
        logWithTime(`[${requestId}] Analysis error`, { 
          error: analysisError.message,
          stack: analysisError.stack,
          type: analysisError.name
        });

        // Clean up resources
        cleanupFile(req.file.path);
        progressMap.delete(analysisId);

        // Determine if this is an LLM-specific error
        const isLLMError = analysisError.message.includes('Ollama API error') || 
                          analysisError.message.includes('Failed to parse analysis results');

        // Return appropriate error response
        return res.status(isLLMError ? 422 : 500).json({ 
          error: isLLMError ? 'Failed to analyze screenplay content' : 'Failed to process screenplay',
          details: analysisError.message,
          type: analysisError.name,
          requestId
        });
      }
    }
  } catch (error) {
    logWithTime(`[${requestId}] Request error`, { 
      error: error.message,
      stack: error.stack
    });
    if (req.file) {
      progressMap.delete(req.file.filename);
      cleanupFile(req.file.path);
    }
    return res.status(500).json({ 
      error: 'Failed to analyze screenplay',
      details: error.message,
      requestId
    });
  }
});

app.get('/api/progress/:id', (req, res) => {
  const progress = progressMap.get(req.params.id);
  if (progress) {
    res.json(progress);
  } else {
    res.status(404).json({ error: 'Analysis not found' });
  }
});

// Update analysis endpoint
app.post('/api/analysis', async (req, res) => {
  const requestId = Date.now().toString();
  logWithTime(`[${requestId}] Analysis request received`, { 
    body: typeof req.body === 'object' ? JSON.stringify(req.body) : req.body,
    headers: req.headers
  });
  
  try {
    // Ensure we have a valid request body
    if (!req.body || typeof req.body !== 'object') {
      logWithTime(`[${requestId}] Invalid request body`, { 
        body: req.body, 
        type: typeof req.body 
      });
      return res.status(400).json({ 
        error: 'Invalid request body',
        requestId
      });
    }

    // Try to get the ID from either id or analysisId field
    let id = req.body.id || req.body.analysisId;
    logWithTime(`[${requestId}] Raw ID from request body`, { 
      id, 
      type: typeof id,
      bodyKeys: Object.keys(req.body) 
    });
    
    // Handle case where id is an object
    if (id && typeof id === 'object') {
      logWithTime(`[${requestId}] ID is an object, attempting to extract value`, { 
        id: JSON.stringify(id),
        keys: Object.keys(id) 
      });
      
      // Try to extract ID from various properties
      if (id.id) {
        id = id.id;
      } else if (id.analysisId) {
        id = id.analysisId;
      } else if (id.filename) {
        id = id.filename;
      } else {
        // If all else fails, try JSON stringify
        try {
          id = JSON.stringify(id);
        } catch (error) {
          id = id.toString();
        }
      }
      
      logWithTime(`[${requestId}] Extracted ID from object`, { id });
    }

    // Ensure id is a string and not the literal "[object Object]"
    if (!id || typeof id !== 'string' || id === '[object Object]' || id === 'undefined') {
      logWithTime(`[${requestId}] Invalid analysis ID`, { 
        body: JSON.stringify(req.body),
        id,
        type: typeof id
      });
      return res.status(400).json({ 
        error: 'Invalid analysis ID',
        requestId,
        details: 'Please provide a valid string ID in the request body'
      });
    }

    logWithTime(`[${requestId}] Processing request for analysis ID`, { id });

    // First check if analysis is complete
    const completedAnalysis = analysisResults.get(id);
    if (completedAnalysis) {
      logWithTime(`[${requestId}] Returning completed analysis`, { 
        id,
        analysisKeys: Object.keys(completedAnalysis)
      });
      
      // Log the full structure for debugging
      logWithTime(`[${requestId}] Analysis structure check`, {
        hasGenre: Boolean(completedAnalysis.genre),
        hasToneThemes: Boolean(completedAnalysis.toneThemes),
        hasCharacters: Boolean(completedAnalysis.characters),
        hasProduction: Boolean(completedAnalysis.production),
        hasAudience: Boolean(completedAnalysis.audience),
        hasGreenlight: Boolean(completedAnalysis.greenlight),
      });
      
      return res.status(200).json({
        success: true,
        analysis: completedAnalysis,
        requestId
      });
    }

    // If not complete, check progress
    const progress = progressMap.get(id);
    if (progress) {
      logWithTime(`[${requestId}] Analysis in progress`, { id, status: progress.status });
      return res.status(200).json({
        success: true,
        status: progress.status,
        isComplete: false,
        requestId
      });
    }

    // For debugging, log all stored analyses
    const allAnalysisIds = [...analysisResults.keys()];
    logWithTime(`[${requestId}] Analysis not found`, { 
      requestedId: id,
      availableIds: allAnalysisIds,
      analysisCount: allAnalysisIds.length
    });
    
    return res.status(404).json({ 
      error: 'Analysis not found',
      requestId,
      details: `No analysis found with ID: ${id}`,
      availableIds: allAnalysisIds.length > 0 ? allAnalysisIds : 'No analyses available'
    });
  } catch (error) {
    logWithTime(`[${requestId}] Analysis request error`, { 
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ 
      error: 'Failed to retrieve analysis',
      details: error.message,
      requestId
    });
  }
});

// Cleanup on server shutdown
process.on('SIGTERM', () => {
  console.log('Cleaning up temporary files...');
  fs.readdirSync(uploadsDir).forEach(file => {
    cleanupFile(path.join(uploadsDir, file));
  });
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log('Ensure Ollama is running with: ollama run mistral:7b-instruct-q4_K_M');
});