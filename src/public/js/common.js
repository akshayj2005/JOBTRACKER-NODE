// Config and State
const defaultConfig = {
  hero_title: 'Track Your Dream Job Journey',
  hero_subtitle: 'Organize your job applications, track progress, and land your next opportunity with our powerful job tracking system.',
  contact_title: 'Get In Touch',
  background_color: '#0f172a',
  surface_color: '#1e293b',
  text_color: '#ffffff',
  primary_action_color: '#6366f1',
  secondary_action_color: '#a855f7',
  font_family: 'Space Grotesk',
  font_size: 16
};

// Global state for Company Toggle
let currentApplicationType = 'Off Campus';
let companyList = [];

let config = { ...defaultConfig };
// Session managed server-side - no localStorage needed
let currentUser = null; // Will be set from server data
let currentUserName = null; // PERSISTENCE for full name
let isAdmin = false; // Admin status
let jobToDelete = null;
let recordCount = 0;
let currentRounds = [];
// Profile data state
let profileSkills = [];
let profileExperience = [];
let profileEducation = [];
let profileCertifications = [];
let profileProjects = [];
let profileData = {};

// Idle Tracker Constants
const IDLE_TIMEOUT = 3600000; // 1 hour in ms
const IDLE_STORAGE_KEY = 'lastActivity';

// Element SDK
if (window.elementSdk) {
  window.elementSdk.init({
    defaultConfig,
    onConfigChange: async (newConfig) => {
      config = { ...defaultConfig, ...newConfig };
      applyConfig();
    },
    mapToCapabilities: (cfg) => ({
      recolorables: [
        { get: () => cfg.background_color || defaultConfig.background_color, set: (v) => { cfg.background_color = v; window.elementSdk.setConfig({ background_color: v }); } },
        { get: () => cfg.surface_color || defaultConfig.surface_color, set: (v) => { cfg.surface_color = v; window.elementSdk.setConfig({ surface_color: v }); } },
        { get: () => cfg.text_color || defaultConfig.text_color, set: (v) => { cfg.text_color = v; window.elementSdk.setConfig({ text_color: v }); } },
        { get: () => cfg.primary_action_color || defaultConfig.primary_action_color, set: (v) => { cfg.primary_action_color = v; window.elementSdk.setConfig({ primary_action_color: v }); } },
        { get: () => cfg.secondary_action_color || defaultConfig.secondary_action_color, set: (v) => { cfg.secondary_action_color = v; window.elementSdk.setConfig({ secondary_action_color: v }); } }
      ],
      borderables: [],
      fontEditable: { get: () => cfg.font_family || defaultConfig.font_family, set: (v) => { cfg.font_family = v; window.elementSdk.setConfig({ font_family: v }); } },
      fontSizeable: { get: () => cfg.font_size || defaultConfig.font_size, set: (v) => { cfg.font_size = v; window.elementSdk.setConfig({ font_size: v }); } }
    }),
    mapToEditPanelValues: (cfg) => new Map([
      ['hero_title', cfg.hero_title || defaultConfig.hero_title],
      ['hero_subtitle', cfg.hero_subtitle || defaultConfig.hero_subtitle],
      ['contact_title', cfg.contact_title || defaultConfig.contact_title]
    ])
  });
}

function applyConfig() {
  const heroTitle = document.getElementById('heroTitle');
  const heroSubtitle = document.getElementById('heroSubtitle');
  const contactTitle = document.getElementById('contactTitle');

  if (heroTitle) {
    heroTitle.innerHTML = (config.hero_title || defaultConfig.hero_title).replace('Dream Job', '<span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Dream Job</span>');
  }
  if (heroSubtitle) heroSubtitle.textContent = config.hero_subtitle || defaultConfig.hero_subtitle;
  if (contactTitle) contactTitle.textContent = config.contact_title || defaultConfig.contact_title;

  const font = config.font_family || defaultConfig.font_family;
  const baseSize = config.font_size || defaultConfig.font_size;
  document.body.style.fontFamily = `${font}, sans-serif`;
  document.querySelectorAll('h1').forEach(el => el.style.fontSize = `${baseSize * 3}px`);
  document.querySelectorAll('h2').forEach(el => el.style.fontSize = `${baseSize * 1.875}px`);
  document.querySelectorAll('h3').forEach(el => el.style.fontSize = `${baseSize * 1.25}px`);
  document.querySelectorAll('p, span, button, input, select, textarea, label').forEach(el => {
    if (!el.closest('h1') && !el.closest('h2') && !el.closest('h3')) {
      el.style.fontSize = `${baseSize}px`;
    }
  });
}

// Data SDK
const dataHandler = {
  onDataChanged(data) {
    // The backend already filters data by user ID, so we can use it directly.
    // However, we ensure that we only keep what matches the current user just in case.
    jobs = data.filter(j => (j.userId === currentUser || j.user_id === currentUser));

    // Normalize data to use user_id consistently on frontend if needed, 
    // though using 'userId' from backend is preferred.
    recordCount = jobs.length;

    // If we are on dashboard, re-render
    if (document.getElementById('jobList')) {
      renderJobs();
      updateStats();
    }

    // If we are on profile, reload profile
    if (document.getElementById('profilePage')) {
      loadProfile();
    }
  }
};

async function fetchJobs() {
  if (!currentUser) {
    console.log('No current user logged in. Clearing data.');
    jobs = [];
    // Reset UI if needed
    if (document.getElementById('jobList')) renderJobs();
    if (document.getElementById('statTotal')) updateStats();
    return;
  }

  try {
    const response = await fetch('/api/jobs', {
      credentials: 'include',
      headers: {
        'X-User-Id': currentUser
      }
    });

    if (!response.ok) throw new Error('Failed to fetch jobs');

    const data = await response.json();
    console.log('Job Data Received:', data.length, 'items');

    // Update global jobs array
    jobs = data;
    recordCount = jobs.length;

    // Trigger UI updates
    if (document.getElementById('jobList')) {
      renderJobs();
      updateStats();
    }

    // Also trigger data handler if it does extra logic
    dataHandler.onDataChanged(data);

  } catch (err) {
    console.error('Error fetching jobs:', err);
    showToast('Failed to load data', 'error');
  }
}

async function initData() {
  await fetchJobs();
}

// Navigation (UPDATED FOR MPA)
function navigateTo(page) {
  console.log('navigateTo called with page:', page);
  console.log('currentUser:', currentUser);

  if (page === 'home') {
    console.log('Navigating to home');
    window.location.href = '/';
  } else if (page === 'contact') {
    console.log('Navigating to contact');
    window.location.href = '/contact';
  } else if (page === 'profile') {
    if (currentUser) {
      console.log('Navigating to profile for user:', currentUser);
      window.location.href = '/profile';
    } else {
      console.log('No user logged in, redirecting to home');
      showToast('Please login first', 'error');
      window.location.href = '/';
    }
  } else if (page === 'dashboard') {
    if (currentUser) {
      console.log('Navigating to dashboard for user:', currentUser);
      window.location.href = '/dashboard';
    } else {
      console.log('No user logged in, showing error');
      showToast('Please login first', 'error');
    }
  }
}

// Auth Helpers
function checkAuth() {
  console.log('checkAuth called, currentUser:', currentUser);


  if (currentUser) {
    console.log('User is logged in, showing authenticated UI');
    const userDisplay = document.getElementById('userDisplay');
    const dashboardBtn = document.getElementById('dashboardNavBtn');
    const adminBtn = document.getElementById('adminNavBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginHeaderBtn = document.getElementById('loginHeaderBtn');
    const registerHeaderBtn = document.getElementById('registerHeaderBtn');

    if (userDisplay) {
      userDisplay.textContent = `👤 ${currentUserName || currentUser}`;
      userDisplay.classList.remove('hidden');
    }
    if (dashboardBtn) {
      if (isAdmin) {
        dashboardBtn.classList.add('hidden');
      } else {
        dashboardBtn.classList.remove('hidden');
      }
    }
    if (adminBtn) {
      if (isAdmin) {
        adminBtn.classList.remove('hidden');
      } else {
        adminBtn.classList.add('hidden');
      }
    }
    if (logoutBtn) logoutBtn.classList.remove('hidden');

    if (loginHeaderBtn) loginHeaderBtn.classList.add('hidden');
    if (registerHeaderBtn) registerHeaderBtn.classList.add('hidden');
  } else {
    console.log('No user logged in');
    // If on protected page, redirect home
    const path = window.location.pathname;
    console.log('Current path:', path);
    if (path.includes('/dashboard') || path.includes('/profile')) {
      console.log('On protected page without auth, redirecting to home');
      window.location.href = '/';
    }
  }
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

function scrollToAuthForm(formType) {
  if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
    window.location.href = '/?auth=' + formType;
    return;
  }
  switchAuthTab(formType);
  const authCard = document.getElementById('authCard');
  if (authCard) {
    authCard.scrollIntoView({ behavior: 'smooth' });
  }
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');

  // Also handle modal tabs if they exist
  const authLoginTab = document.getElementById('authLoginTab');
  const authRegisterTab = document.getElementById('authRegisterTab');
  const authLoginForm = document.getElementById('authLoginForm');
  const authRegisterForm = document.getElementById('authRegisterForm');

  if (tab === 'login') {
    if (loginForm) loginForm.classList.remove('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (loginTab) {
      loginTab.classList.add('border-indigo-500', 'text-indigo-400');
      loginTab.classList.remove('border-transparent', 'text-slate-400');
    }
    if (registerTab) {
      registerTab.classList.remove('border-indigo-500', 'text-indigo-400');
      registerTab.classList.add('border-transparent', 'text-slate-400');
    }

    if (authLoginForm) authLoginForm.classList.remove('hidden');
    if (authRegisterForm) authRegisterForm.classList.add('hidden');
    if (authLoginTab) {
      authLoginTab.classList.add('border-indigo-500', 'text-indigo-400');
      authLoginTab.style.borderColor = '#6366f1'; // fallback
    }
    if (authRegisterTab) {
      authRegisterTab.style.borderColor = 'transparent';
    }

  } else {
    if (registerForm) registerForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
    if (registerTab) {
      registerTab.classList.add('border-indigo-500', 'text-indigo-400');
      registerTab.classList.remove('border-transparent', 'text-slate-400');
    }
    if (loginTab) {
      loginTab.classList.remove('border-indigo-500', 'text-indigo-400');
      loginTab.classList.add('border-transparent', 'text-slate-400');
    }

    if (authRegisterForm) authRegisterForm.classList.remove('hidden');
    if (authLoginForm) authLoginForm.classList.add('hidden');
    if (authRegisterTab) {
      authRegisterTab.classList.add('border-indigo-500', 'text-indigo-400');
      authRegisterTab.style.borderColor = '#6366f1';
    }
    if (authLoginTab) {
      authLoginTab.style.borderColor = 'transparent';
    }
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const isModal = e.target.id === 'authLoginForm';
  const userIdInput = isModal ? document.getElementById('authLoginUserId') : document.getElementById('loginUserId');
  const passwordInput = isModal ? document.getElementById('authLoginPassword') : document.getElementById('loginPassword');
  const errorEl = isModal ? document.getElementById('authLoginError') : document.getElementById('loginError');

  const userId = userIdInput.value.trim();
  const password = passwordInput.value;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, password })
    });

    const data = await response.json();

    if (response.ok) {
      if (data.isAdmin) {
        localStorage.setItem('currentUser', userId);
        localStorage.setItem('isAdmin', 'true');
        if (data.user?.fullName) localStorage.setItem('currentUserName', data.user.fullName);
        window.location.href = '/admin';
        return;
      }
      currentUser = userId;
      currentUserName = data.user ? data.user.fullName : null;
      isAdmin = data.isAdmin || false;

      // Persist in localStorage as fallback
      localStorage.setItem('currentUser', userId);
      localStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');
      if (currentUserName) localStorage.setItem('currentUserName', currentUserName);

      // Session managed server-side
      resetIdleTimer();
      checkAuth();
      await fetchJobs();

      e.target.reset();
      showToast('Welcome back!', 'success');
      if (isModal) closeAuthModal();
      navigateTo('dashboard');
      if (errorEl) errorEl.classList.add('hidden');
    } else {
      if (errorEl) {
        errorEl.textContent = data.error || 'Invalid user ID or password';
        errorEl.classList.remove('hidden');

        if (data.requiresVerification) {
          // Show OTP Modal
          document.getElementById('otpModal').classList.remove('hidden');
          document.getElementById('otpUserId').value = data.userId || userId;
          if (isModal) closeAuthModal();
        }
      }
    }
  } catch (err) {
    console.error('Login error:', err);
    showToast(`Connection error: ${err.message}`, 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const isModal = e.target.id === 'authRegisterForm';
  const fullNameInput = isModal ? document.getElementById('authRegFullName') : document.getElementById('regFullName');
  const userIdInput = isModal ? document.getElementById('authRegUserId') : document.getElementById('regUserId');
  const emailInput = isModal ? document.getElementById('authRegEmail') : document.getElementById('regEmail');
  const passwordInput = isModal ? document.getElementById('authRegPassword') : document.getElementById('regPassword');
  const confirmPasswordInput = isModal ? null : document.getElementById('regConfirmPassword');

  const fullName = fullNameInput ? fullNameInput.value.trim() : '';
  const userId = userIdInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : password;
  const msgEl = isModal ? document.getElementById('authRegMsg') : document.getElementById('registerMsg');

  if (password !== confirmPassword) {
    msgEl.textContent = 'Passwords do not match.';
    msgEl.classList.remove('hidden', 'text-green-400');
    msgEl.classList.add('text-red-400');
    return;
  }

  if (password.length < 6) {
    msgEl.textContent = 'Password must be at least 6 characters long.';
    msgEl.classList.remove('hidden', 'text-green-400');
    msgEl.classList.add('text-red-400');
    return;
  }

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, email, password, fullName })
    });

    const data = await response.json();

    if (response.ok) {
      if (data.requiresVerification) {
        // Show OTP Modal
        document.getElementById('otpModal').classList.remove('hidden');
        document.getElementById('otpUserId').value = userId;
        if (isModal) closeAuthModal();
      } else {
        msgEl.textContent = 'Account created! Please login.';
        msgEl.classList.remove('hidden', 'text-red-400');
        msgEl.classList.add('text-green-400');

        setTimeout(() => {
          switchAuthTab('login');
          const loginId = isModal ? 'authLoginUserId' : 'loginUserId';
          document.getElementById(loginId).value = userId;
          e.target.reset();
          msgEl.classList.add('hidden');
        }, 1500);
      }
    } else {
      msgEl.textContent = data.error || 'Registration failed';
      msgEl.classList.remove('hidden', 'text-green-400');
      msgEl.classList.add('text-red-400');
    }
  } catch (err) {
    console.error('Registration error:', err);
    showToast('Connection error', 'error');
  }
}

async function handleVerifyOTP(e) {
  e.preventDefault();
  const userId = document.getElementById('otpUserId').value;
  const otp = document.getElementById('otpInput').value.trim();
  const msgEl = document.getElementById('otpMsg');

  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, otp })
    });
    const data = await response.json();

    if (response.ok) {
      msgEl.textContent = 'Verified! Logging you in...';
      msgEl.classList.remove('hidden', 'text-red-400');
      msgEl.classList.add('text-green-400');
      setTimeout(() => {
        document.getElementById('otpModal').classList.add('hidden');
        // Auto-login flow could be triggered here or just redirect to login
        switchAuthTab('login');
        const modal = document.getElementById('authModal');
        if (!modal.classList.contains('hidden')) {
          document.getElementById('authLoginUserId').value = userId;
        } else {
          document.getElementById('loginUserId').value = userId;
          const authCard = document.getElementById('authCard');
          if (authCard) authCard.scrollIntoView();
        }
        showToast('Email verified. Please login.', 'success');
      }, 1500);
    } else {
      msgEl.textContent = data.error || 'Verification failed';
      msgEl.classList.remove('hidden', 'text-green-400');
      msgEl.classList.add('text-red-400');
    }
  } catch (err) {
    console.error(err);
    showToast('Connection error', 'error');
  }
}

async function resendOTP() {
  const userId = document.getElementById('otpUserId').value;
  if (!userId) return showToast('Error: User ID missing', 'error');

  try {
    const response = await fetch('/api/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId })
    });
    if (response.ok) {
      showToast('New code sent to your email', 'success');
    } else {
      showToast('Failed to resend code', 'error');
    }
  } catch (err) {
    showToast('Connection error', 'error');
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { credentials: 'include' });
    currentUser = null;
    currentUserName = null;
    isAdmin = false;
    // Clear localStorage fallback
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentUserName');
    localStorage.removeItem('isAdmin');

    checkAuth();
    fetchJobs(); // Clear data
    navigateTo('home');
    showToast('Logged out successfully', 'info');
  } catch (err) {
    console.error('Logout error:', err);
    navigateTo('home');
  }
}

function togglePasswordVisibility(fieldId) {
  const field = document.getElementById(fieldId);
  const icon = document.getElementById(fieldId + 'Icon');
  if (!field) return;

  if (field.type === 'password') {
    field.type = 'text';
    if (icon) icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
  } else {
    field.type = 'password';
    if (icon) icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>';
  }
}

// Auth Modal Helpers
function openAuthModal(tab) {
  document.getElementById('authModal').classList.remove('hidden');
  switchAuthTab(tab);
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
}

function closeOtpModal() {
  document.getElementById('otpModal').classList.add('hidden');
  document.getElementById('otpForm').reset();
  document.getElementById('otpMsg').classList.add('hidden');
}

function openForgotPasswordModal() {
  document.getElementById('forgotPasswordModal').classList.remove('hidden');
}

function closeForgotPasswordModal() {
  document.getElementById('forgotPasswordModal').classList.add('hidden');
  document.getElementById('forgotPasswordForm').reset();
  document.getElementById('forgotMsg').classList.add('hidden');
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const emailInput = document.getElementById('forgotEmail');
  const email = emailInput.value.trim();
  const msgEl = document.getElementById('forgotMsg');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!email) return;

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    msgEl.textContent = 'Contacting security server...';
    msgEl.classList.remove('hidden', 'text-red-400');
    msgEl.classList.add('text-indigo-400');

    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email })
    });

    let data = {};
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('Server returned non-JSON response:', text);
      data = { error: 'Server error (500). Please check server logs.' };
    }

    if (response.ok) {
      const inboxUrl = getInboxUrl(email);
      let successHtml = `✓ Rescovery email sent to <strong>${email}</strong>.`;

      if (inboxUrl) {
        successHtml += `
          <div class="mt-4">
            <a href="${inboxUrl}" target="_blank" class="inline-block bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium">
              Open Inbox
            </a>
          </div>
        `;
      } else {
        successHtml += `<p class="mt-2 text-xs opacity-80">Please check your inbox manually.</p>`;
      }

      msgEl.innerHTML = successHtml;
      msgEl.className = 'mt-4 p-4 rounded-xl bg-green-500/10 text-green-400 text-center border border-green-500/20 block';
      submitBtn.classList.add('hidden'); // Hide submit after success
      emailInput.disabled = true;

      showToast('Recovery email sent!', 'success');
    } else {
      let errorMessage = '✕ ' + (data.error || 'Failed to send email.');
      if (data.details) errorMessage += ` (${data.details})`;
      if (data.code) errorMessage += ` [Code: ${data.code}]`;

      msgEl.textContent = errorMessage;
      msgEl.className = 'mt-4 p-4 rounded-xl bg-red-500/10 text-red-400 text-center border border-red-500/20 block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reset Password';
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    msgEl.textContent = '✕ Connection error. The server might be unreachable or timed out.';
    msgEl.className = 'mt-4 p-4 rounded-xl bg-red-500/10 text-red-400 text-center border border-red-500/20 block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Reset Password';
  }
}

function getInboxUrl(email) {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1].toLowerCase();
  const deepLinks = {
    'gmail.com': 'https://mail.google.com',
    'googlemail.com': 'https://mail.google.com',
    'outlook.com': 'https://outlook.live.com',
    'hotmail.com': 'https://outlook.live.com',
    'live.com': 'https://outlook.live.com',
    'yahoo.com': 'https://mail.yahoo.com',
    'icloud.com': 'https://www.icloud.com/mail'
  };
  return deepLinks[domain] || null;
}

// Change Password
function openChangePasswordModal() {
  document.getElementById('changePasswordModal').classList.remove('hidden');
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').classList.add('hidden');
  const form = document.getElementById('changePasswordForm');
  if (form) form.reset();
  const msg = document.getElementById('changePassMsg');
  if (msg) msg.classList.add('hidden');
}

function handleChangePassword(e) {
  e.preventDefault();
  const oldPass = document.getElementById('oldPassword').value;
  const newPass = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmNewPassword').value;
  const msgEl = document.getElementById('changePassMsg');

  // Verify old password
  let currentStored = registeredUsers[currentUser];
  // Normalize legacy data if string
  if (typeof currentStored === 'string') currentStored = { password: currentStored, email: '' };

  // If user is from validUsers (demo data), we might not allow change or just simulate it.
  // Assuming mostly registered users.
  const isDemoUser = validUsers[currentUser] === oldPass;
  const isRegUser = currentStored && currentStored.password === oldPass;

  if (!isDemoUser && !isRegUser) {
    msgEl.textContent = 'Incorrect old password.';
    msgEl.classList.remove('hidden', 'text-green-400');
    msgEl.classList.add('text-red-400');
    return;
  }

  if (newPass !== confirmPass) {
    msgEl.textContent = 'New passwords do not match.';
    msgEl.classList.remove('hidden', 'text-green-400');
    msgEl.classList.add('text-red-400');
    return;
  }

  if (newPass.length < 6) {
    msgEl.textContent = 'Password must be at least 6 characters.';
    msgEl.classList.remove('hidden', 'text-green-400');
    msgEl.classList.add('text-red-400');
    return;
  }

  // Update password
  if (registeredUsers[currentUser]) {
    if (typeof registeredUsers[currentUser] === 'string') {
      registeredUsers[currentUser] = { password: newPass, email: '' };
    } else {
      registeredUsers[currentUser].password = newPass;
    }
    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
  } else {
    // If it was a demo user, we can't really save it permanently unless we move them to registeredUsers
    // For this app context (demo), let's just create an entry in registeredUsers
    registeredUsers[currentUser] = { password: newPass, email: '' };
    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
  }

  msgEl.textContent = 'Password updated successfully!';
  msgEl.classList.remove('text-red-400');
  msgEl.classList.add('text-green-400');
  msgEl.classList.remove('hidden');

  setTimeout(() => {
    closeChangePasswordModal();
    showToast('Password changed!', 'success');
  }, 1500);
}

async function uploadProfileImage(input) {
  if (!input.files || !input.files[0]) return;
  resetIdleTimer();

  const file = input.files[0];
  const formData = new FormData();
  formData.append('profileImage', file);

  try {
    showToast('Uploading image...', 'info');
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'X-User-Id': currentUser
      }
    });

    if (response.ok) {
      const data = await response.json();
      document.getElementById('profileImageUrl').value = data.imageUrl;
      updateProfileImagePreview(data.imageUrl);
      showToast('Image uploaded!', 'success');
      // Proactively save profile to persist image path immediately
      saveProfile();
    } else {
      showToast('Upload failed', 'error');
    }
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Error uploading image', 'error');
  }
}

function updateProfileImagePreview(url) {
  const display = document.getElementById('profileImageDisplay');
  const placeholder = document.getElementById('profileImagePlaceholder');
  if (!display || !placeholder) return;

  if (url && url.trim() !== '') {
    display.src = url;
    display.classList.remove('hidden');
    placeholder.classList.add('hidden');
  } else {
    display.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }
}

// Contact form
function handleContact(e) {
  e.preventDefault();
  const msgEl = document.getElementById('contactMsg');
  msgEl.textContent = '✓ Message sent successfully! We\'ll get back to you soon.';
  msgEl.classList.remove('hidden');
  e.target.reset();
  setTimeout(() => msgEl.classList.add('hidden'), 5000);
}

// Profile
async function loadProfile() {
  if (!currentUser) return;

  try {
    const res = await fetch(`/api/auth/profile/${currentUser}`, {
      credentials: 'include'
    });
    if (res.ok) {
      profileData = await res.json();

      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; }

      setVal('profileUserId', currentUser);
      setVal('fullName', profileData.fullName);
      setVal('email', profileData.email);
      setVal('phone', profileData.phone);
      setVal('location', profileData.location);
      setVal('summary', profileData.professionalSummary);
      setVal('profileImageUrl', profileData.profileImage);
      setVal('linkedinUrl', profileData.linkedin);
      setVal('githubUrl', profileData.github);
      setVal('twitterUrl', profileData.twitter);
      setVal('websiteUrl', profileData.website);
      setVal('course', profileData.course);
      setVal('degree', profileData.degree);

      if (profileData.profileImage) {
        updateProfileImagePreview(profileData.profileImage);
      }

      try {
        profileSkills = profileData.skills ? JSON.parse(profileData.skills) : [];
      } catch (e) { profileSkills = []; }

      try {
        profileExperience = profileData.experience ? JSON.parse(profileData.experience) : [];
      } catch (e) { profileExperience = []; }

      try {
        profileEducation = profileData.education ? JSON.parse(profileData.education) : [];
      } catch (e) { profileEducation = []; }

      try {
        profileCertifications = profileData.certifications ? JSON.parse(profileData.certifications) : [];
      } catch (e) { profileCertifications = []; }

      try {
        profileProjects = profileData.projects ? JSON.parse(profileData.projects) : [];
      } catch (e) { profileProjects = []; }

      renderSkillsTable();
      renderExperienceTable();
      renderEducationTable();
      renderCertificationsTable();
      renderProjectsTable();
    }
  } catch (e) {
    console.error('Profile fetch error:', e);
    showToast('Failed to load profile details', 'error');
  }
}


async function saveProfile(e) {
  if (e) e.preventDefault();
  resetIdleTimer();

  const profileInfo = {
    userId: currentUser,
    fullName: document.getElementById('fullName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    location: document.getElementById('location').value,
    professionalSummary: document.getElementById('summary') ? document.getElementById('summary').value : (profileData.professionalSummary || ''),
    skills: JSON.stringify(profileSkills),
    experience: JSON.stringify(profileExperience),
    education: JSON.stringify(profileEducation),
    certifications: JSON.stringify(profileCertifications),
    projects: JSON.stringify(profileProjects),
    profileImage: document.getElementById('profileImageUrl') ? document.getElementById('profileImageUrl').value : (profileData.profileImage || ''),
    linkedin: document.getElementById('linkedinUrl') ? document.getElementById('linkedinUrl').value : (profileData.linkedin || ''),
    github: document.getElementById('githubUrl') ? document.getElementById('githubUrl').value : (profileData.github || ''),
    twitter: document.getElementById('twitterUrl') ? document.getElementById('twitterUrl').value : (profileData.twitter || ''),
    website: document.getElementById('websiteUrl') ? document.getElementById('websiteUrl').value : (profileData.website || ''),
    course: document.getElementById('course') ? document.getElementById('course').value : (profileData.course || 'Other'),
    degree: document.getElementById('degree') ? document.getElementById('degree').value : (profileData.degree || 'Other')
  };

  try {
    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profileInfo)
    });

    const data = await response.json();

    if (response.ok) {
      // Check if email verification is required
      if (data.requiresVerification) {
        const otpInput = prompt("Enter the verification code sent to " + data.pendingEmail);
        if (otpInput) {
          const verifyRes = await fetch('/api/auth/verify-email-change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser, otp: otpInput })
          });
          if (verifyRes.ok) {
            alert("Email updated successfully!");
            await loadProfile();
          } else {
            const vData = await verifyRes.json();
            alert("Email update failed: " + vData.error);
          }
        }
      } else if (data.error) {
        console.error("Profile update error: ", data.error);
        if (data.error.includes('Email')) alert(data.error);
      }

      showToast('Profile saved successfully!', 'success');

      // Sync local names/header if changed
      if (profileInfo.fullName) {
        currentUserName = profileInfo.fullName;
        localStorage.setItem('currentUserName', currentUserName);
        const display = document.getElementById('userDisplay');
        if (display) display.textContent = currentUserName;
      }

      await loadProfile();
    } else {
      throw new Error(data.error || 'Save failed');
    }
  } catch (err) {
    console.error('Error saving profile:', err);
    showToast('Error saving profile: ' + err.message, 'error');
  }
}

// ------ Dynamic List Helpers ------

// Skills
function addSkillRow() {
  profileSkills.push({ name: '', level: 'Beginner' });
  renderSkillsTable();
}
function removeSkillRow(index) {
  profileSkills.splice(index, 1);
  renderSkillsTable();
}
function updateSkill(index, field, value) {
  profileSkills[index][field] = value;
}
function renderSkillsTable() {
  const container = document.getElementById('skillsTableBody');
  if (!container) return;

  if (profileSkills.length === 0) {
    container.innerHTML = '<tr><td colspan="3" class="px-4 py-3 text-center text-slate-500 text-sm">No skills added yet</td></tr>';
    return;
  }
  container.innerHTML = profileSkills.map((item, idx) => `
    <tr class="hover:bg-slate-700/30 transition-colors">
      <td class="px-2 py-2">
        <input type="text" placeholder="Skill Name" value="${escapeHtml(item.name || '')}" onchange="updateSkill(${idx}, 'name', this.value)" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/>
      </td>
      <td class="px-2 py-2">
        <select onchange="updateSkill(${idx}, 'level', this.value)" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none">
           <option value="Beginner" ${item.level === 'Beginner' ? 'selected' : ''}>Beginner</option>
           <option value="Intermediate" ${item.level === 'Intermediate' ? 'selected' : ''}>Intermediate</option>
           <option value="Advanced" ${item.level === 'Advanced' ? 'selected' : ''}>Advanced</option>
           <option value="Expert" ${item.level === 'Expert' ? 'selected' : ''}>Expert</option>
        </select>
      </td>
      <td class="px-2 py-2 text-center">
        <button type="button" onclick="removeSkillRow(${idx})" class="text-red-400 hover:text-red-300">
           <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

// Experience
function addExperienceRow() {
  profileExperience.push({ role: '', company: '', duration: '' });
  renderExperienceTable();
}
function removeExperienceRow(index) {
  profileExperience.splice(index, 1);
  renderExperienceTable();
}
function updateExperience(index, field, value) {
  profileExperience[index][field] = value;
}
function renderExperienceTable() {
  const container = document.getElementById('experienceTableBody');
  if (!container) return;
  if (profileExperience.length === 0) {
    container.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-slate-500 text-sm">No experience added yet</td></tr>';
    return;
  }
  container.innerHTML = profileExperience.map((item, idx) => `
    <tr class="hover:bg-slate-700/30 transition-colors">
       <td class="px-2 py-2"><input type="text" placeholder="Role/Title" value="${escapeHtml(item.role || '')}" onchange="updateExperience(${idx}, 'role', this.value)" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm outline-none"/></td>
       <td class="px-2 py-2"><input type="text" placeholder="Company" value="${escapeHtml(item.company || '')}" onchange="updateExperience(${idx}, 'company', this.value)" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm outline-none"/></td>
       <td class="px-2 py-2"><input type="text" placeholder="Duration (e.g. 2020-2022)" value="${escapeHtml(item.duration || '')}" onchange="updateExperience(${idx}, 'duration', this.value)" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm outline-none"/></td>
       <td class="px-2 py-2 text-center"><button type="button" onclick="removeExperienceRow(${idx})" class="text-red-400 hover:text-red-300"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></td>
    </tr>
  `).join('');
}

// Education
function addEducationRow() {
  profileEducation.push({ degree: '', institution: '', year: '' });
  renderEducationTable();
}
function removeEducationRow(index) {
  profileEducation.splice(index, 1);
  renderEducationTable();
}
function updateEducation(index, field, value) {
  profileEducation[index][field] = value;
}
function renderEducationTable() {
  const container = document.getElementById('educationTableBody');
  if (!container) return;
  if (profileEducation.length === 0) {
    container.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-slate-500 text-sm">No education added yet</td></tr>';
    return;
  }
  container.innerHTML = profileEducation.map((item, idx) => `
    <tr class="hover:bg-slate-700/30 transition-colors">
       <td class="px-2 py-2"><input type="text" placeholder="Degree" value="${escapeHtml(item.degree || '')}" onchange="updateEducation(${idx}, 'degree', this.value)" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm outline-none"/></td>
       <td class="px-2 py-2"><input type="text" placeholder="Institution" value="${escapeHtml(item.institution || '')}" onchange="updateEducation(${idx}, 'institution', this.value)" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm outline-none"/></td>
       <td class="px-2 py-2"><input type="text" placeholder="Year" value="${escapeHtml(item.year || '')}" onchange="updateEducation(${idx}, 'year', this.value)" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm outline-none"/></td>
       <td class="px-2 py-2 text-center"><button type="button" onclick="removeEducationRow(${idx})" class="text-red-400 hover:text-red-300"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></td>
    </tr>
  `).join('');
}

// Certifications
function addCertificationRow() {
  profileCertifications.push({ name: '', issuer: '', year: '' });
  renderCertificationsTable();
}
function removeCertificationRow(index) {
  profileCertifications.splice(index, 1);
  renderCertificationsTable();
}
function updateCertification(index, field, value) {
  profileCertifications[index][field] = value;
}
function renderCertificationsTable() {
  const container = document.getElementById('certificationsTableBody');
  if (!container) return;
  if (profileCertifications.length === 0) {
    container.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-slate-500 text-sm">No certifications added yet</td></tr>';
    return;
  }
  container.innerHTML = profileCertifications.map((item, idx) => `
    <tr class="hover:bg-slate-700/30 transition-colors">
       <td class="px-2 py-2"><input type="text" placeholder="Certification Name" value="${escapeHtml(item.name || '')}" onchange="updateCertification(${idx}, 'name', this.value)" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm outline-none"/></td>
       <td class="px-2 py-2"><input type="text" placeholder="Issuer" value="${escapeHtml(item.issuer || '')}" onchange="updateCertification(${idx}, 'issuer', this.value)" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm outline-none"/></td>
       <td class="px-2 py-2"><input type="text" placeholder="Year" value="${escapeHtml(item.year || '')}" onchange="updateCertification(${idx}, 'year', this.value)" class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm outline-none"/></td>
       <td class="px-2 py-2 text-center"><button type="button" onclick="removeCertificationRow(${idx})" class="text-red-400 hover:text-red-300"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></td>
    </tr>
  `).join('');
}


function renderProjectsTable() {
  const tbody = document.getElementById('projectsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  profileProjects.forEach((proj, idx) => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-700/50 hover:bg-slate-800/30 transition-all';
    row.innerHTML = `
      <td class="px-2 py-3"><input type="text" value="${escapeHtml(proj.name || '')}" onchange="updateProjectField(${idx}, 'name', this.value)" class="w-full bg-transparent outline-none text-white border-b border-transparent focus:border-indigo-500" placeholder="Project Name"></td>
      <td class="px-2 py-3"><input type="text" value="${escapeHtml(proj.url || '')}" onchange="updateProjectField(${idx}, 'url', this.value)" class="w-full bg-transparent outline-none text-white border-b border-transparent focus:border-indigo-500" placeholder="Description/URL"></td>
      <td class="px-2 py-3"><input type="date" value="${escapeHtml(proj.date || '')}" onchange="updateProjectField(${idx}, 'date', this.value)" class="w-full bg-transparent outline-none text-white border-b border-transparent focus:border-indigo-500"></td>
      <td class="px-2 py-3 text-center"><button type="button" onclick="removeProjectRow(${idx})" class="text-red-400 hover:text-red-300">✕</button></td>
    `;
    tbody.appendChild(row);
  });
}

function addProjectRow() {
  profileProjects.push({ name: '', url: '', date: '' });
  renderProjectsTable();
}

function removeProjectRow(idx) {
  profileProjects.splice(idx, 1);
  renderProjectsTable();
}

function updateProjectField(idx, field, value) {
  profileProjects[idx][field] = value;
}

function exportToPDF() {
  const data = {
    fullName: document.getElementById('fullName').value || 'Your Name',
    email: document.getElementById('email').value || 'email@example.com',
    phone: document.getElementById('phone').value || '+1 (555) 000-0000',
    location: document.getElementById('location').value || 'City, Country',
    summary: document.getElementById('summary') ? document.getElementById('summary').value : '',
    image: document.getElementById('profileImageUrl') ? document.getElementById('profileImageUrl').value : '',
    linkedin: document.getElementById('linkedinUrl') ? document.getElementById('linkedinUrl').value : '',
    github: document.getElementById('githubUrl') ? document.getElementById('githubUrl').value : '',
    twitter: document.getElementById('twitterUrl') ? document.getElementById('twitterUrl').value : '',
    website: document.getElementById('websiteUrl') ? document.getElementById('websiteUrl').value : '',
    course: document.getElementById('course') ? document.getElementById('course').value : ''
  };

  const cvHtml = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      
      .cv-container { 
        font-family: 'Inter', sans-serif; 
        color: #1e293b; 
        width: 790px;
        height: 1115px;
        margin: 0; 
        padding: 0; 
        display: flex;
        background: white;
        overflow: hidden;
      }
      
      .sidebar {
        width: 280px;
        background-color: #f8fafc;
        border-right: 1px solid #e2e8f0;
        padding: 40px 25px;
        display: flex;
        flex-direction: column;
        gap: 25px;
      }
      
      .profile-img-container {
        width: 130px;
        height: 130px;
        margin: 0 auto;
        border-radius: 12px;
        overflow: hidden;
        border: 2px solid #6366f1;
      }
      
      .profile-img { width: 100%; height: 100%; object-fit: cover; }
      
      .sidebar-section-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #475569;
        margin-bottom: 10px;
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 5px;
      }
      
      .contact-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 10.5px;
        color: #334155;
        margin-bottom: 10px;
        line-height: 1.4;
      }

      .contact-icon { color: #6366f1; font-weight: bold; width: 15px; }
      
      .skill-tags { display: flex; flex-wrap: wrap; gap: 6px; }
      .skill-badge {
        background: #f1f5f9;
        color: #0f172a;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 600;
        border: 1px solid #e2e8f0;
      }
      
      .main-content {
        flex: 1;
        padding: 50px 40px;
        display: flex;
        flex-direction: column;
        gap: 25px;
      }
      
      .header-name {
        font-size: 36px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 6px;
        line-height: 1.1;
        letter-spacing: -0.02em;
      }
      
      .header-title {
        font-size: 16px;
        font-weight: 600;
        color: #6366f1;
        margin-bottom: 20px;
      }
      
      .section-header {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 12px;
      }
      
      .section-title {
        font-size: 14px;
        font-weight: 800;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .section-line {
        height: 2px;
        background: #f1f5f9;
        flex: 1;
      }
      
      .summary-text {
        font-size: 11px;
        line-height: 1.6;
        color: #334155;
        text-align: justify;
      }
      
      .entry { margin-bottom: 15px; }
      .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 4px;
      }
      .entry-title { font-size: 13px; font-weight: 700; color: #0f172a; }
      .entry-subtitle { font-size: 11.5px; font-weight: 600; color: #475569; }
      .entry-date { font-size: 10.5px; color: #64748b; font-weight: 600; }
      .entry-desc { font-size: 10.5px; color: #475569; margin-top: 4px; line-height: 1.5; }

      .social-link { color: #6366f1; text-decoration: none; word-break: break-all; }
      
    </style>
    <div class="cv-container">
      <div class="sidebar">
        ${data.image ? `<div class="profile-img-container"><img src="${data.image}" class="profile-img"></div>` : ''}
        
        <div>
          <div class="sidebar-section-title">Contact</div>
          <div class="contact-item"><span class="contact-icon">📍</span> ${escapeHtml(data.location)}</div>
          <div class="contact-item"><span class="contact-icon">📞</span> ${escapeHtml(data.phone)}</div>
          <div class="contact-item"><span class="contact-icon">📧</span> ${escapeHtml(data.email)}</div>
          ${data.website ? `<div class="contact-item"><span class="contact-icon">🔗</span> <a href="${data.website}" class="social-link">${data.website.replace(/^https?:\/\//, '')}</a></div>` : ''}
        </div>
        
        ${(data.linkedin || data.github || data.twitter) ? `
        <div>
          <div class="sidebar-section-title">Social Profiles</div>
          ${data.linkedin ? `<div class="contact-item"><span class="contact-icon">in</span> <a href="${data.linkedin}" class="social-link">linkedin.com/in/${data.linkedin.split('/').filter(Boolean).pop()}</a></div>` : ''}
          ${data.github ? `<div class="contact-item"><span class="contact-icon">gh</span> <a href="${data.github}" class="social-link">github.com/${data.github.split('/').filter(Boolean).pop()}</a></div>` : ''}
          ${data.twitter ? `<div class="contact-item"><span class="contact-icon">tw</span> <a href="${data.twitter}" class="social-link">@${data.twitter.split('/').filter(Boolean).pop()}</a></div>` : ''}
        </div>
        ` : ''}
        
        ${profileSkills.length > 0 ? `
        <div>
          <div class="sidebar-section-title">Skills & Tech Stack</div>
          <div class="skill-tags">
            ${profileSkills.map(s => `<span class="skill-badge">${escapeHtml(s.name)}</span>`).join('')}
          </div>
        </div>
        ` : ''}

        ${profileCertifications.length > 0 ? `
        <div>
          <div class="sidebar-section-title">Certifications</div>
          ${profileCertifications.slice(0, 5).map(cert => `
            <div style="margin-bottom: 10px;">
              <div style="font-size: 10.5px; font-weight: 700; color: #0f172a;">${escapeHtml(cert.name)}</div>
              <div style="font-size: 9.5px; color: #64748b; font-weight: 500;">${escapeHtml(cert.issuer)} | ${escapeHtml(cert.year)}</div>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
      
      <div class="main-content">
        <div>
          <h1 class="header-name">${escapeHtml(data.fullName)}</h1>
          <p class="header-title">${data.course ? escapeHtml(data.course) : 'Professional Career Candidate'}</p>
        </div>
        
        ${data.summary ? `
        <div class="section">
          <div class="section-header"><span class="section-title">Professional Summary</span><div class="section-line"></div></div>
          <p class="summary-text">${escapeHtml(data.summary).replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}
        
        ${profileExperience.length > 0 ? `
        <div class="section">
          <div class="section-header"><span class="section-title">Experience</span><div class="section-line"></div></div>
          ${profileExperience.map(exp => `
            <div class="entry">
              <div class="entry-header">
                <span class="entry-title">${escapeHtml(exp.role)}</span>
                <span class="entry-date">${escapeHtml(exp.duration)}</span>
              </div>
              <div class="entry-subtitle">${escapeHtml(exp.company)}</div>
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${profileProjects.length > 0 ? `
        <div class="section">
          <div class="section-header"><span class="section-title">Featured Projects</span><div class="section-line"></div></div>
          ${profileProjects.map(proj => `
            <div class="entry">
              <div class="entry-header">
                <span class="entry-title">${escapeHtml(proj.name)}</span>
                <span class="entry-date">${escapeHtml(proj.date)}</span>
              </div>
              <div class="entry-desc">${escapeHtml(proj.url)}</div>
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${profileEducation.length > 0 ? `
        <div class="section">
          <div class="section-header"><span class="section-title">Education</span><div class="section-line"></div></div>
          ${profileEducation.map(edu => `
            <div class="entry">
              <div class="entry-header">
                <span class="entry-title">${escapeHtml(edu.degree)}</span>
                <span class="entry-date">${escapeHtml(edu.year)}</span>
              </div>
              <div class="entry-subtitle">${escapeHtml(edu.institution)}</div>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
    </div>
  `;

  const element = document.createElement('div');
  element.innerHTML = cvHtml;
  document.body.appendChild(element);

  const opt = {
    margin: 0,
    filename: `${data.fullName.replace(/\s+/g, '_')}_Resume.pdf`,
    image: { type: 'jpeg', quality: 1 },
    html2canvas: {
      scale: 3,
      useCORS: true,
      letterRendering: true,
      width: 790,
      height: 1120
    },
    jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
  };

  if (window.html2pdf) {
    showToast('Generating premium single-page CV...', 'info');
    window.html2pdf().set(opt).from(element).save().then(() => {
      document.body.removeChild(element);
    }).catch(err => {
      console.error('PDF generation error:', err);
      document.body.removeChild(element);
    });
  } else {
    showToast('PDF engine not loaded', 'error');
    document.body.removeChild(element);
  }
}

// New Helpers for Application Type
async function fetchCourses() {
  const select = document.getElementById('course');
  if (!select) return;

  try {
    const response = await fetch('/admin/courses/public');
    if (response.ok) {
      const courses = await response.json();
      const currentValue = select.value;
      select.innerHTML = '<option value="" disabled>Select your course</option>' +
        courses.map(c => `<option value="${escapeHtml(c)}" ${c === currentValue ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');

      // If we have profile data, set the value after loading
      if (profileData.course) {
        select.value = profileData.course;
      }
    }
  } catch (err) {
    console.error('Failed to fetch courses', err);
  }
}

async function fetchCompanies() {
  try {
    const response = await fetch('/admin/companies/public');
    if (response.ok) {
      companyList = await response.json();
    }
  } catch (err) {
    console.error('Failed to fetch companies', err);
  }
}

function setApplicationType(type) {
  currentApplicationType = type;
  document.getElementById('jobApplicationType').value = type;

  // Toggle Button Styles
  const btnIn = document.getElementById('btnInCampus');
  const btnOff = document.getElementById('btnOffCampus');

  if (type === 'In Campus' || type === 'In-Campus') {
    btnIn.classList.add('bg-indigo-600', 'text-white');
    btnIn.classList.remove('bg-transparent', 'text-slate-400');
    btnOff.classList.remove('bg-indigo-600', 'text-white');
    btnOff.classList.add('bg-transparent', 'text-slate-400');
    // Normalize to space version for the hidden input
    document.getElementById('jobApplicationType').value = 'In Campus';
  } else {
    btnOff.classList.add('bg-indigo-600', 'text-white');
    btnOff.classList.remove('bg-transparent', 'text-slate-400');
    btnIn.classList.remove('bg-indigo-600', 'text-white');
    btnIn.classList.add('bg-transparent', 'text-slate-400');
    // Normalize to space version for the hidden input
    document.getElementById('jobApplicationType').value = 'Off Campus';
  }

  renderCompanyInput();
}

function renderCompanyInput(preselectedValue = '') {
  const container = document.getElementById('companyInputContainer');
  container.innerHTML = '';

  if (currentApplicationType === 'In Campus') {
    const select = document.createElement('select');
    select.id = 'jobCompany';
    select.required = true;
    select.className = "w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-white";

    select.innerHTML = `<option value="" disabled ${!preselectedValue ? 'selected' : ''}>Select Company</option>` +
      companyList.map(c => `<option value="${escapeHtml(c.name)}" ${c.name === preselectedValue ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

    container.appendChild(select);
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'jobCompany';
    input.required = true;
    input.className = "w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-white placeholder-slate-500";
    input.placeholder = "e.g., Google";
    input.value = preselectedValue;
    container.appendChild(input);
  }
}

// Job CRUD
async function openAddModal() {
  await fetchCompanies();
  document.getElementById('modalTitle').textContent = 'Add Job Application';
  document.getElementById('jobForm').reset();

  // Default to Off Campus
  setApplicationType('Off Campus');

  document.getElementById('editingJobId').value = '';
  document.getElementById('jobDate').value = new Date().toISOString().split('T')[0];
  currentRounds = [];
  renderRoundsTable();
  document.getElementById('jobModal').classList.remove('hidden');
}

async function openEditModal(job) {
  await fetchCompanies();
  document.getElementById('modalTitle').textContent = 'Edit Application';
  document.getElementById('editingJobId').value = job._id;

  // Determine Type
  const type = job.applicationType || 'Off Campus';
  setApplicationType(type);

  // Render Input with Value
  renderCompanyInput(job.company);

  // Set other fields
  document.getElementById('jobPosition').value = job.position;
  document.getElementById('jobStatus').value = job.status;
  document.getElementById('jobDate').value = job.applied_date ? job.applied_date.split('T')[0] : '';
  document.getElementById('jobNotes').value = job.notes || '';
  currentRounds = job.rounds ? JSON.parse(job.rounds) : [];
  renderRoundsTable();
  document.getElementById('jobModal').classList.remove('hidden');
}

function addRoundRow() {
  currentRounds.push({ round: '', datetime: '' });
  renderRoundsTable();
}

function removeRoundRow(index) {
  currentRounds.splice(index, 1);
  renderRoundsTable();
}

function updateRound(index, field, value) {
  currentRounds[index][field] = value;
}

function renderRoundsTable() {
  const tbody = document.getElementById('roundsTable');
  if (currentRounds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="px-3 py-4 text-center text-slate-500 text-xs">No rounds added yet</td></tr>';
    return;
  }

  tbody.innerHTML = currentRounds.map((round, idx) => `
        <tr class="hover:bg-slate-700/50">
          <td class="px-3 py-2">
            <input type="text" placeholder="e.g., Technical Round" value="${escapeHtml(round.round)}" onchange="updateRound(${idx}, 'round', this.value)" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 outline-none"/>
          </td>
          <td class="px-3 py-2">
            <input type="datetime-local" value="${round.datetime}" onchange="updateRound(${idx}, 'datetime', this.value)" class="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"/>
          </td>
          <td class="px-3 py-2 text-center">
            <button type="button" onclick="removeRoundRow(${idx})" class="text-red-400 hover:text-red-300 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </td>
        </tr>
      `).join('');
}

function closeModal() {
  document.getElementById('jobModal').classList.add('hidden');
}

async function handleJobSubmit(e) {
  e.preventDefault();
  resetIdleTimer();
  const editingId = document.getElementById('editingJobId').value;
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const companyName = document.getElementById('jobCompany').value;
  let applicationType = document.getElementById('jobApplicationType').value;

  // AUTO-NORMALIZATION: If company is in the In-Campus list, force the type to In Campus
  const isInCampusCompany = companyList.some(c => c.name.toLowerCase() === companyName.toLowerCase());
  if (isInCampusCompany) {
    applicationType = 'In Campus';
  }

  const jobData = {
    company: companyName,
    applicationType: applicationType,
    position: document.getElementById('jobPosition').value,
    status: document.getElementById('jobStatus').value,
    appliedDate: document.getElementById('jobDate').value,
    notes: document.getElementById('jobNotes').value,
    userId: currentUser,
    rounds: JSON.stringify(currentRounds)
  };

  let response;
  try {
    if (editingId) {
      response = await fetch(`/api/jobs/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser
        },
        body: JSON.stringify(jobData)
      });
    } else {
      response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser
        },
        body: JSON.stringify(jobData)
      });
    }

    const resultData = await response.json();
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save';

    if (response.ok) {
      const savedJob = resultData;
      await fetchJobs();

      closeModal();
      showToast(editingId ? 'Application updated!' : 'Application added!', 'success');
    } else {
      showToast('Error saving application', 'error');
    }
  } catch (err) {
    console.error('Error saving application:', err);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save';
    showToast('Error saving application', 'error');
  }
}

function openDeleteConfirm(job) {
  jobToDelete = job;
  document.getElementById('deleteConfirm').classList.remove('hidden');
}

function closeDeleteConfirm() {
  jobToDelete = null;
  document.getElementById('deleteConfirm').classList.add('hidden');
}

async function confirmDelete() {
  if (!jobToDelete) return;
  resetIdleTimer();
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    const response = await fetch(`/api/jobs/${jobToDelete._id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-User-Id': currentUser
      }
    });

    btn.disabled = false;
    btn.textContent = 'Delete';
    closeDeleteConfirm();

    if (response.ok) {
      await fetchJobs();
      // Cancel notifications
      fetch(`/api/notifications/job/${jobToDelete._id}`, {
        method: 'DELETE'
      }).catch(err => console.error('Error canceling notifications:', err));

      showToast('Application deleted', 'success');
    } else {
      showToast('Error deleting application', 'error');
    }
  } catch (err) {
    console.error('Error deleting application:', err);
    btn.disabled = false;
    btn.textContent = 'Delete';
    showToast('Error deleting application', 'error');
  }
}

function renderJobs() {
  const container = document.getElementById('jobList');
  if (!container) return; // not on dashboard

  const warning = document.getElementById('limitWarning');

  const userJobs = jobs.filter(j => j.company !== 'Profile'); // Filter out profile data

  if (userJobs.length >= 999) {
    warning.classList.remove('hidden');
  } else {
    warning.classList.add('hidden');
  }

  if (userJobs.length === 0) {
    container.innerHTML = `
          <div class="card-gradient rounded-xl p-8 border border-slate-700/50 text-center">
            <svg class="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            <p class="text-slate-400">No job applications yet. Click "Add Application" to get started!</p>
          </div>
        `;
    return;
  }

  container.innerHTML = userJobs.map(job => `
        <div class="card-gradient rounded-xl p-5 border border-slate-700/50 hover:border-indigo-500/30 transition-all slide-in" data-job-id="${job._id}">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h3 class="text-lg font-semibold">${escapeHtml(job.company)}</h3>
                <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(job.status)}">${job.status}</span>
              </div>
              <p class="text-slate-300">${escapeHtml(job.position)}</p>
              ${job.applied_date ? `<p class="text-slate-500 text-sm mt-1">Applied: ${formatDate(job.applied_date)}</p>` : ''}
              ${job.notes ? `<p class="text-slate-400 text-sm mt-2 italic">"${escapeHtml(job.notes)}"</p>` : ''}
              ${job.rounds && JSON.parse(job.rounds).length > 0 ? `<div class="mt-3 text-xs"><p class="text-slate-500 font-medium mb-1">Rounds:</p><div class="space-y-1">${JSON.parse(job.rounds).map(r => `<p class="text-slate-400">• ${escapeHtml(r.round)} - ${formatDate(r.datetime)}</p>`).join('')}</div></div>` : ''}
            </div>
            <div class="flex items-center gap-2">
              <button onclick='openEditModal(${JSON.stringify(job).replace(/'/g, "\\'")})' class="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-all" title="Edit">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button onclick='openDeleteConfirm(${JSON.stringify(job).replace(/'/g, "\\'")})' class="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all" title="Delete">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `).join('');
}

function updateStats() {
  // Filter out profile logic handled in renderJobs but here we need to filter too
  const userJobs = jobs.filter(j => j.company !== 'Profile');

  const statTotal = document.getElementById('statTotal');
  if (statTotal) {
    statTotal.textContent = userJobs.length;
    document.getElementById('statApplied').textContent = userJobs.filter(j => j.status === 'Applied').length;
    document.getElementById('statInterview').textContent = userJobs.filter(j => j.status === 'Interview').length;
    document.getElementById('statOffer').textContent = userJobs.filter(j => j.status === 'Offer').length;
  }
}

function getStatusClass(status) {
  const classes = {
    'Applied': 'bg-blue-500/20 text-blue-400',
    'Screening': 'bg-cyan-500/20 text-cyan-400',
    'Interview': 'bg-yellow-500/20 text-yellow-400',
    'Offer': 'bg-green-500/20 text-green-400',
    'Rejected': 'bg-red-500/20 text-red-400'
  };
  return classes[status] || 'bg-slate-500/20 text-slate-400';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const msg = document.getElementById('toastMessage');

  if (!toast) return;

  const icons = {
    success: '<svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
    error: '<svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
    info: '<svg class="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>'
  };

  if (icon) icon.innerHTML = icons[type];
  if (msg) msg.textContent = message;

  toast.classList.remove('translate-y-20', 'opacity-0');

  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}

// Initialization
window.addEventListener('DOMContentLoaded', async () => {
  console.log('--- SESSION INITIALIZATION ---');
  console.log('window.SERVER_USER:', window.SERVER_USER);

  // Initialize currentUser from server-injected data with localStorage fallback
  if (window.SERVER_USER && window.SERVER_USER.userId) {
    currentUser = window.SERVER_USER.userId;
    currentUserName = window.SERVER_USER.fullName || null;
    isAdmin = window.SERVER_USER.isAdmin || false;
    console.log('Session active (Server):', currentUser, currentUserName, 'Admin:', isAdmin);
    // Sync localStorage
    localStorage.setItem('currentUser', currentUser);
    localStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');
    if (currentUserName) localStorage.setItem('currentUserName', currentUserName);
  } else {
    // Fallback to localStorage
    const savedUser = localStorage.getItem('currentUser');
    const savedName = localStorage.getItem('currentUserName');
    const savedAdmin = localStorage.getItem('isAdmin') === 'true';
    if (savedUser) {
      currentUser = savedUser;
      currentUserName = savedName || null;
      isAdmin = savedAdmin;
      console.log('Session active (Fallback/LocalStorage):', currentUser, currentUserName, 'Admin:', isAdmin);
    } else {
      currentUser = null;
      currentUserName = null;
      isAdmin = false;
      console.log('No active session.');
    }
  }

  applyConfig();
  checkAuth();
  await initData();

  // Page specific init
  if (document.getElementById('profilePage')) {
    await fetchCourses();
    await loadProfile();
  }

  // Handle URL params for auth
  const urlParams = new URLSearchParams(window.location.search);
  const authType = urlParams.get('auth');
  if (authType) {
    // Clear the param
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => scrollToAuthForm(authType), 100);
  }

  // Initialize Idle Tracker
  initIdleTracker();
});

// --- Idle Tracker ---

function resetIdleTimer() {
  if (!currentUser) return;
  localStorage.setItem(IDLE_STORAGE_KEY, Date.now());
}

function checkIdleStatus() {
  if (!currentUser) return;
  const lastActivity = parseInt(localStorage.getItem(IDLE_STORAGE_KEY));
  if (lastActivity && (Date.now() - lastActivity > IDLE_TIMEOUT)) {
    console.log('User idle for more than 1 hour. Logging out...');
    logout();
    showToast('Session expired due to inactivity', 'info');
  }
}

function initIdleTracker() {
  if (!currentUser) return;

  // Update initial activity timestamp if not present
  if (!localStorage.getItem(IDLE_STORAGE_KEY)) {
    resetIdleTimer();
  }

  ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetIdleTimer, true);
  });

  // Set interval to check idle status periodically (every 1 minute)
  setInterval(checkIdleStatus, 60000);

  // Cross-tab synchronization: If user logs out in another tab, redirect this tab too
  window.addEventListener('storage', (e) => {
    if (e.key === 'currentUser' && !e.newValue) {
      console.log('User logged out in another tab. Redirecting...');
      window.location.href = '/';
    }
  });
}
