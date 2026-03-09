// Состояние приложения
let ws = null;
let username = '';
let isConnected = false;

// DOM элементы
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username');
const joinBtn = document.getElementById('join-btn');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const usersList = document.getElementById('users-list');
const usersCount = document.getElementById('users-count');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPanel = document.getElementById('emoji-panel');
const imageInput = document.getElementById('image-input');
const typingIndicator = document.getElementById('typing-indicator');

// Подключение к WebSocket серверу
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('Подключено к серверу');
    isConnected = true;
    
    // Отправляем имя пользователя
    ws.send(JSON.stringify({
      type: 'join',
      username: username
    }));
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleMessage(message);
    } catch (error) {
      console.error('Ошибка парсинга сообщения:', error);
    }
  };

  ws.onclose = () => {
    console.log('Отключено от сервера');
    isConnected = false;
    addSystemMessage('Соединение с сервером потеряно. Переподключение...');
    
    // Переподключение через 3 секунды
    setTimeout(() => {
      if (!isConnected) {
        connect();
      }
    }, 3000);
  };

  ws.onerror = (error) => {
    console.error('Ошибка WebSocket:', error);
  };
}

// Обработка входящих сообщений
function handleMessage(message) {
  switch (message.type) {
    case 'message':
      addMessage(message.username, message.content, message.username === username);
      hideTypingIndicator();
      break;
    case 'image':
      addImage(message.username, message.imageUrl, message.username === username);
      hideTypingIndicator();
      break;
    case 'typing':
      showTypingIndicator(message.username);
      break;
    case 'join':
      addSystemMessage(message.content);
      break;
    case 'leave':
      addSystemMessage(message.content);
      break;
    case 'users':
      updateUsersList(message.users);
      break;
  }
}

// Добавление сообщения в чат
function addMessage(user, content, isOwn) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
  
  const time = new Date().toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  messageDiv.innerHTML = `
    <div class="username">${escapeHtml(user)}</div>
    <div>${escapeHtml(content)}</div>
    <span class="time">${time}</span>
  `;
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Добавление изображения в чат
function addImage(user, imageUrl, isOwn) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
  
  const time = new Date().toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  messageDiv.innerHTML = `
    <div class="username">${escapeHtml(user)}</div>
    <img src="${imageUrl}" alt="Изображение" class="message-image" loading="lazy">
    <span class="time">${time}</span>
  `;
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Добавление системного сообщения
function addSystemMessage(content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message system';
  messageDiv.textContent = content;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Обновление списка пользователей
function updateUsersList(users) {
  usersList.innerHTML = '';
  usersCount.textContent = users.length;
  
  users.forEach(user => {
    const li = document.createElement('li');
    li.textContent = user;
    usersList.appendChild(li);
  });
}

// Показать индикатор печати
function showTypingIndicator(typingUser) {
  if (typingUser === username) return;
  typingIndicator.textContent = `${typingUser} печатает...`;
  typingIndicator.style.display = 'block';
  
  // Скрыть через 3 секунды
  clearTimeout(window.typingTimeout);
  window.typingTimeout = setTimeout(() => {
    hideTypingIndicator();
  }, 3000);
}

// Скрыть индикатор печати
function hideTypingIndicator() {
  typingIndicator.style.display = 'none';
  clearTimeout(window.typingTimeout);
}

// Экранирование HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Обработчик кнопки входа
joinBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  if (name.length < 2) {
    alert('Имя должно содержать минимум 2 символа');
    return;
  }
  
  username = name;
  loginScreen.style.display = 'none';
  chatScreen.style.display = 'flex';
  connect();
});

// Обработчик ввода имени (Enter)
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinBtn.click();
  }
});

// Обработчик отправки формы
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const content = messageInput.value.trim();
  if (!content || !isConnected) return;
  
  ws.send(JSON.stringify({
    type: 'message',
    content: content
  }));
  
  messageInput.value = '';
  messageInput.focus();
});

// Обработчик ввода текста - отправка события typing
let typingTimeout = null;
messageInput.addEventListener('input', () => {
  if (!isConnected) return;
  
  ws.send(JSON.stringify({
    type: 'typing'
  }));
});

// Обработчик кнопки смайликов
if (emojiBtn) {
  emojiBtn.addEventListener('click', (e) => {
    e.preventDefault();
    emojiPanel.classList.toggle('show');
    emojiBtn.classList.toggle('active');
  });

  // Обработчик выбора смайлика
  emojiPanel.querySelectorAll('.emoji').forEach(emoji => {
    emoji.addEventListener('click', () => {
      const emojiChar = emoji.dataset.emoji;
      messageInput.value += emojiChar;
      messageInput.focus();
      emojiPanel.classList.remove('show');
      emojiBtn.classList.remove('active');
    });
  });

  // Закрыть панель при клике вне её
  document.addEventListener('click', (e) => {
    if (!emojiPanel.contains(e.target) && e.target !== emojiBtn) {
      emojiPanel.classList.remove('show');
      emojiBtn.classList.remove('active');
    }
  });
}

// Фокус на поле ввода при загрузке
usernameInput.focus();

// Обработчик загрузки изображений
imageInput.addEventListener('change', async () => {
  const file = imageInput.files?.[0];
  if (!file || !isConnected) return;
  
  // Проверяем, что файл является изображением
  if (!file.type.startsWith('image/')) {
    alert('Пожалуйста, выберите изображение');
    return;
  }
  
  // Создаем FormData и отправляем на сервер
  const formData = new FormData();
  formData.append('image', file);
  
  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.url) {
      // Отправляем URL изображения через WebSocket
      ws.send(JSON.stringify({
        type: 'image',
        imageUrl: data.url
      }));
    } else {
      alert('Ошибка при загрузке изображения');
    }
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    alert('Не удалось загрузить изображение');
  }
  
  // Очищаем input
  imageInput.value = '';
});
