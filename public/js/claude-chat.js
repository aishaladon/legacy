const claudeChat = (() => {
  const panel = document.getElementById('claudeChat');
  const messagesDiv = document.getElementById('claudeChatMessages');
  const input = document.getElementById('claudeInput');
  const sendBtn = document.getElementById('claudeSend');
  const openBtn = document.getElementById('claudeOpen');
  const toggleBtn = document.getElementById('claudeChatToggle');

  let isOpen = false;
  let isLoading = false;

  const toggle = () => {
    isOpen = !isOpen;
    panel.style.display = isOpen ? 'flex' : 'none';
    openBtn.style.display = isOpen ? 'none' : 'block';
  };

  const addMessage = (text, sender) => {
    const msg = document.createElement('div');
    msg.className = `claude-message claude-message-${sender}`;
    msg.textContent = text;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };

  const send = async () => {
    const text = input.value.trim();
    if (!text || isLoading) return;

    addMessage(text, 'user');
    input.value = '';
    isLoading = true;
    sendBtn.disabled = true;

    try {
      const res = await fetch('/claude-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      if (!res.ok) throw new Error('Chat failed');

      const data = await res.json();
      addMessage(data.response, 'claude');
    } catch (err) {
      addMessage('Error: ' + err.message, 'error');
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
      input.focus();
    }
  };

  openBtn.addEventListener('click', toggle);
  toggleBtn.addEventListener('click', toggle);
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  panel.style.display = 'none';
})();
