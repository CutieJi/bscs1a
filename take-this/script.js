const form = document.getElementById('loginForm');
const message = document.getElementById('message');
const password = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');
const googleBtn = document.getElementById('googleBtn');
const face = document.getElementById('face');
const mascot = document.getElementById('mascot');
const pupils = document.querySelectorAll('.pupil');

if (togglePassword) {
  togglePassword.addEventListener('click', () => {
    const hidden = password.type === 'password';
    password.type = hidden ? 'text' : 'password';
    togglePassword.textContent = hidden ? 'Hide' : 'Show';
  });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const remember = document.getElementById('remember').checked;

  if (!email || !password.value.trim()) {
    message.textContent = 'Please enter both email and password.';
    return;
  }

  message.textContent = remember
    ? `Welcome back, ${email}. Your session will be remembered.`
    : `Welcome back, ${email}. Sign in demo successful.`;
});

googleBtn.addEventListener('click', () => {
  message.textContent = 'Google sign-in button clicked. Connect your auth logic here.';
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateMascotLook(clientX, clientY) {
  const faceRect = face.getBoundingClientRect();
  const mascotRect = mascot.getBoundingClientRect();
  const viewportX = clientX / window.innerWidth - 0.5;
  const viewportY = clientY / window.innerHeight - 0.5;

  const targetX = clientX - (faceRect.left + faceRect.width / 2);
  const targetY = clientY - (faceRect.top + faceRect.height / 2);
  const angle = Math.atan2(targetY, targetX);

  const maxPupilMove = 7;
  const pupilX = Math.cos(angle) * maxPupilMove;
  const pupilY = Math.sin(angle) * maxPupilMove;

  pupils.forEach((pupil) => {
    pupil.style.transform = `translate(calc(-50% + ${pupilX}px), calc(-50% + ${pupilY}px))`;
  });

  const mascotCenterX = mascotRect.left + mascotRect.width / 2;
  const mascotCenterY = mascotRect.top + mascotRect.height / 2;
  const localX = clamp((clientX - mascotCenterX) / 28, -12, 12);
  const localY = clamp((clientY - mascotCenterY) / 34, -8, 8);
  const rotateFace = clamp(viewportX * 12, -7, 7);
  const rotateBody = clamp(viewportX * 8, -4, 4);

  face.style.transform = `translateX(-50%) translate(${localX}px, ${localY}px) rotate(${rotateFace}deg)`;
  mascot.style.transform = `translateX(-50%) translate(${viewportX * 16}px, ${viewportY * 10}px) rotate(${rotateBody}deg)`;
}

function resetMascotLook() {
  pupils.forEach((pupil) => {
    pupil.style.transform = 'translate(-50%, -50%)';
  });
  face.style.transform = 'translateX(-50%)';
  mascot.style.transform = 'translateX(-50%)';
}

window.addEventListener('mousemove', (event) => {
  updateMascotLook(event.clientX, event.clientY);
});
window.addEventListener('mouseleave', resetMascotLook);
window.addEventListener('blur', resetMascotLook);
