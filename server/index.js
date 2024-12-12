const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer"); 
const fs = require("fs"); 
const pdfParse = require("pdf-parse"); 
require("dotenv").config(); 

const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(apiKey); 

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

const app = express();
app.use(cors());
app.use(bodyParser.json()); 


const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 4 * 1024 * 1024 }, //  file size limit = 4MB
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  const { message } = req.body; 
  const file = req.file; 

  try {
    let fileContent = ""; 

  
    if (file) {
      // If the file is a PDF
      if (file.mimetype === "application/pdf") {
        const dataBuffer = fs.readFileSync(file.path); // Read the PDF file
        const parsedData = await pdfParse(dataBuffer); // Extract text from the PDF
        fileContent = parsedData.text;
      } 
      // If the file is a plain text file
      else if (file.mimetype === "text/plain") {
        fileContent = fs.readFileSync(file.path, "utf8"); // Read the text file
      }

      
      fs.unlinkSync(file.path);
    }

    // Combine message and file
    const finalMessage = message && fileContent 
      ? `${message}\n\nFile Content:\n${fileContent}` 
      : (message || fileContent);

    if (!finalMessage) {
      return res.status(400).json({ error: 'No message or file provided' });
    }

    
    const chatSession = model.startChat({
      generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain",
      },
      history: [], 
    });

    
    const result = await chatSession.sendMessageStream(finalMessage);

    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text(); // Extract chunk text
      res.write(`data: ${chunkText}\n\n`); // Send each chunk 
    }

    res.end(); 
  } catch (error) {
    console.error("Error handling file or message:", error);
    res.status(500).json({ error: "Failed to process the request." });
  }
});

// Handle file size limit 
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: "File size exceeds the 4MB limit." });
    }
  } else if (err) {
    console.error("Error in file upload:", err);
    return res.status(500).json({ error: "File upload failed." });
  }
  next();
});

// Start the server 
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
