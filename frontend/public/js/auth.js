var Auth = {
  user: null,

  init: async function() {
    try {
      var result = await API.get('/auth/me');
      this.user = result.user || result;
      this.updateUI();
    } catch (e) {
      this.user = null;
    }
    this.setupForms();
  },

  setupForms: function() {
    var self = this;

    var loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        self.handleLogin(loginForm);
      });
    }

    var signupForm = document.getElementById('signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        self.handleSignup(signupForm);
      });

      var emailInput = signupForm.querySelector('[name="email"]');
      if (emailInput) {
        emailInput.addEventListener('input', function() {
          self.validateEmailDomain(emailInput);
        });
      }

      var passwordInput = signupForm.querySelector('[name="password"]');
      if (passwordInput) {
        passwordInput.addEventListener('input', function() {
          self.updateStrength(passwordInput);
        });
      }
    }

    var verifyForm = document.getElementById('verify-form');
    if (verifyForm) {
      var notice = document.getElementById('verify-notice');
      if (notice) {
        var stored = sessionStorage.getItem('verify_notice');
        if (stored) {
          notice.textContent = stored;
          notice.classList.remove('hidden');
          sessionStorage.removeItem('verify_notice');
        }
      }
      verifyForm.addEventListener('submit', function(e) {
        e.preventDefault();
        self.handleVerify(verifyForm);
      });
    }

    document.querySelectorAll('.toggle-password').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var input = btn.closest('.relative').querySelector('input');
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });

    var resendBtn = document.getElementById('resend-btn');
    if (resendBtn) {
      resendBtn.addEventListener('click', function() {
        self.handleResend(resendBtn);
      });
    }
  },

  validateEmailDomain: function(input) {
    return true;
  },

  updateStrength: function(input) {
    var pw = input.value;
    var fill = document.getElementById('strength-fill');
    if (!fill) return;

    var score = 0;
    if (pw.length >= 8) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z\d]/.test(pw)) score++;

    var widths = ['0%','25%','50%','75%','100%'];
    var colors = ['transparent','#ed1c24','#d2ab67','#d2ab67','#00a651'];
    fill.style.width = widths[score];
    fill.style.background = colors[score];
  },

  showAlert: function(msg, type) {
    var alert = document.getElementById('alert');
    if (!alert) return;
    alert.textContent = msg;
    if (type === 'error') {
      alert.className = 'block p-3 rounded-lg text-sm mb-5 bg-red-50 dark:bg-red-900/20 text-mak-red';
    } else {
      alert.className = 'block p-3 rounded-lg text-sm mb-5 bg-mak-green/10 dark:bg-mak-green/15 text-mak-green';
    }
  },

  handleLogin: async function(form) {
    var btn = form.querySelector('button[type="submit"]');
    var originalText = btn.textContent;

    try {
      btn.disabled = true;
      btn.textContent = 'Signing in...';

      var result = await API.post('/auth/login', {
        email: form.querySelector('[name="email"]').value,
        password: form.querySelector('[name="password"]').value
      });

      this.user = result.user || result;

      var params = new URLSearchParams(window.location.search);
      var next = params.get('next');
      var safeNext = next && next.charAt(0) === '/' && next.charAt(1) !== '/' ? next : null;

      if (this.user.role === 'admin') {
        window.location.href = safeNext || '/admin.html';
      } else if (safeNext && safeNext.indexOf('/admin') >= 0) {
        window.location.href = '/chat.html';
      } else {
        window.location.href = safeNext || '/chat.html';
      }
    } catch (e) {
      this.showAlert(e.message || 'Invalid email or password', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  },

  handleSignup: async function(form) {
    var btn = form.querySelector('button[type="submit"]');
    var originalText = btn.textContent;

    var email = form.querySelector('[name="email"]').value;
    var password = form.querySelector('[name="password"]').value;
    var confirm = form.querySelector('[name="confirm_password"]').value;

    if (password.length < 8) {
      this.showAlert('Password must be at least 8 characters', 'error');
      return;
    }

    if (password !== confirm) {
      this.showAlert('Passwords do not match', 'error');
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = 'Creating account...';

      var result = await API.post('/auth/signup', {
        full_name: form.querySelector('[name="full_name"]').value,
        email: email,
        password: password
      });

      localStorage.setItem('verify_email', email);
      if (result.message) {
        sessionStorage.setItem('verify_notice', result.message);
      }
      window.location.href = '/verify.html';
    } catch (e) {
      this.showAlert(e.message || 'Signup failed. Please try again.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  },

  handleVerify: async function(form) {
    var btn = form.querySelector('button[type="submit"]');
    var originalText = btn.textContent;
    var email = localStorage.getItem('verify_email');

    if (!email) {
      window.location.href = '/signup.html';
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = 'Verifying...';

      await API.post('/auth/verify', {
        email: email,
        code: form.querySelector('[name="code"]').value
      });

      localStorage.removeItem('verify_email');
      window.location.href = '/chat.html';
    } catch (e) {
      this.showAlert(e.message || 'Invalid verification code', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  },

  handleResend: async function(btn) {
    var email = localStorage.getItem('verify_email');
    if (!email) return;

    try {
      btn.disabled = true;
      var res = await API.post('/auth/resend-verification', { email: email });
      Utils.showToast(res.message || 'Verification code sent', 'success');

      var seconds = 60;
      var interval = setInterval(function() {
        seconds--;
        btn.textContent = 'Resend (' + seconds + 's)';
        if (seconds <= 0) {
          clearInterval(interval);
          btn.textContent = 'Resend Code';
          btn.disabled = false;
        }
      }, 1000);
    } catch (e) {
      btn.disabled = false;
      Utils.showToast(e.message || 'Failed to resend', 'error');
    }
  },

  logout: async function() {
    try { await API.post('/auth/logout'); } catch (e) {}
    this.user = null;
    window.location.href = '/';
  },

  updateUI: function() {
    var nameEl = document.getElementById('user-menu-name');
    var avatarEl = document.getElementById('user-avatar');
    if (this.user && nameEl) nameEl.textContent = this.user.full_name;
    if (this.user && avatarEl) avatarEl.textContent = Utils.getInitials(this.user.full_name);
  },

  isAuthenticated: function() {
    return this.user !== null;
  }
};
