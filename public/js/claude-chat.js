const claudeChat = (() => {
  const messagesDiv = document.getElementById('claudeChatMessages');
  const input = document.getElementById('claudeInput');
  const sendBtn = document.getElementById('claudeSend');
  const clearBtn = document.getElementById('claudeChatClear');
  const attachBtn = document.getElementById('claudeAttachBtn');
  const fileInput = document.getElementById('claudeFileInput');
  const attachmentChip = document.getElementById('claudeAttachmentChip');
  const attachmentName = document.getElementById('claudeAttachmentName');
  const attachmentRemove = document.getElementById('claudeAttachmentRemove');

  // Conversation survives page navigation via localStorage — this is a
  // classic multi-page app (full reload on every link click), so anything
  // kept only in page memory is lost the instant you navigate away.
  const STORAGE_KEY = 'legacyClaudeChatHistory';
  const MAX_STORED_MESSAGES = 60;

  let history = [];
  let pendingFile = null;
  let isLoading = false;

  const loadHistory = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      history = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(history)) history = [];
    } catch (_) {
      history = [];
    }
  };

  const saveHistory = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_STORED_MESSAGES)));
    } catch (_) {
      // storage full or unavailable — conversation just won't persist this turn
    }
  };

  const renderHistory = () => {
    messagesDiv.innerHTML = '';
    history.forEach(m => renderMessage(m.content, m.role === 'user' ? 'user' : 'claude'));
  };

  const renderMessage = (text, sender) => {
    const msg = document.createElement('div');
    msg.className = `claude-message claude-message-${sender}`;
    msg.textContent = text;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };

  const addMessage = (text, sender, role) => {
    renderMessage(text, sender);
    if (role) {
      history.push({ role, content: text });
      saveHistory();
    }
  };

  const setAttachment = (file) => {
    pendingFile = file;
    if (file) {
      attachmentName.textContent = file.name;
      attachmentChip.style.display = 'flex';
    } else {
      attachmentChip.style.display = 'none';
      fileInput.value = '';
    }
  };

  const send = async () => {
    const text = input.value.trim();
    if ((!text && !pendingFile) || isLoading) return;

    const displayText = pendingFile ? `${text ? text + '\n\n' : ''}[Attached: ${pendingFile.name}]` : text;
    addMessage(displayText, 'user', 'user');
    input.value = '';
    isLoading = true;
    sendBtn.disabled = true;

    const historyToSend = history.slice(0, -1);

    try {
      const formData = new FormData();
      formData.append('message', text);
      formData.append('history', JSON.stringify(historyToSend));
      if (pendingFile) formData.append('file', pendingFile);

      const res = await fetch('/claude-chat', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Chat failed');

      addMessage(data.response, 'claude', 'assistant');
    } catch (err) {
      addMessage('Error: ' + err.message, 'error', null);
    } finally {
      setAttachment(null);
      isLoading = false;
      sendBtn.disabled = false;
      input.focus();
    }
  };

  const clearConversation = () => {
    history = [];
    saveHistory();
    messagesDiv.innerHTML = '';
    setAttachment(null);
  };

  sendBtn.addEventListener('click', send);
  clearBtn.addEventListener('click', clearConversation);
  attachBtn.addEventListener('click', () => fileInput.click());
  attachmentRemove.addEventListener('click', () => setAttachment(null));
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) setAttachment(fileInput.files[0]);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  loadHistory();
  renderHistory();
})();
