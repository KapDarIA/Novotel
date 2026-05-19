const form = document.getElementById('authForm');
const alertBox = document.getElementById('alert');
const isRegister = document.body.dataset.mode === 'register';

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.classList.add('hidden');
  const login = form.login.value.trim();
  const password = form.password.value;

  try {
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const data = await api(endpoint, { method: 'POST', body: { login, password } });
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    if (redirect) {
      window.location.href = redirect;
    } else if (data.role === 'admin') {
      window.location.href = '/admin.html';
    } else {
      window.location.href = '/profile.html';
    }
  } catch (err) {
    alertBox.textContent = err.message;
    alertBox.classList.remove('hidden');
  }
});

setupUserIcon();
