// ---------- Image fallback (in case any image fails to load) ----------
document.addEventListener('error', (e)=>{
  if(e.target.tagName === 'IMG'){
    e.target.style.background = 'linear-gradient(135deg,#0B0B0C,#009E4A)';
    e.target.style.minHeight = '120px';
    e.target.onerror = null;
    e.target.src = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#0B0B0C"/><text x="50%" y="50%" fill="white" font-family="sans-serif" font-size="18" text-anchor="middle" dy=".3em">WorkX</text></svg>'
    );
  }
}, true);

// ---------- Header scroll state ----------
const header = document.getElementById('siteHeader');
window.addEventListener('scroll', ()=>{
  header.classList.toggle('scrolled', window.scrollY > 40);
});

// ---------- Nav: mobile hamburger + dropdowns (Ecosystem / Resources) ----------
const navBurger = document.getElementById('navBurger');
const navLinksEl = document.getElementById('navLinksEl');
const dropButtons = document.querySelectorAll('.nav-drop-caret-btn');

function closeAllDrops(){
  dropButtons.forEach(btn=>{
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', 'false');
    if(panel) panel.classList.remove('open');
  });
}
function closeMobileMenu(){
  navBurger.classList.remove('open');
  navBurger.setAttribute('aria-expanded', 'false');
  navLinksEl.classList.remove('mobile-open');
  closeAllDrops();
}
navBurger.addEventListener('click', ()=>{
  const isOpen = navLinksEl.classList.toggle('mobile-open');
  navBurger.classList.toggle('open', isOpen);
  navBurger.setAttribute('aria-expanded', String(isOpen));
  if(!isOpen) closeAllDrops();
});
dropButtons.forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    const willOpen = panel && !panel.classList.contains('open');
    closeAllDrops();
    if(willOpen){
      panel.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});
document.addEventListener('click', (e)=>{
  const insideOpenDrop = Array.from(dropButtons).some(btn=>{
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    return (panel && panel.contains(e.target)) || btn.contains(e.target);
  });
  if(!insideOpenDrop) closeAllDrops();
});
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){ closeAllDrops(); closeMobileMenu(); }
});
navLinksEl.querySelectorAll('a').forEach(a=>{
  a.addEventListener('click', ()=>{ closeMobileMenu(); });
});
window.addEventListener('resize', ()=>{
  if(window.innerWidth > 900) closeMobileMenu();
});

// ---------- FAQ accordion (works for any .faq-list on the page) ----------
document.querySelectorAll('.faq-list').forEach(faqList=>{
  faqList.addEventListener('click', (e)=>{
    const item = e.target.closest('.faq-item');
    if(!item) return;
    const wasOpen = item.classList.contains('open');
    faqList.querySelectorAll('.faq-item').forEach(i=>i.classList.remove('open'));
    if(!wasOpen) item.classList.add('open');
  });
});

// ---------- Pricing card CTA toast (works for any .pricing-grid on the page) ----------
document.querySelectorAll('.pricing-grid').forEach(grid=>{
  grid.querySelectorAll('.price-card a.btn').forEach(a=>{
    a.addEventListener('click', ()=>{
      const target = a.getAttribute('href');
      const isContact = target.includes('#contact');
      showToast(isContact ? 'Tell us about your team below' : 'Tell us what you need below');
    });
  });
});

// ---------- Reveal on scroll ----------
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
},{threshold:.15});
revealEls.forEach(el=>io.observe(el));

// =========================================================
// APP STATE
// =========================================================
let currentUser = null; // set after WorkXAPI.getMe() / login / register

// =========================================================
// BACKEND INTEGRATION LAYER (talks to WorkXAPI / Express + MongoDB)
// =========================================================

// ---------- Toast helper ----------
function showToast(msg){
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span class="tick">✓</span><span>${msg}</span>`;
  wrap.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('in'));
  setTimeout(()=>{
    t.classList.remove('in');
    setTimeout(()=>t.remove(),350);
  },3400);
}

// ---------- Modal helpers ----------
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('[data-close]').forEach(el=>{
  el.addEventListener('click', ()=>closeModal(el.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', (e)=>{ if(e.target===ov) ov.classList.remove('open'); });
});

// ---------- Session check on page load ----------
async function checkSession(){
  try{
    const { user } = await WorkXAPI.getMe();
    currentUser = user;
    updateAuthUI();
  }catch(err){
    currentUser = null; // not logged in, normal, not an error to show
  }
}
function updateAuthUI(){
  const loginBtn = document.getElementById('loginBtn');
  if(!loginBtn) return;
  loginBtn.textContent = currentUser ? currentUser.firstName : 'Log in';
}
checkSession();

// ---------- Newsletter (visual only, no backend endpoint for this yet) ----------
document.querySelector('.newsletter .btn').addEventListener('click', ()=>{
  const input = document.querySelector('.newsletter input');
  const val = input.value.trim();
  if(!val || !val.includes('@')){
    showToast('Enter a valid email to subscribe');
    return;
  }
  showToast('Subscribed! Welcome to WorkX.');
  input.value = '';
});

// ---------- Login / Signup modal (real: JWT + bcrypt via the backend) ----------
const loginBtnEl = document.getElementById('loginBtn');
if(loginBtnEl){
  loginBtnEl.addEventListener('click', ()=>{
    if(currentUser){
      // already logged in, clicking the pill logs out for convenience
      WorkXAPI.logout().finally(()=>{
        currentUser = null;
        updateAuthUI();
        showToast('Logged out');
      });
      return;
    }
    openModal('loginModal');
  });
}
const tabButtons = document.querySelectorAll('.login-tabs button');
const authNameField = document.getElementById('authNameField');
const authRememberField = document.getElementById('authRememberField');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authErrorEl = document.getElementById('authError');
let authMode = 'login';
tabButtons.forEach(tb=>{
  tb.addEventListener('click', ()=>{
    tabButtons.forEach(b=>b.classList.remove('active'));
    tb.classList.add('active');
    authMode = tb.dataset.tab;
    authNameField.style.display = authMode === 'signup' ? 'block' : 'none';
    authRememberField.style.display = authMode === 'signup' ? 'none' : 'block';
    authSubmitBtn.textContent = authMode === 'signup' ? 'Create account' : 'Log in';
    authErrorEl.style.display = 'none';
  });
});
document.getElementById('authForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  authErrorEl.style.display = 'none';
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  authSubmitBtn.disabled = true;

  try{
    if(authMode === 'signup'){
      const fullName = document.getElementById('authName').value.trim();
      const [firstName, ...rest] = fullName.split(' ');
      const lastName = rest.join(' ') || firstName; // backend requires both fields
      const { user } = await WorkXAPI.register({ firstName, lastName, email, password });
      currentUser = user;
      showToast('Account created, welcome to WorkX! Check your email to verify your account.');
    } else {
      const rememberMe = document.getElementById('authRemember').checked;
      const { user } = await WorkXAPI.login(email, password, rememberMe);
      currentUser = user;
      showToast(`Welcome back, ${user.firstName}!`);
    }
    updateAuthUI();
    closeModal('loginModal');
    e.target.reset();
  }catch(err){
    authErrorEl.textContent = err.message || 'Something went wrong, please try again.';
    authErrorEl.style.display = 'block';
  }finally{
    authSubmitBtn.disabled = false;
  }
});

// ---------- Shared lead-form submission handler ----------
// Used by every on-site inquiry form (Hero Enquiry, Contact, Landlord Property
// Submission) so the loading/duplicate-guard/success/error behavior lives in
// one place instead of being copy-pasted per form. `buildPayload(data)` maps
// that form's own fields to the shared {firstName,lastName,email,phone,message,extra}
// shape, or throws an Error with a user-facing validation message.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-.\s]{7,20}$/;

function wireLeadForm(form, buildPayload) {
  if (!form) return;
  const statusEl = form.querySelector('.form-status');
  const submitBtn = form.querySelector('button[type="submit"]');
  if (!statusEl || !submitBtn) return;
  const submitLabel = submitBtn.textContent;
  let submitting = false;

  function setStatus(kind, msg) {
    statusEl.className = 'form-status show ' + kind;
    statusEl.textContent = msg;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return; // guard against duplicate/double submissions

    const data = new FormData(form);

    // Honeypot: a hidden field real visitors never fill in. If it has a
    // value, a bot filled the form — silently drop without hitting the API.
    if ((data.get('website') || '').trim()) {
      form.reset();
      return;
    }

    let payload;
    try {
      payload = buildPayload(data);
    } catch (err) {
      setStatus('error', err.message);
      return;
    }
    payload.formName = form.dataset.formName || 'Contact Form';
    payload.pageUrl = window.location.href;

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    setStatus('loading', 'Sending your enquiry…');

    try {
      await WorkXAPI.submitContact(payload);
      setStatus('success', 'Thank you. Your inquiry has been submitted successfully. Our team will contact you soon.');
      form.reset();
    } catch (err) {
      setStatus('error', err.message || 'Something went wrong, please try again.');
    } finally {
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
    }
  });
}

// Contact section form (homepage)
wireLeadForm(document.getElementById('contactForm'), (data) => {
  const name = (data.get('name') || '').trim();
  const company = (data.get('company') || '').trim();
  const email = (data.get('email') || '').trim();
  const phone = (data.get('phone') || '').trim();
  const size = data.get('size') || '';
  const requirement = data.get('requirement') || '';

  if (!name || !company || !email || !size || !requirement) throw new Error('Please fill in all required fields.');
  if (!EMAIL_RE.test(email)) throw new Error('Please enter a valid email address.');
  if (phone && !PHONE_RE.test(phone)) throw new Error('Please enter a valid phone number.');

  const [firstName, ...rest] = name.split(' ');
  const payload = {
    firstName,
    lastName: rest.join(' ') || firstName,
    email,
    message: `Company: ${company}\nCompany size: ${size}\nRequirement: ${requirement}`,
    extra: { company, companySize: size, requirement },
  };
  if (phone) payload.phone = phone;
  return payload;
});

// Hero "Enquire now" widget (homepage)
wireLeadForm(document.getElementById('heroEnquiryForm'), (data) => {
  const name = (data.get('name') || '').trim();
  const company = (data.get('company') || '').trim();
  const email = (data.get('email') || '').trim();
  const size = data.get('size') || '';
  const requirement = data.get('requirement') || '';

  if (!name || !company || !email || !size || !requirement) throw new Error('Please fill in all required fields.');
  if (!EMAIL_RE.test(email)) throw new Error('Please enter a valid email address.');

  const [firstName, ...rest] = name.split(' ');
  return {
    firstName,
    lastName: rest.join(' ') || firstName,
    email,
    message: `Company: ${company}\nCompany size: ${size}\nRequirement: ${requirement}`,
    extra: { company, companySize: size, requirement },
  };
});

// Landlord "Submit your property" form
wireLeadForm(document.getElementById('propertyForm'), (data) => {
  const name = (data.get('name') || '').trim();
  const email = (data.get('email') || '').trim();
  const phone = (data.get('phone') || '').trim();
  const location = (data.get('location') || '').trim();
  const size = (data.get('size') || '').trim();
  const type = data.get('type') || '';
  const details = (data.get('details') || '').trim();

  if (!name || !email || !phone || !location || !size || !type) throw new Error('Please fill in all required fields.');
  if (!EMAIL_RE.test(email)) throw new Error('Please enter a valid email address.');
  if (!PHONE_RE.test(phone)) throw new Error('Please enter a valid phone number.');

  const [firstName, ...rest] = name.split(' ');
  return {
    firstName,
    lastName: rest.join(' ') || firstName,
    email,
    phone,
    message: details || '(no additional details provided)',
    extra: { propertyLocation: location, approximateSize: size, propertyType: type },
  };
});

// ---------- Floating WhatsApp button (site-wide, injected here so no page markup is duplicated) ----------
(() => {
  const WA_NUMBER = '923218845311';
  const WA_MESSAGE = "Hi WorkX, I’d like to know more about your workspace options.";
  const waLink = document.createElement('a');
  waLink.className = 'wa-float';
  waLink.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_MESSAGE)}`;
  waLink.target = '_blank';
  waLink.rel = 'noopener';
  waLink.setAttribute('aria-label', 'Chat with WorkX on WhatsApp');
  waLink.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17.5 14.4c-.3-.1-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.5-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5C10 9 9.5 7.8 9.3 7.3c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.2.3-1 1-1 2.4s1 2.8 1.1 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.2-.6-.4z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.6 1.4 5.2L2 22l4.9-1.3c1.5.8 3.2 1.3 5.1 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.7 0-3.3-.5-4.7-1.3l-.3-.2-3.2.9.9-3.1-.2-.3C3.7 14.6 3.2 13 3.2 12c0-4.8 3.9-8.7 8.8-8.7s8.8 3.9 8.8 8.7-3.9 8.7-8.8 8.7z"/></svg>';
  document.body.appendChild(waLink);

  // Hide while the footer is in view so it never sits on top of footer links.
  const footerEl = document.querySelector('footer');
  if (footerEl && 'IntersectionObserver' in window) {
    const waObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => waLink.classList.toggle('wa-hidden', entry.isIntersecting));
    }, { threshold: 0.05 });
    waObserver.observe(footerEl);
  }
})();

// ---------- Site-wide image lightbox (click any content image to view it full-screen) ----------
(() => {
  const overlay = document.createElement('div');
  overlay.className = 'img-lightbox';
  overlay.id = 'imgLightbox';
  overlay.innerHTML =
    '<button type="button" class="img-lightbox-close" aria-label="Close image viewer">&times;</button>' +
    '<img class="img-lightbox-img" alt="">';
  document.body.appendChild(overlay);
  const overlayImg = overlay.querySelector('.img-lightbox-img');
  const closeBtn = overlay.querySelector('.img-lightbox-close');

  function openLightbox(img) {
    overlayImg.src = img.currentSrc || img.src;
    overlayImg.alt = img.alt || '';
    overlay.classList.add('open');
    document.body.classList.add('lightbox-open');
  }
  function closeLightbox() {
    overlay.classList.remove('open');
    document.body.classList.remove('lightbox-open');
  }

  document.addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (img && !img.closest('a') && !img.closest('.img-lightbox') && !img.closest('.wa-float')) {
      openLightbox(img);
      return;
    }
    // Click outside the image (on the dark backdrop) closes it
    if (e.target === overlay) closeLightbox();
  });
  closeBtn.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeLightbox();
  });
})();

// ---------- "Trusted by teams at" logo carousel (arrow-scroll) ----------
(() => {
  const row = document.getElementById('trustedLogoRow');
  const prevBtn = document.getElementById('trustedPrevBtn');
  const nextBtn = document.getElementById('trustedNextBtn');
  if (!row || !prevBtn || !nextBtn) return;

  const step = () => Math.max(row.clientWidth * 0.6, 160);
  prevBtn.addEventListener('click', () => row.scrollBy({ left: -step(), behavior: 'smooth' }));
  nextBtn.addEventListener('click', () => row.scrollBy({ left: step(), behavior: 'smooth' }));
})();

// ---------- Client Reviews carousel (all reviews stay visible; chevrons/swipe rotate their order, looping) ----------
(() => {
  const track = document.getElementById('reviewTrack');
  if (!track) return;

  const prevBtn = document.getElementById('reviewPrevBtn');
  const nextBtn = document.getElementById('reviewNextBtn');
  const dotsWrap = document.getElementById('reviewDots');
  const count = track.children.length;
  let index = 0;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'review-carousel-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Show review ${i + 1} first`);
    dot.addEventListener('click', () => rotateTo(i));
    dotsWrap.appendChild(dot);
  }
  const dots = Array.from(dotsWrap.children);

  // FLIP-animated reorder: cards never disappear, they smoothly swap position.
  function reorder(mutate) {
    const cards = Array.from(track.children);
    const firstRects = cards.map(c => c.getBoundingClientRect());
    mutate(cards);
    const newCards = Array.from(track.children);
    newCards.forEach((c) => {
      const oldIndex = cards.indexOf(c);
      const oldRect = firstRects[oldIndex];
      const newRect = c.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      if (dx) {
        c.style.transition = 'none';
        c.style.transform = `translateX(${dx}px)`;
        requestAnimationFrame(() => {
          c.style.transition = 'transform .45s cubic-bezier(.4,0,.2,1)';
          c.style.transform = '';
        });
      }
    });
  }

  function next() {
    reorder(cards => track.appendChild(cards[0]));
    index = (index + 1) % count;
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
  }
  function prev() {
    reorder(cards => track.insertBefore(cards[cards.length - 1], cards[0]));
    index = (index - 1 + count) % count;
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
  }
  function rotateTo(target) {
    let steps = (target - index + count) % count;
    if (steps === 0) return;
    if (steps <= count / 2) { while (steps--) next(); }
    else { steps = count - steps; while (steps--) prev(); }
  }

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  // Touch / swipe support
  let touchStartX = 0;
  track.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  track.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
  });
})();