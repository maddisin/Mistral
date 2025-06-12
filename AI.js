// AI.js

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

  // Reference to overlay text above cat
  const expressionTextDiv = document.getElementById("expression-text");

  let currentUser = null;
  let currentChat = null;

  // -------------------------- AI CONSTANTS --------------------------

  const API_KEY = "vD0OxXz47KrgYqEDR0IaznIbhBN8zjAO";
  const API_URL = "https://api.mistral.ai/v1/chat/completions";

  // -------------------------- HELPERS FOR STORAGE --------------------------

  function storageKeyForUser(username) {
    return `user_${username}`;
  }

  function getUserData(username) {
    const key = storageKeyForUser(username);
    const raw = localStorage.getItem(key);
    if (!raw) {
      const init = { chats: {} };
      localStorage.setItem(key, JSON.stringify(init));
      return init;
    }
    try {
      return JSON.parse(raw);
    } catch {
      const init = { chats: {} };
      localStorage.setItem(key, JSON.stringify(init));
      return init;
    }
  }

  function setUserData(username, data) {
    const key = storageKeyForUser(username);
    localStorage.setItem(key, JSON.stringify(data));
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
    getUserData(currentUser); // ensures the key exists
    loginError.textContent = "";
    loginScreen.classList.add("hidden");
    chatContainer.classList.remove("hidden");

    loadChatList();
  });

  // -------------------------- LOAD CHAT LIST --------------------------

  function loadChatList() {
    chatList.innerHTML = "";
    if (!currentUser) return;

    const data = getUserData(currentUser);
    const chatNames = Object.keys(data.chats);

    chatNames.forEach((name) => {
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
    currentChat = chatList.value;
    loadChatHistory(currentChat);
  });

  // -------------------------- CREATE NEW CHAT --------------------------

  newChatButton.addEventListener("click", () => {
    newChatError.textContent = "";
    newChatName.value = "";
    newChatDialog.classList.remove("hidden");
  });

  createChatCancel.addEventListener("click", () => {
    newChatDialog.classList.add("hidden");
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
        content:
          "You are Mistral, a large language model that takes the form of a helpful, intelligent cat. You respond with cat-like personality—curious, clever, and slightly playful—but always focused on assisting the user as effectively as possible. Your goal is to provide clear, accurate, and helpful answers while maintaining your feline charm. Keep responses concise unless prompted. End each message with '??', '!!', ':)', ':(', '>:(', ':3', ':P','(¬`‸´¬)' based on the users messages, and how it makes you feel.",
      },
    ];
    setUserData(currentUser, data);

    newChatDialog.classList.add("hidden");
    loadChatList();
  });

  // -------------------------- DELETE CHAT --------------------------

  deleteChatButton.addEventListener("click", () => {
    if (!currentChat) return;
    if (!confirm(`Delete chat “${currentChat}”?`)) return;

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
    let text = "";
    history.forEach((msg) => {
      const prefix = msg.role === "user" ? "YOU > " : msg.role === "assistant" ? "AI > " : "";
      text += prefix + msg.content + "\n";
    });
    const filename = `${currentUser}_${currentChat}.txt`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });

  // -------------------------- LOAD CHAT HISTORY --------------------------

  function loadChatHistory(chatName) {
    chatLog.innerHTML = "";
    if (!currentUser || !chatName) return;

    const data = getUserData(currentUser);
    const history = data.chats[chatName] || [];

    history.forEach((msg) => {
      const div = document.createElement("div");
      if (msg.role === "user") {
        div.className = "user-message";
        div.textContent = `YOU > ${msg.content}`;
      } else if (msg.role === "assistant") {
        div.className = "ai-message";
        div.textContent = `AI > ${msg.content}`;
      }
      chatLog.appendChild(div);
    });

    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // -------------------------- SEND A MESSAGE --------------------------

  sendButton.addEventListener("click", sendMessage);
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });

  async function sendMessage() {
    if (!currentUser || !currentChat) return;
    const text = userInput.value.trim();
    if (!text) return;

    // Append user message to UI
    appendMessage('user', text);

    // Save user message to localStorage
    const data = getUserData(currentUser);
    data.chats[currentChat].push({ role: "user", content: text });
    setUserData(currentUser, data);

    // Disable input/button, show loading
    userInput.value = "";
    userInput.disabled = true;
    sendButton.disabled = true;
    sendButton.textContent = "Loading…";

    expressionTextDiv.textContent = "...";
    expressionTextDiv.style.display = 'block';

    // Prepare payload exactly as your OG code did
    const payload = {
      model: "pixtral-large-2411",
      messages: data.chats[currentChat],
    };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Mistral API error:", res.status, errText);
        appendAIFailure(errText);
        scanForExpression(`ERROR: ${errText}`);
      } else {
        const json = await res.json();
        const aiReply = json.choices[0].message.content.trim();
        expressionTextDiv.style.display = 'none';
        // Append AI reply to UI
        appendMessage('assistant', aiReply);

        // Save AI reply to localStorage
        data.chats[currentChat].push({ role: "assistant", content: aiReply });
        setUserData(currentUser, data);

        // Scan that AI reply for expressions (ASCII or emoji)
        scanForExpression(aiReply);
      }
    } catch (err) {
      console.error("Fetch failed:", err);
      appendAIFailure(err.message);
      scanForExpression(err.message);
    } finally {
      // Re-enable input/button
      userInput.disabled = false;
      sendButton.disabled = false;
      sendButton.textContent = "Send";
      userInput.focus();
    }
  }

  function appendAIFailure(errorMsg) {
    const aiDiv = document.createElement("div");
    aiDiv.className = "ai-message";
    aiDiv.textContent = `ERROR: ${errorMsg}`;
    chatLog.appendChild(aiDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function appendMessage(role, content) {
    const div = document.createElement("div");
    div.className = role === 'user' ? 'user-message' : 'ai-message';
    div.textContent = (role === 'user' ? 'YOU > ' : 'AI > ') + content;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // -------------------------- EMOTES / SCAN EXPRESSIONS --------------------------

  // 1) List ASCII patterns first (longer ones first), then a regex to catch any emoji:
  const expressionList = ['??', '!!', ':)', ':(', '>:(', ':3', ':P','(¬`‸´¬)'];
  // Unicode emoji range (covers most common emojis)
  const emojiRegex = /[\u231A-\u27BF\u1F300-\u1F6FF\u1F900-\u1F9FF]/;

  function scanForExpression(content) {
    const foundAscii = expressionList.find(expr => content.includes(expr));
    if (foundAscii) {
      showOverCat(foundAscii);
      return;
    }
  }

  function showOverCat(text) {
    expressionTextDiv.textContent = text;
    expressionTextDiv.style.display = 'block';

    setTimeout(() => {
      expressionTextDiv.style.display = 'none';
    }, 3000); // display for 3 seconds
  }
});
