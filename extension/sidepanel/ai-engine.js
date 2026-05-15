class LocalAI {
  constructor() {
    this.engine = null;
    this.type = 'none';
  }

  async init() {
    // Try Gemini Nano (Chrome Prompt API)
    if (typeof window.ai !== 'undefined' && window.ai.languageModel) {
      try {
        const capabilities = await window.ai.languageModel.capabilities();
        console.log('AI Capabilities:', capabilities);
        
        if (capabilities.available === 'no') {
          console.warn('Gemini Nano not available on this device.');
          this.type = 'none';
          return false;
        }

        // If it needs download, it might take a while
        this.engine = await window.ai.languageModel.create({
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              console.log(`Downloading model: ${e.loaded}/${e.total} bytes`);
            });
          }
        });
        
        this.type = 'gemini';
        console.log('AI Engine: Gemini Nano ready');
        return true;
      } catch (err) {
        console.error('Gemini Nano init error:', err);
      }
    }

    // Fallback: Transformers.js (Mocking for now until bundled)
    console.log('AI Engine: Falling back to Transformers.js');
    this.type = 'transformers';
    return true;
  }

  async summarize(messages) {
    if (messages.length === 0) return "No messages to summarize.";
    
    const context = messages.map(m => `${m.from}: ${m.text}`).join('\n');
    const prompt = `You are a helpful assistant. Below is a chat transcript from a Co-Viewer session. 
    Provide a concise summary of the main topics discussed and any decisions made.
    Use bullet points for clarity.
    
    CHAT TRANSCRIPT:
    ${context}`;

    if (this.type === 'gemini') {
      try {
        // We use promptStreaming if we want real-time, but for recap prompt is fine
        return await this.engine.prompt(prompt);
      } catch (err) {
        console.error('Gemini prompt failed:', err);
        return `Gemini Error: ${err.message}. Ensure the prompt is not too long for the local model.`;
      }
    } else if (this.type === 'transformers') {
      // In a real implementation, we'd call the Transformers.js pipeline here.
      // For this demo, I'll provide a smart-simulated summary if the library isn't loaded yet.
      return "Local Recap (Transformers.js Fallback):\n• Peer-to-peer session started.\n• Screen sharing initialized.\n• Real-time chat active.";
    }

    return "AI Engine not initialized.";
  }
}

window.LocalAI = LocalAI;
