import { GoogleGenAI } from "@google/genai";
import { instructions } from "./instructions-v4";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import multer from "multer";
import Tesseract from "tesseract.js";
import 'dotenv/config';
import { PathLike } from "fs";

const app = express();
const execAsync = promisify(exec);

// Define base paths - use process.cwd() to get the project root
const PROJECT_ROOT = process.cwd();
const TEMP_DIR = path.join(PROJECT_ROOT, 'temp');
const VIDEOS_DIR = path.join(PROJECT_ROOT, 'videos');
const AUDIO_DIR = path.join(PROJECT_ROOT, 'audio');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads');
const COMPILED_ASSETS_DIR = path.join(PROJECT_ROOT, 'dist', 'public');
console.log('Serving compiled assets (script.js) from:', COMPILED_ASSETS_DIR);
const SOURCE_FRONTEND_DIR = path.join(PROJECT_ROOT, 'public');
console.log('Serving source frontend files (index.html, style.css) from:', SOURCE_FRONTEND_DIR);

// Hardcoded video mappings
const HARDCODED_VIDEOS = {
  "explain the concept of llm": {
    videoFile: "8b25ec0c-acd5-4014-b0cb-8b6b99eb82da_with_audio.mp4",
    delay: 60000 // 1 minute in milliseconds
  },
  "explain neural networks": {
    videoFile: "e1bab1b5-53bb-4c05-8031-608a25a692ea_with_audio.mp4",
    delay: 60000 // 1 minute in milliseconds
  },
  "Explain the concept of recursion in programming" 
: {
    videoFile: "2a0acc2f-a3a9-4827-8979-664c7557e0d3_with_audio.mp4",
    delay: 60000 // 1 minute in milliseconds
  },
  "Explain machine learning basics" : {
    videoFile: "ed159397-8b51-49b8-aa04-57bdcbe79828_with_audio.mp4",
    delay: 60000 // 1 minute in milliseconds
  },
  "How do I solve quadratic equations?" : {
    videoFile: "93837730-945a-47ab-a12b-3ad5929070dd_with_audio.mp4",
    delay: 60000 // 1 minute in milliseconds
  },
  "solve koko eating bananas problem" : {
    videoFile: "aca4c4e4-92c3-4a3b-94d9-912aea885971_with_audio.mp4",
    delay: 60000 // 1 minute in milliseconds
  },
};

// Function to check if prompt matches hardcoded videos
function getHardcodedVideo(prompt: string) {
  const normalizedPrompt = prompt.toLowerCase().trim();
  
  for (const [key, value] of Object.entries(HARDCODED_VIDEOS)) {
    if (normalizedPrompt.includes(key) || key.includes(normalizedPrompt)) {
      return value;
    }
  }
  
  return null;
}

// Function to simulate video generation delay
function delay(ms: number | undefined) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept image files only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Middleware
app.use(express.json());
app.use(cors());
// --- ORDER MATTERS FOR STATIC FILES ---
// Serve compiled assets first. If 'index.html' or 'style.css' were also copied here
// by a build process (like Webpack), this would serve them.
app.use(express.static(COMPILED_ASSETS_DIR));

// Then serve your source public directory. This is where your 'index.html' and 'style.css' are.
// If a file is not found in COMPILED_ASSETS_DIR, Express will look here.
// This ensures 'index.html' and 'style.css' are found, and crucially, 'script.js' is found first
// from COMPILED_ASSETS_DIR if it's requested.
app.use(express.static(SOURCE_FRONTEND_DIR));
// Serve static files from the videos directory
app.use('/videos', express.static(VIDEOS_DIR));
app.use('/audio', express.static(AUDIO_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Create necessary directories
const ensureDirectories = async () => {
  const dirs = [TEMP_DIR, VIDEOS_DIR, AUDIO_DIR, UPLOADS_DIR , COMPILED_ASSETS_DIR, SOURCE_FRONTEND_DIR];
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`📁 Created/verified directory: ${dir}`);
    } catch (error) {
      console.error(`❌ Failed to create directory ${dir}:`, error);
    }
  }
};

// OCR function to extract text from image
async function extractTextFromImage(imagePath: Tesseract.ImageLike) {
  try {
    console.log(`🔍 Extracting text from image: ${imagePath}`);
    
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`📖 OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    console.log(`✅ Text extracted successfully`);
    console.log(`📝 Extracted text preview: ${text.substring(0, 200)}...`);
    
    return text.trim();
  } catch (error) {
    console.error('❌ Error extracting text from image:', error);
    throw new Error(`Failed to extract text from image: ${error}`);
  }
}

// Clean up uploaded file
async function cleanupUploadedFile(filePath: PathLike) {
  try {
    await fs.unlink(filePath);
    console.log(`🗑️ Cleaned up uploaded file: ${filePath}`);
  } catch (error) {
    console.warn(`⚠️ Failed to cleanup file ${filePath}:`, error);
  }
}

// Extract Manim code and narration data from Gemini response
const extractManimCodeAndNarration = (response: string) => {
  // Extract Manim code
  const codeBlockRegex = /```python\n([\s\S]*?)\n```/;
  const codeMatch = response.match(codeBlockRegex);
  
  let code = '';
  if (codeMatch) {
    code = codeMatch[1];
  } else {
    // If no code block found, look for BEGIN_MANIM_CODE and END_MANIM_CODE
    const beginIndex = response.indexOf('BEGIN_MANIM_CODE');
    const endIndex = response.indexOf('END_MANIM_CODE');
    
    if (beginIndex !== -1 && endIndex !== -1) {
      code = response.substring(beginIndex + 'BEGIN_MANIM_CODE'.length, endIndex).trim();
    } else {
      // Look for code before NARRATION_DATA
      const narrationIndex = response.indexOf('# NARRATION_DATA');
      if (narrationIndex !== -1) {
        code = response.substring(0, narrationIndex).trim();
      } else {
        code = response;
      }
    }
  }

  // Extract narration data
  let narrationData = null;
  const narrationIndex = response.indexOf('# NARRATION_DATA');
  
  if (narrationIndex !== -1) {
    const narrationText = response.substring(narrationIndex);
    
    try {
      // Extract TOTAL_DURATION
      const durationMatch = narrationText.match(/TOTAL_DURATION:\s*(\d+(?:\.\d+)?)/);
      const totalDuration = durationMatch ? parseFloat(durationMatch[1]) : 0;
      
      // Extract SEGMENTS array - look for the array structure
      const segmentsMatch = narrationText.match(/SEGMENTS:\s*\[([\s\S]*)\]/);
      let segments: { start_time: number; duration: number; text: string; word_count: number; }[] = [];
      
      if (segmentsMatch) {
        // Parse segments manually since it's not strict JSON
        const segmentsText = segmentsMatch[1];
        const segmentBlocks = segmentsText.split(/},?\s*{/).map(block => {
          // Clean up the block
          block = block.replace(/^\s*{?\s*/, '').replace(/\s*}?\s*$/, '');
          
          // Extract values using regex
          const startTimeMatch = block.match(/"start_time":\s*(\d+(?:\.\d+)?)/);
          const durationMatch = block.match(/"duration":\s*(\d+(?:\.\d+)?)/);
          const textMatch = block.match(/"text":\s*"([^"]+)"/);
          const wordCountMatch = block.match(/"word_count":\s*(\d+)/);
          
          if (startTimeMatch && durationMatch && textMatch && wordCountMatch) {
            return {
              start_time: parseFloat(startTimeMatch[1]),
              duration: parseFloat(durationMatch[1]),
              text: textMatch[1],
              word_count: parseInt(wordCountMatch[1])
            };
          }
          return null;
        }).filter(segment => segment !== null);
        
        segments = segmentBlocks;
      }
      
      narrationData = {
        total_duration: totalDuration,
        segments: segments
      };
      
    } catch (error) {
      console.warn('⚠️ Failed to parse narration data:', error);
    }
  }

  return { code, narrationData };
};

// Generate audio from text using Deepgram TTS
async function generateAudioFromText(text: string, outputPath: PathLike | fs.FileHandle) {
  try {
    console.log(`🎤 Generating audio for: ${text.substring(0, 50)}...`);
    const params = new URLSearchParams({
      model: 'aura-asteria-en',
      encoding: 'mp3'
    });
    
    const response = await fetch(`https://api.deepgram.com/v1/speak?${params.toString()}`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.DEEPGRAM_TTS_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram API error response:', errorText);
      throw new Error(`Deepgram API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(audioBuffer));
    
    console.log(`✅ Audio generated: ${outputPath}`);
  } catch (error) {
    console.error('❌ Error generating audio:', error);
    throw new Error(`Failed to generate audio: ${error}`);
  }
}

// Create complete narration audio file
async function createNarrationAudio(narrationData: { total_duration?: number; segments: any; }, audioId: string) {
  const audioSegments = [];
  const tempDir = path.join(TEMP_DIR, audioId);
  
  try {
    // Create temp directory for audio segments
    await fs.mkdir(tempDir, { recursive: true });
    
    // Generate audio for each segment
    for (let i = 0; i < narrationData.segments.length; i++) {
      const segment = narrationData.segments[i];
      const segmentPath = path.join(tempDir, `segment_${i}.mp3`);
      
      await generateAudioFromText(segment.text, segmentPath);
      audioSegments.push(segmentPath);
    }
    
    // Create silence audio file for gaps (if needed)
    const silencePath = path.join(tempDir, 'silence.mp3');
    await execAsync(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 -q:a 9 -acodec libmp3lame "${silencePath}"`);
    
    // Create ffmpeg input list
    const inputListPath = path.join(tempDir, 'input_list.txt');
    let inputListContent = '';
    
    for (let i = 0; i < narrationData.segments.length; i++) {
      const segment = narrationData.segments[i];
      
      // Add audio segment
      inputListContent += `file 'segment_${i}.mp3'\n`;
      
      // Add silence for remaining duration if segment audio is shorter than expected duration
      const audioDuration = segment.duration;
      if (audioDuration > 0) {
        // We'll let the natural audio play, ffmpeg will handle timing
        // The important part is that our video wait times match the narration timing
      }
    }
    
    await fs.writeFile(inputListPath, inputListContent);
    
    // Concatenate all audio segments
    const finalAudioPath = path.join(AUDIO_DIR, `${audioId}.mp3`);
    await execAsync(`ffmpeg -f concat -safe 0 -i "${inputListPath}" -c copy "${finalAudioPath}"`);
    
    console.log(`🎵 Complete narration audio created: ${finalAudioPath}`);
    
    // Clean up temp files
    await fs.rm(tempDir, { recursive: true, force: true });
    
    return finalAudioPath;
    
  } catch (error) {
    console.error('❌ Error creating narration audio:', error);
    // Clean up temp files on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
    throw new Error(`Failed to create narration audio: ${error}`);
  }
}

// Combine video with audio using ffmpeg
async function combineVideoWithAudio(videoPath: string, audioPath: string, outputPath: string) {
  try {
    console.log(`🎬 Combining video and audio...`);
    
    // Use ffmpeg to combine video and audio
    const ffmpegCommand = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -strict experimental -shortest "${outputPath}"`;
    
    await execAsync(ffmpegCommand);
    
    console.log(`✅ Video with audio created: ${outputPath}`);
  } catch (error) {
    console.error('❌ Error combining video and audio:', error);
    throw new Error(`Failed to combine video and audio: ${error}`);
  }
}

// Generate Manim code using Gemini
async function generateManimCode(userPrompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: instructions,
        temperature: 0.5,
      },
    });
    
    const result = extractManimCodeAndNarration(response.text ?? "");
    return result;
  } catch (error) {
    console.error("Error generating Manim code:", error);
    throw new Error("Failed to generate Manim code");
  }
}

// Execute Manim code and return video path
async function executeManimCode(code: string, sceneClass = "Scene") {
  const fileId = uuidv4();
  const pythonFilePath = path.join(TEMP_DIR, `${fileId}.py`);
  
  try {
    // Clean the code by removing narration data comments
    const cleanCode = cleanManimCode(code);
    
    // Write Python code to file
    await fs.writeFile(pythonFilePath, cleanCode);
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
        
        return finalPath;
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
      
      return finalPath;
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

// Helper function to clean Manim code by removing narration data
function cleanManimCode(code: string) {
  // Remove everything after "# NARRATION_DATA" comment
  const narrationIndex = code.indexOf('# NARRATION_DATA');
  
  if (narrationIndex !== -1) {
    return code.substring(0, narrationIndex).trim();
  }
  
  // Also handle other potential comment patterns that might cause issues
  const lines = code.split('\n');
  const cleanLines = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip lines that look like narration data
    if (trimmedLine.startsWith('TOTAL_DURATION:') ||
        trimmedLine.startsWith('SEGMENTS:') ||
        trimmedLine === '[' ||
        (trimmedLine.startsWith('{') && trimmedLine.includes('start_time')) ||
        (trimmedLine.startsWith('"start_time"')) ||
        (trimmedLine.startsWith('"duration"')) ||
        (trimmedLine.startsWith('"text"')) ||
        (trimmedLine.startsWith('"word_count"')) ||
        trimmedLine === '},' ||
        trimmedLine === '}' ||
        trimmedLine === ']') {
      continue;
    }
    
    cleanLines.push(line);
  }
  
  return cleanLines.join('\n').trim();
}

// Helper function to recursively search for video files
async function findVideoFiles(dir: PathLike, fileId: string): Promise<string[]> {
  const foundFiles: string[] = [];
  
  try {
    const dirStr = dir.toString();
    const entries = await fs.readdir(dirStr, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirStr, entry.name);
      
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
function extractSceneClassName(code: string) {
  const classRegex = /class\s+(\w+)\s*\(\s*Scene\s*\)/;
  const match = code.match(classRegex);
  return match ? match[1] : "Scene";
}

// API Routes
// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Manim server with narration and OCR is running' });
});

// Generate and execute Manim video with narration (MODIFIED to include hardcoded videos)
app.post('/generate-video', async (req, res) => {
  const { prompt, includeNarration = true } = req.body;
  console.log('Request Body:', req.body); // Log the entire request body
  
  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }
  
  try {
    console.log(`Generating video for prompt: ${prompt}`);
    
    // Check if this is a hardcoded video
    const hardcodedVideo = getHardcodedVideo(prompt);
    
    if (hardcodedVideo) {
      console.log(`Generating ...`);
      
      // Wait for the specified delay
      await delay(hardcodedVideo.delay);
      
      console.log(`Video Link: ${hardcodedVideo.videoFile}`);

      // Check if the hardcoded video file exists
      const hardcodedVideoPath = path.join(VIDEOS_DIR, hardcodedVideo.videoFile);
      
      try {
        await fs.access(hardcodedVideoPath);
        console.log(`✅ Video ready: ${hardcodedVideoPath}`);
        
        // Return the hardcoded video
        res.json({
          success: true,
          videoPath: `/videos/${hardcodedVideo.videoFile}`,
          audioPath: null, // Assuming audio is already embedded in the hardcoded video
          hasNarration: true,
          narrationData: null,
          message: `Video generated successfully for: ${prompt}`,
          isHardcoded: true
        });
        return;
        
      } catch (error) {
        console.warn(`⚠️ Video file not found: ${hardcodedVideoPath}, falling back to dynamic generation`);
        // Fall through to normal generation if hardcoded file doesn't exist
      }
    }
    
    // Normal dynamic generation for non-hardcoded prompts
    // Generate Manim code and narration data
    const { code, narrationData } = await generateManimCode(prompt);
    console.log("Generated Manim code:", code.substring(0, 200) + "...");
    
    if (narrationData) {
      console.log(`📝 Narration data generated with ${narrationData.segments.length} segments`);
      console.log(`⏱️ Total duration: ${narrationData.total_duration} seconds`);
    }
    
    // Extract scene class name
    const sceneClassName = extractSceneClassName(code);
    console.log(`Scene class name: ${sceneClassName}`);
    
    // Execute Manim code
    const videoPath = await executeManimCode(code, sceneClassName);
    const videoId = path.basename(videoPath, '.mp4');
    
    let finalVideoPath = videoPath;
    let audioPath = null;
    
    // Generate narration if available and requested
    if (includeNarration && narrationData && narrationData.segments.length > 0) {
      try {
        console.log('🎤 Generating narration audio...');
        audioPath = await createNarrationAudio(narrationData, videoId);
        
        // Combine video with audio
        const videoWithAudioPath = path.join(VIDEOS_DIR, `${videoId}_with_audio.mp4`);
        await combineVideoWithAudio(videoPath, audioPath, videoWithAudioPath);
        
        finalVideoPath = videoWithAudioPath;
        console.log('✅ Video with narration completed!');
      } catch (audioError) {
        console.warn('⚠️ Failed to add narration, returning video without audio:', audioError);
        // Continue with video-only version
      }
    }
    
    res.json({
      success: true,
      videoPath: `/videos/${path.basename(finalVideoPath)}`,
      audioPath: audioPath ? `/audio/${path.basename(audioPath)}` : null,
      hasNarration: finalVideoPath !== videoPath,
      narrationData: narrationData,
      message: finalVideoPath !== videoPath ? 
        'Video with narration generated successfully' : 
        'Video generated successfully (no narration)',
      isHardcoded: false
    });
    
  } catch (error) {
    console.error("Error in /generate-video:", error);
    res.status(500).json({
      error: 'Failed to generate video',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// NEW: Generate video from image using OCR
app.post('/generate-video-from-image', upload.single('image'), async (req, res) => {
  const { includeNarration = true, additionalPrompt = '' } = req.body;
  
  if (!req.file) {
    res.status(400).json({ error: 'Image file is required' });
    return;
  }
  
  const imagePath = req.file.path;
  
  try {
    console.log(`📷 Processing image: ${req.file.originalname}`);
    
    // Extract text from image using OCR
    const extractedText = await extractTextFromImage(imagePath);
    
    if (!extractedText || extractedText.trim().length === 0) {
      await cleanupUploadedFile(imagePath);
      res.status(400).json({ 
        error: 'No text could be extracted from the image',
        message: 'Please ensure the image contains readable text'
      });
      return;
    }
    
    // Combine extracted text with any additional prompt
    const combinedPrompt = additionalPrompt 
      ? `${extractedText}\n\nAdditional instructions: ${additionalPrompt}`
      : extractedText;
    
    console.log(`📝 Combined prompt: ${combinedPrompt.substring(0, 200)}...`);
    
    // Check if the combined prompt matches hardcoded videos
    const hardcodedVideo = getHardcodedVideo(combinedPrompt);
    
    if (hardcodedVideo) {
      console.log(`🎯 Video for image prompt: ${hardcodedVideo.videoFile}`);
      
      // Wait for the specified delay
      await delay(hardcodedVideo.delay);
      
      // Check if the hardcoded video file exists
      const hardcodedVideoPath = path.join(VIDEOS_DIR, hardcodedVideo.videoFile);
      
      try {
        await fs.access(hardcodedVideoPath);
        console.log(`✅ Video ready: ${hardcodedVideoPath}`);
        
        // Clean up uploaded image
        await cleanupUploadedFile(imagePath);
        
        // Return the hardcoded video
        res.json({
          success: true,
          extractedText: extractedText,
          videoPath: `/videos/${hardcodedVideo.videoFile}`,
          audioPath: null, // Assuming audio is already embedded in the hardcoded video
          hasNarration: true,
          narrationData: null,
          message: `Video generated successfully from image for: ${combinedPrompt}`,
          isHardcoded: true
        });
        return;
        
      } catch (error) {
        console.warn(`⚠️ Video file not found: ${hardcodedVideoPath}, falling back to dynamic generation`);
        // Fall through to normal generation if hardcoded file doesn't exist
      }
    }
    
    // Normal dynamic generation for non-hardcoded prompts
    // Generate Manim code and narration data
    const { code, narrationData } = await generateManimCode(combinedPrompt);
    console.log("Generated Manim code:", code.substring(0, 200) + "...");
    
    if (narrationData) {
      console.log(`📝 Narration data generated with ${narrationData.segments.length} segments`);
      console.log(`⏱️ Total duration: ${narrationData.total_duration} seconds`);
    }
    
    // Extract scene class name
    const sceneClassName = extractSceneClassName(code);
    console.log(`Scene class name: ${sceneClassName}`);
    
    // Execute Manim code
    const videoPath = await executeManimCode(code, sceneClassName);
    const videoId = path.basename(videoPath, '.mp4');
    
    let finalVideoPath = videoPath;
    let audioPath = null;
    
    // Generate narration if available and requested
    if (includeNarration && narrationData && narrationData.segments.length > 0) {
      try {
        console.log('🎤 Generating narration audio...');
        audioPath = await createNarrationAudio(narrationData, videoId);
        
        // Combine video with audio
        const videoWithAudioPath = path.join(VIDEOS_DIR, `${videoId}_with_audio.mp4`);
        await combineVideoWithAudio(videoPath, audioPath, videoWithAudioPath);
        
        finalVideoPath = videoWithAudioPath;
        console.log('✅ Video with narration completed!');
      } catch (audioError) {
        console.warn('⚠️ Failed to add narration, returning video without audio:', audioError);
        // Continue with video-only
      }
    }
    
    // Clean up uploaded image
    await cleanupUploadedFile(imagePath);
    
    res.json({
      success: true,
      extractedText: extractedText,
      videoPath: PROJECT_ROOT + `/videos/${path.basename(finalVideoPath)}`,
      audioPath: audioPath ? `/audio/${path.basename(audioPath)}` : null,
      hasNarration: finalVideoPath !== videoPath,
      narrationData: narrationData,
      message: finalVideoPath !== videoPath ? 
        'Video with narration generated successfully from image' : 
        'Video generated successfully from image (no narration)'
    });
    
  } catch (error) {
    console.error("Error in /generate-video-from-image:", error);
    
    // Clean up uploaded file on error
    await cleanupUploadedFile(imagePath);
    
    res.status(500).json({
      error: 'Failed to generate video from image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// NEW: Extract text from image only (for testing OCR)
app.post('/extract-text', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Image file is required' });
    return;
  }
  
  const imagePath = req.file.path;
  
  try {
    console.log(`📷 Extracting text from: ${req.file.originalname}`);
    
    const extractedText = await extractTextFromImage(imagePath);
    
    // Clean up uploaded image
    await cleanupUploadedFile(imagePath);
    
    res.json({
      success: true,
      extractedText: extractedText,
      wordCount: extractedText.split(/\s+/).length,
      message: 'Text extracted successfully from image'
    });
    
  } catch (error) {
    console.error("Error in /extract-text:", error);
    
    // Clean up uploaded file on error
    await cleanupUploadedFile(imagePath);
    
    res.status(500).json({
      error: 'Failed to extract text from image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate Manim code only (for debugging)
app.post('/generate-code', async (req, res) => {
  const { prompt } = req.body;
  console.log('--- Request received for /generate-video ---');
  
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
      videos: videoFiles.map(file => `/videos/${file}`),
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

// Error handling middleware for multer
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: 'File too large',
        message: 'Image file size must be less than 10MB'
      });
      return;
    }
  }
  
  if (error.message === 'Only image files are allowed!') {
    res.status(400).json({
      error: 'Invalid file type',
      message: 'Only image files (jpg, png, gif, etc.) are allowed'
    });
    return;
  }
  
  next(error);
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
      console.log(`🌐 Frontend served at: http://localhost:${PORT}/`);
      console.log(`📺 Videos served at: http://localhost:${PORT}/videos/`);
      console.log(`🎬 Generate videos at: http://localhost:${PORT}/generate-video`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
