var Upload = {
  file: null,
  maxSize: 10 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],

  init: function() {
    var self = this;
    var attachBtn = document.querySelector('.attach-btn');
    var fileInput = document.getElementById('file-input');
    var chatArea = document.getElementById('chat-messages');
    var removeBtn = document.querySelector('.preview-remove');

    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', function() { fileInput.click(); });
      fileInput.addEventListener('change', function(e) {
        if (e.target.files[0]) self.handleFile(e.target.files[0]);
      });
    }

    if (chatArea) {
      chatArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var dark = document.documentElement.classList.contains('dark');
        chatArea.classList.add('ring-2', dark ? 'ring-mak-green/35' : 'ring-mak-green/30');
      });
      chatArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        chatArea.classList.remove('ring-2', 'ring-mak-green/30', 'ring-mak-green/35');
      });
      chatArea.addEventListener('drop', function(e) {
        e.preventDefault();
        chatArea.classList.remove('ring-2', 'ring-mak-green/30', 'ring-mak-green/35');
        var file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) self.handleFile(file);
      });
    }

    document.addEventListener('paste', function(e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          self.handleFile(items[i].getAsFile());
          break;
        }
      }
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', function() { self.clear(); });
    }
  },

  handleFile: function(file) {
    if (this.allowedTypes.indexOf(file.type) === -1) {
      Utils.showToast('Only JPG, PNG, GIF, and WebP images are allowed', 'error');
      return;
    }
    if (file.size > this.maxSize) {
      Utils.showToast('Image must be under 10MB', 'error');
      return;
    }
    this.file = file;
    this.showPreview(file);

    var sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.disabled = false;
  },

  showPreview: function(file) {
    var preview = document.getElementById('image-preview');
    if (!preview) return;

    var img = preview.querySelector('img');
    var nameEl = preview.querySelector('.preview-name');
    var sizeEl = preview.querySelector('.preview-size');

    var reader = new FileReader();
    reader.onload = function(e) {
      img.src = e.target.result;
      nameEl.textContent = file.name;
      sizeEl.textContent = Upload.formatSize(file.size);
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  },

  clear: function() {
    this.file = null;
    var preview = document.getElementById('image-preview');
    if (preview) preview.classList.add('hidden');
    var fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';

    var input = document.getElementById('message-input');
    var sendBtn = document.getElementById('send-btn');
    if (sendBtn && input && !input.value.trim()) sendBtn.disabled = true;
  },

  upload: async function(chatId) {
    if (!this.file) return null;

    var formData = new FormData();
    formData.append('image', this.file);
    formData.append('chat_id', chatId);

    var progress = document.getElementById('upload-progress');
    var progressBar = document.querySelector('.progress-bar');
    if (progress) {
      progress.classList.remove('hidden');
      if (progressBar) progressBar.style.width = '30%';
    }

    try {
      if (progressBar) progressBar.style.width = '60%';
      var result = await API.upload('/upload/image', formData);
      if (progressBar) progressBar.style.width = '100%';
      this.clear();
      return result.image_key;
    } catch (e) {
      Utils.showToast('Failed to upload image', 'error');
      return null;
    } finally {
      setTimeout(function() {
        if (progress) progress.classList.add('hidden');
        if (progressBar) progressBar.style.width = '0%';
      }, 500);
    }
  },

  formatSize: function(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
};
