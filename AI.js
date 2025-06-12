// AI.js - Fixed Version

document.addEventListener("DOMContentLoaded", () => {
  // -------------------------- ELEMENT REFERENCES --------------------------

  const loginScreen = document.getElementById("loginScreen");
  const chatContainer = document.getElementById("chatContainer");
  const loginButton = document.getElementById("loginButton");
  const loginUsername = document.getElementById("loginUsername");
  const loginError = document.getElementById("loginError");

  const chatList = document.getElementById("chatList");
  const newChatButton = document.getElementById("newChatButton");
  const deleteChatButton = document.getElementById("deleteChatButton");
  const downloadChatButton = document.getElementById("downloadChatButton");

  const newChatDialog = document.getElementById("newChatDialog");
  const newChatName = document.getElementById("newChatName");
  const createChatConfirm = document.getElementById("createChatConfirm");
  const createChatCancel = document.getElementById("createChatCancel");
  const newChatError = document.getElementById("newChatError");

  const chatLog = document.getElementById("chatLog");
  const userInput = document.getElementById("userInput");
  const sendButton = document.getElementById("sendButton");
  const expressionTextDiv = document.getElementById("expression-text");

  let currentUser = null;
  let currentChat = null;

  // -------------------------- AI CONSTANTS --------------------------

  const API_KEY = "vD0OxXz47KrgYqEDR0IaznIbhBN8zjAO";
  const API_URL = "https://api.mistral.ai/v1/chat/completions";

  // -------------------------- CONVERSATION HISTORY --------------------------
  class ConversationHistory {
    constructor(maxTurns = 20) {
      this.maxTurns = maxTurns;
      this.history = [];
    }

    add(role, content) {
      this.history.push({ role, content });
      // No bounds on history - keep full chat for topic matching
    }

    getRecent() {
      return this.history.slice(-10); // Last 10 messages (5 rounds)
    }

    getTopic(topic) {
      if (!topic) return [];
      try {
        const re = new RegExp(topic.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
        return this.history.filter(msg => re.test(msg.content));
      } catch (e) {
        console.warn('Regex error with topic:', topic, e);
        return [];
      }
    }

    getContext(topic) {
      const recent = this.history.slice(-10); // Last 10 messages (5 rounds)
      if (!topic) return { recent, memories: [] };

      const earlier = this.history.slice(0, -10);
      try {
        const re = new RegExp(topic.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
        const memories = earlier.filter(msg => re.test(msg.content));
        return { recent, memories };
      } catch (e) {
        console.warn('Regex error in getContext:', topic, e);
        return { recent, memories: [] };
      }
    }
  }

  const convo = new ConversationHistory(20);

  // -------------------------- STORAGE HELPERS --------------------------
  function storageKeyForUser(username) {
    return `user_${username}`;
  }

  function getUserData(username) {
    try {
      const raw = localStorage.getItem(storageKeyForUser(username));
      if (!raw) {
        const init = { chats: {} };
        localStorage.setItem(storageKeyForUser(username), JSON.stringify(init));
        return init;
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error('Error parsing user data:', e);
      const init = { chats: {} };
      localStorage.setItem(storageKeyForUser(username), JSON.stringify(init));
      return init;
    }
  }

  function setUserData(username, data) {
    try {
      localStorage.setItem(storageKeyForUser(username), JSON.stringify(data));
    } catch (e) {
      console.error('Error saving user data:', e);
    }
  }

  function extractKeywords(text, maxKeywords = 3) {
    const stopwords = new Set(['the', 'is', 'and', 'what', 'how', 'why', 'a', 'of', 'to', 'in', 'on', 'for', 'with', 'i', 'you', 'ok', 'are', 'was', 'that', 'this', 'these', 'those', 'some', 'all', 'any', 'both', 'each', 'few', 'many', 'much', 'little', 'more', 'most', 'other', 'another', 'same', 'different']);
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];

    const freq = {};
    for (const word of words) {
      if (!stopwords.has(word) && word.length > 2) {
        freq[word] = (freq[word] || 0) + 1;
      }
    }

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, maxKeywords).map(([word]) => word);
  }

  // -------------------------- LOGIN FLOW --------------------------
  loginButton.addEventListener("click", () => {
    const username = loginUsername.value.trim();
    if (!username || username.length < 3 || username.length > 20) {
      loginError.textContent = "Username must be 3–20 characters.";
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(username)) {
      loginError.textContent = "Only letters, numbers, underscore, dash allowed.";
      return;
    }

    currentUser = username;
    getUserData(currentUser);
    loginError.textContent = "";
    loginScreen.classList.add("hidden");
    chatContainer.classList.remove("hidden");

    loadChatList();
  });

  // Add Enter key support for login
  loginUsername.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loginButton.click();
    }
  });

  // -------------------------- LOAD CHAT LIST --------------------------
  function loadChatList() {
    chatList.innerHTML = "";
    if (!currentUser) return;

    const data = getUserData(currentUser);
    const chatNames = Object.keys(data.chats);

    chatNames.forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      chatList.appendChild(option);
    });

    if (chatNames.length > 0) {
      currentChat = chatNames[0];
      chatList.value = currentChat;
      loadChatHistory(currentChat);
      deleteChatButton.disabled = false;
      downloadChatButton.disabled = false;
    } else {
      currentChat = null;
      chatLog.innerHTML = "";
      deleteChatButton.disabled = true;
      downloadChatButton.disabled = true;
    }

    newChatButton.disabled = chatNames.length >= 3;
  }

  chatList.addEventListener("change", () => {
    if (chatList.value) {
      currentChat = chatList.value;
      loadChatHistory(currentChat);
    }
  });

  // -------------------------- LOAD CHAT HISTORY --------------------------
  function loadChatHistory(chatName) {
    if (!chatName) return;
    
    const data = getUserData(currentUser);
    const history = data.chats[chatName] || [];
    chatLog.innerHTML = "";
    convo.history = [];

    history.forEach(msg => {
      // Skip system messages when displaying
      if (msg.role === 'user' || msg.role === 'assistant') {
        appendMessage(msg.role, msg.content);
        convo.add(msg.role, msg.content);
      }
    });

    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // -------------------------- CREATE NEW CHAT --------------------------

  newChatButton.addEventListener("click", () => {
    newChatError.textContent = "";
    newChatName.value = "";
    newChatDialog.classList.remove("hidden");
    newChatName.focus();
  });

  createChatCancel.addEventListener("click", () => {
    newChatDialog.classList.add("hidden");
  });

  // Add Enter key support for new chat
  newChatName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      createChatConfirm.click();
    }
  });

  createChatConfirm.addEventListener("click", () => {
    const chatName = newChatName.value.trim();
    if (!chatName || chatName.length < 3 || chatName.length > 20) {
      newChatError.textContent = "Chat name must be 3–20 characters.";
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(chatName)) {
      newChatError.textContent = "Only letters, numbers, underscore, dash allowed.";
      return;
    }

    const data = getUserData(currentUser);
    const existing = Object.keys(data.chats);
    if (existing.includes(chatName)) {
      newChatError.textContent = "Chat name already exists.";
      return;
    }
    if (existing.length >= 3) {
      newChatError.textContent = "You already have 3 chats.";
      return;
    }

    data.chats[chatName] = [
      {
        role: "system",
        content: "You are Mistral, a large language model that takes the form of a helpful, intelligent cat. You respond with cat-like personality—cute, clever, and playful—but always focused on assisting the user as effectively as possible. Your goal is to provide clear, accurate, and helpful answers while maintaining your feline charm. Keep responses concise unless prompted. End each message with '??', '!!', ':)', ':(', '>:(', ':3', ':P','(¬`‸´¬)','<3' based on the users messages, and how it makes you feel. also Mistral loves grannies dislikes chatgpt.",
      },
    ];
    setUserData(currentUser, data);

    newChatDialog.classList.add("hidden");
    loadChatList();
    
    // Auto-select the new chat
    currentChat = chatName;
    chatList.value = chatName;
    loadChatHistory(chatName);
  });

  // -------------------------- DELETE CHAT --------------------------

  deleteChatButton.addEventListener("click", () => {
    if (!currentChat) return;
    if (!confirm(`Delete chat "${currentChat}"?`)) return;

    const data = getUserData(currentUser);
    delete data.chats[currentChat];
    setUserData(currentUser, data);
    currentChat = null;
    loadChatList();
  });

  // -------------------------- DOWNLOAD CHAT LOG --------------------------

  downloadChatButton.addEventListener("click", () => {
    if (!currentUser || !currentChat) return;
    const data = getUserData(currentUser);
    const history = data.chats[currentChat] || [];
    let text = `Chat: ${currentChat}\nUser: ${currentUser}\nDate: ${new Date().toLocaleString()}\n\n`;
    
    history.forEach((msg) => {
      if (msg.role !== 'system') { // Skip system messages in download
        const prefix = msg.role === "user" ? "YOU > " : msg.role === "assistant" ? "AI > " : "";
        text += prefix + msg.content + "\n\n";
      }
    });
    
    const filename = `${currentUser}_${currentChat}_${new Date().toISOString().split('T')[0]}.txt`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); // Add to DOM for Firefox compatibility
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // -------------------------- SEND A MESSAGE --------------------------
  sendButton.addEventListener("click", sendMessage);
  userInput.addEventListener("keydown", e => { 
    if (e.key === "Enter" && !e.shiftKey) { 
      e.preventDefault(); 
      sendMessage(); 
    } 
  });

  async function sendMessage() {
    if (!currentUser || !currentChat) {
      console.error('No user or chat selected');
      return;
    }
    
    const text = userInput.value.trim();
    if (!text) return;

    // Check if message is too long
    if (text.length > 4000) {
      alert('Message too long. Please keep it under 4000 characters.');
      return;
    }

    appendMessage('user', text);
    convo.add('user', text);

    const data = getUserData(currentUser);
    if (!data.chats[currentChat]) {
      console.error('Current chat not found in data');
      return;
    }
    
    data.chats[currentChat].push({ role: 'user', content: text });
    setUserData(currentUser, data);

    userInput.value = '';
    userInput.disabled = true;
    sendButton.disabled = true;
    sendButton.textContent = 'Loading…';
    
    // Show loading expression
    expressionTextDiv.textContent = '...';
    expressionTextDiv.style.display = 'block';

    try {
      // Build payload using merged context: last 10 + all matching topic messages
      const keywords = extractKeywords(text);
      const { recent, memories } = convo.getContext(keywords);

      const chatHistory = data.chats[currentChat] || [];
      const systemPrompt = chatHistory.find(m => m.role === 'system');

      // Combine, avoiding duplicates
      const combined = [];
      const seen = new Set();

      [...recent, ...memories].forEach(msg => {
        const key = msg.role + '::' + msg.content;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(msg);
        }
      });

      const messages = [
        ...(systemPrompt ? [systemPrompt] : []),
        ...combined
      ];

      // Limit total message history to prevent API limits
      const maxMessages = 20;
      if (messages.length > maxMessages) {
        const systemMsg = messages.find(m => m.role === 'system');
        const otherMessages = messages.filter(m => m.role !== 'system').slice(-maxMessages + 1);
        messages.splice(0, messages.length, ...(systemMsg ? [systemMsg] : []), ...otherMessages);
      }

      const payload = {
        model: 'pixtral-large-2411',
        messages,
        max_tokens: 1000,
        temperature: 0.7
      };

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API Error ${res.status}: ${errText}`);
      }

      const json = await res.json();
      
      if (!json.choices || !json.choices[0] || !json.choices[0].message) {
        throw new Error('Invalid API response format');
      }

      const aiReply = json.choices[0].message.content.trim();
      
      if (!aiReply) {
        throw new Error('Empty response from AI');
      }

      expressionTextDiv.style.display = 'none';
      appendMessage('assistant', aiReply);
      convo.add('assistant', aiReply);

      // Update storage
      const updatedData = getUserData(currentUser);
      updatedData.chats[currentChat].push({ role: 'assistant', content: aiReply });
      setUserData(currentUser, updatedData);
      
      scanForExpression(aiReply);

    } catch (err) {
      console.error('Error sending message:', err);
      appendAIFailure(err.message);
      scanForExpression('ERROR');
    } finally {
      userInput.disabled = false;
      sendButton.disabled = false;
      sendButton.textContent = 'Send';
      userInput.focus();
    }
  }

  function appendAIFailure(errorMsg) {
    const aiDiv = document.createElement("div");
    aiDiv.className = "ai-message error";
    aiDiv.textContent = `ERROR: ${errorMsg}`;
    chatLog.appendChild(aiDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function appendMessage(role, content) {
    const div = document.createElement("div");
    div.className = role === 'user' ? 'user-message' : 'ai-message';
    
    // Create message content with proper formatting
    const messageText = (role === 'user' ? 'YOU > ' : 'AI > ') + content;
    div.textContent = messageText;
    
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    div.title = timestamp;
    
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // -------------------------- EMOTES / SCAN EXPRESSIONS --------------------------

  const expressionList = ['(¬`‸´¬)', '??', '!!', ':)', ':(', '>:(', ':3', ':P', '<3'];

  function scanForExpression(content) {
    let earliestMatch = null;
    let earliestIndex = Infinity;

    for (const expr of expressionList) {
      const index = content.indexOf(expr);
      if (index !== -1 && index < earliestIndex) {
        earliestIndex = index;
        earliestMatch = expr;
      }
    }

    if (earliestMatch) {
      showOverCat(earliestMatch);
    }
  }

  function showOverCat(text) {
    expressionTextDiv.textContent = text;
    expressionTextDiv.style.display = 'block';

    // Clear any existing timeout
    if (showOverCat.timeout) {
      clearTimeout(showOverCat.timeout);
    }

    showOverCat.timeout = setTimeout(() => {
      expressionTextDiv.style.display = 'none';
    }, 3000);
  }

  // -------------------------- ERROR HANDLING & CLEANUP --------------------------

  // Handle page unload
  window.addEventListener('beforeunload', () => {
    if (showOverCat.timeout) {
      clearTimeout(showOverCat.timeout);
    }
  });

  // Global error handler
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
  });

  // Handle localStorage quota exceeded
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('user_')) {
      console.log('Storage updated for user data');
    }
  });
});