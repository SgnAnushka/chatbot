import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';

function App() {
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatEndRef = useRef(null);
  const backendUrl = 'https://geminichatbot-rfk5.onrender.com';
  const [welcomeMessage, setWelcomeMessage] = useState('');

  //ask question function se start
  const askQuestion = async () => {
    if (!question.trim() && !file) return;

    let userMessage = question.trim();
    if (file) {
      userMessage = userMessage ? `${userMessage} (File: ${file.name})` : `File: ${file.name}`;
    }

    setConversation((prev) => [...prev, { role: 'user', content: userMessage }]);
    setQuestion('');
    setLoading(true);

    try {
      const formData = new FormData();

      if (file) {
        formData.append('file', file);
      }

      if (question.trim()) {
        formData.append('message', question);
      }

      const response = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let botMessage = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          const chunk = decoder.decode(value);
          const cleanedChunk = chunk.replace(/data: /g, '');
          botMessage += cleanedChunk;

          setConversation((prevConversation) => {
            const lastMessage = prevConversation[prevConversation.length - 1];
            if (lastMessage && lastMessage.role === 'bot') {
              return [
                ...prevConversation.slice(0, -1),
                { role: 'bot', content: botMessage },
              ];
            } else {
              return [...prevConversation, { role: 'bot', content: botMessage }];
            }
          });
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setConversation((prev) => [
        ...prev,
        { role: 'bot', content: 'Error: Could not get a response or file size is more than 4MB' },
      ]);
    } finally {
      setLoading(false);
      setFile(null);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  useEffect(() => {
    const welcomeMessageText = "Welcome to Gemini AI! Ask any question or upload a text or PDF file to get started. there will be a delay of 50 sec for first message";
    setWelcomeMessage(welcomeMessageText);
    setConversation([{ role: 'bot', content: welcomeMessageText }]);

    //speak(welcomeMessageText); // no automatic start
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    const allowedTypes = ['text/plain', 'application/pdf'];
    
    if (selectedFile && !allowedTypes.includes(selectedFile.type)) {
      alert('Only text and PDF files are supported.');
      setFile(null);
      return;
    }
    setFile(selectedFile);
  };

  const handleCopyToClipboard = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      alert('Code copied to clipboard!');
    });
  };

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleSpeechToText = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Your browser does not support speech recognition.');
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript;
      setQuestion(speechResult);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event);
      alert('Speech recognition error, please try again.');
      setIsRecording(false);
    };

    recognition.start();
  };

  const formatMessage = (message) => {
    const lines = message.split('\n').map((line, idx) => {
      if (line.startsWith('```') && line.endsWith('```')) { //kam nhi kar rha bkl
        const codeContent = line.slice(3, -3);
        const language = 'javascript';

        return (
          <div key={idx} className="code-block">
            <SyntaxHighlighter language={language} style={solarizedlight}>
              {codeContent}
            </SyntaxHighlighter>
            <button onClick={() => handleCopyToClipboard(codeContent)}>Copy</button>
          </div>
        );
      }
      else if (line.startsWith('* ')) {
        const content = line.slice(2);
        const boldedContent = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return <li key={idx} dangerouslySetInnerHTML={{ __html: boldedContent }} />;
      }
      else {
        const boldedText = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return <span key={idx} dangerouslySetInnerHTML={{ __html: boldedText }} />;
      }
    });

    return <ul>{lines}</ul>;
  };

  return (
    <div className="app-container">
      <h1 className="app-title">Gemini AI Chat</h1>

      <div className="chat-box">
        {conversation.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.role}`}>
            <div className="message-content">
              {msg.role === 'bot' ? (
                <div>
                  <strong>Gemini:</strong>
                  {formatMessage(msg.content)}
                  <button onClick={() => speak(msg.content)} className="tts-button">
                    🔊 Speak
                  </button>
                  {isSpeaking && (
                    <button onClick={stopSpeaking} className="tts-stop-button">
                      ⏹️ Stop
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <strong>You:</strong> {msg.content}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="loading-indicator">Gemini is typing...</div>}
        <div ref={chatEndRef} />
      </div>

      <div className="input-box">
        <textarea
          className="input-textarea"
          rows="2"
          placeholder="Type your question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              askQuestion();
            }
          }}
        />
        <input type="file" onChange={handleFileChange} />
        <button
          className="send-button"
          onClick={askQuestion}
          disabled={loading || (!question.trim() && !file)}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>

        <button onClick={handleSpeechToText} className="stt-button">
          {isRecording ? '⏹️ Stop Recording' : '🎤 Speak'}
        </button>
      </div>
    </div>
  );
}

export default App;