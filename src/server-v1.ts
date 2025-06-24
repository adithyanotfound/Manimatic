import { GoogleGenAI } from "@google/genai";
import { instructions } from "./instructions-v1.js";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import 'dotenv/config';

const app = express();
const execAsync = promisify(exec);

// Define base paths - use process.cwd() to get the project root
const PROJECT_ROOT = process.cwd();
const TEMP_DIR = path.join(PROJECT_ROOT, 'temp');
const VIDEOS_DIR = path.join(PROJECT_ROOT, 'videos');

// Middleware
app.use(express.json());
app.use(cors());

// Serve static files from the videos directory
app.use('/videos', express.static(VIDEOS_DIR));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Create necessary directories
const ensureDirectories = async () => {
  const dirs = [TEMP_DIR, VIDEOS_DIR];
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`📁 Created/verified directory: ${dir}`);
    } catch (error) {
      console.error(`❌ Failed to create directory ${dir}:`, error);
    }
  }
};

// Extract Manim code from Gemini response
const extractManimCode = (response: string): string => {
  const codeBlockRegex = /```python\n([\s\S]*?)\n```/;
  const match = response.match(codeBlockRegex);
  
  if (match) {
    return match[1];
  }
  
  // If no code block found, look for BEGIN_MANIM_CODE and END_MANIM_CODE
  const beginIndex = response.indexOf('BEGIN_MANIM_CODE');
  const endIndex = response.indexOf('END_MANIM_CODE');
  
  if (beginIndex !== -1 && endIndex !== -1) {
    return response.substring(beginIndex + 'BEGIN_MANIM_CODE'.length, endIndex).trim();
  }
  
  // If neither pattern found, assume the entire response is code
  return response;
};

// Generate Manim code using Gemini
async function generateManimCode(userPrompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: instructions,
        temperature: 0.5,
      },
    });
    
    return extractManimCode(response.text ?? "");
  } catch (error) {
    console.error("Error generating Manim code:", error);
    throw new Error("Failed to generate Manim code");
  }
}

// Execute Manim code and return video path
async function executeManimCode(code: string, sceneClass: string = "Scene"): Promise<string> {
  const fileId = uuidv4();
  const pythonFilePath = path.join(TEMP_DIR, `${fileId}.py`);
  
  try {
    // Write Python code to file
    await fs.writeFile(pythonFilePath, code);
    console.log(`📝 Created Python file: ${pythonFilePath}`);
    
    // Execute Manim command with explicit output directory
    const manimCommand = `manim "${pythonFilePath}" ${sceneClass} --output_file "${fileId}" --media_dir "${VIDEOS_DIR}" --format mp4 -q m`;
    
    console.log(`🎬 Executing: ${manimCommand}`);
    const { stdout, stderr } = await execAsync(manimCommand, {
      cwd: PROJECT_ROOT // Ensure we're running from project root
    });
    
    if (stderr) {
      console.warn("⚠️ Manim stderr:", stderr);
    }
    
    console.log("✅ Manim stdout:", stdout);
    
    // Manim typically creates videos in media_dir/videos/scene_class/quality/
    // Let's search for the generated file
    const possiblePaths = [
      path.join(VIDEOS_DIR, `${fileId}.mp4`),
      path.join(VIDEOS_DIR, 'videos', sceneClass, '720p30', `${fileId}.mp4`),
      path.join(VIDEOS_DIR, 'videos', sceneClass, '1080p60', `${fileId}.mp4`),
      path.join(VIDEOS_DIR, 'videos', `${fileId}.mp4`),
    ];
    
    // Check each possible path
    for (const possiblePath of possiblePaths) {
      try {
        await fs.access(possiblePath);
        console.log(`🎥 Found video at: ${possiblePath}`);
        
        // Move the video to the root videos directory with our desired name
        const finalPath = path.join(VIDEOS_DIR, `${fileId}.mp4`);
        if (possiblePath !== finalPath) {
          await fs.copyFile(possiblePath, finalPath);
          console.log(`📁 Moved video to: ${finalPath}`);
        }
        
        return `/videos/${fileId}.mp4`;
      } catch {
        // File doesn't exist at this path, continue searching
        continue;
      }
    }
    
    // If we didn't find the file in expected locations, search the entire videos directory
    console.log("🔍 Searching for video file in videos directory...");
    const files = await findVideoFiles(VIDEOS_DIR, fileId);
    
    if (files.length > 0) {
      const foundFile = files[0];
      console.log(`🎥 Found video file: ${foundFile}`);
      
      // Move to root videos directory
      const finalPath = path.join(VIDEOS_DIR, `${fileId}.mp4`);
      await fs.copyFile(foundFile, finalPath);
      console.log(`📁 Moved video to: ${finalPath}`);
      
      return `/videos/${fileId}.mp4`;
    }
    
    throw new Error("Video file not found after Manim execution");
    
  } catch (error) {
    console.error("❌ Error executing Manim:", error);
    throw new Error(`Failed to execute Manim: ${error}`);
  } finally {
    // Clean up temporary Python file
    try {
      await fs.unlink(pythonFilePath);
      console.log(`🗑️ Cleaned up temp file: ${pythonFilePath}`);
    } catch {
      // File might not exist or already deleted
    }
  }
}

// Helper function to recursively search for video files
async function findVideoFiles(dir: string, fileId: string): Promise<string[]> {
  const foundFiles: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subFiles = await findVideoFiles(fullPath, fileId);
        foundFiles.push(...subFiles);
      } else if (entry.isFile() && entry.name.includes(fileId) && entry.name.endsWith('.mp4')) {
        foundFiles.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return foundFiles;
}

// Extract scene class name from code
function extractSceneClassName(code: string): string {
  const classRegex = /class\s+(\w+)\s*\(\s*Scene\s*\)/;
  const match = code.match(classRegex);
  return match ? match[1] : "Scene";
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Manim server is running' });
});

// Generate and execute Manim video
app.post('/generate-video', async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }
  
  try {
    console.log(`Generating video for prompt: ${prompt}`);
    
    // Generate Manim code
    const code = await generateManimCode(prompt);
    console.log("Generated Manim code:", code.substring(0, 200) + "...");
    
    // Extract scene class name
    const sceneClassName = extractSceneClassName(code);
    console.log(`Scene class name: ${sceneClassName}`);
    
    // Execute Manim code
    const videoPath = await executeManimCode(code, sceneClassName);
    
    res.json({
      success: true,
      videoPath: videoPath,
      message: 'Video generated successfully'
    });
    
  } catch (error) {
    console.error("Error in /generate-video:", error);
    res.status(500).json({
      error: 'Failed to generate video',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate Manim code only (for debugging)
app.post('/generate-code', async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }
  
  try {
    const code = await generateManimCode(prompt);
    res.json({
      success: true,
      code: code
    });
  } catch (error) {
    console.error("Error in /generate-code:", error);
    res.status(500).json({
      error: 'Failed to generate code',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List available videos
app.get('/videos-list', async (req, res) => {
  try {
    const files = await fs.readdir(VIDEOS_DIR);
    const videoFiles = files.filter(file => file.endsWith('.mp4'));
    
    res.json({
      success: true,
      videos: PROJECT_ROOT + videoFiles.map(file => `/videos/${file}`),
      count: videoFiles.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list videos',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete a video
app.delete('/videos/:filename', async (req, res) => {
  const { filename } = req.params;
  
  try {
    const videoPath = path.join(VIDEOS_DIR, filename);
    await fs.unlink(videoPath);
    
    res.json({
      success: true,
      message: 'Video deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete video',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Initialize server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await ensureDirectories();
    
    app.listen(PORT, () => {
      console.log(`🚀 Manim server is running on port ${PORT}`);
      console.log(`📁 Project root: ${PROJECT_ROOT}`);
      console.log(`📁 Videos directory: ${VIDEOS_DIR}`);
      console.log(`📁 Temp directory: ${TEMP_DIR}`);
      console.log(`📺 Videos served at: http://localhost:${PORT}/videos/`);
      console.log(`🎬 Generate videos at: http://localhost:${PORT}/generate-video`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();