/**
 * WorkX Cookie Consent
 * Self-contained: injects the consent banner, the Cookie Settings modal, and a
 * "Cookie Settings" link in the footer at runtime, so no page markup needs to change.
 *
 * Set GA_MEASUREMENT_ID below (e.g. 'G-XXXXXXXXXX') once Google Analytics is ready to go live.
 * Until then this file loads no third-party script at all, consent or not.
 */
(() => {
  const GA_MEASUREMENT_ID = ''; // e.g. 'G-XXXXXXXXXX' — leave empty until GA4 is ready to activate
  const STORAGE_KEY = 'workx_cookie_consent';
  const CONSENT_VERSION = 1;

  // ---------- Storage helpers (safe in private browsing) ----------
  function getConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.version !== CONSENT_VERSION) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(analytics) {
    const consent = { version: CONSENT_VERSION, essential: true, analytics: !!analytics, savedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch (e) { /* private browsing: consent still applies for this session */ }
    return consent;
  }

  // ---------- Google Analytics (GA4) — only ever loads with consent + a real ID ----------
  function loadGoogleAnalytics() {
    if (!GA_MEASUREMENT_ID || document.getElementById('ga4-script')) return;
    const s = document.createElement('script');
    s.id = 'ga4-script';
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }

  function applyConsent(consent) {
    if (consent && consent.analytics) loadGoogleAnalytics();
  }

  // ---------- Banner ----------
  function buildBanner() {
    const wrap = document.createElement('div');
    wrap.className = 'cookie-banner';
    wrap.id = 'cookieBanner';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Cookie consent');
    wrap.innerHTML = `
      <div class="container">
        <div class="cookie-banner-inner">
          <div class="cookie-banner-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="15.5" r="1" fill="currentColor" stroke="none"/><path d="M15.5 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" stroke="none"/></svg></div>
          <div class="cookie-banner-text">
            <h4>We value your privacy</h4>
            <p>WorkX uses cookies, including Google Analytics, for website analytics to understand how our site is used and improve it. Essential cookies are always on. Read our <a href="privacy-policy.html">Privacy Policy</a> for details.</p>
          </div>
          <div class="cookie-banner-actions">
            <button type="button" class="btn btn-outline btn-sm" id="cookieBtnSettings">Cookie Settings</button>
            <button type="button" class="btn btn-outline btn-sm" id="cookieBtnReject">Reject NonEssential</button>
            <button type="button" class="btn btn-primary btn-sm" id="cookieBtnAcceptAll">Accept All</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    return wrap;
  }

  function showBanner() {
    let banner = document.getElementById('cookieBanner');
    if (!banner) banner = buildBanner();
    requestAnimationFrame(() => banner.classList.add('open'));
  }

  function hideBanner() {
    const banner = document.getElementById('cookieBanner');
    if (banner) banner.classList.remove('open');
  }

  // ---------- Settings modal (reuses the site's existing .modal-overlay / .modal-box) ----------
  function buildModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'cookieSettingsModal';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-close-x" id="cookieSettingsClose">✕</div>
        <h3 style="margin-bottom:6px;">Cookie Preferences</h3>
        <p style="margin-bottom:0;">Choose which cookies WorkX can use. You can change this at any time from the "Cookie Settings" link in the footer.</p>
        <div class="cookie-settings-row">
          <div>
            <span class="cookie-settings-tag">Always active</span>
            <h5>Strictly necessary</h5>
            <p>Required to keep you logged in and remember your session. The site can't function without these.</p>
          </div>
          <div class="toggle-wrap"><input type="checkbox" checked disabled aria-label="Strictly necessary cookies (always on)"></div>
        </div>
        <div class="cookie-settings-row">
          <div>
            <span class="cookie-settings-tag">Optional</span>
            <h5>Analytics (Google Analytics)</h5>
            <p>Helps us understand how visitors use workx.pk so we can improve it. No names, emails or phone numbers are sent.</p>
          </div>
          <div class="toggle-wrap"><input type="checkbox" id="cookieAnalyticsToggle" aria-label="Analytics cookies"></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:24px;">
          <button type="button" class="btn btn-outline" style="flex:1;" id="cookieSettingsReject">Reject NonEssential</button>
          <button type="button" class="btn btn-primary" style="flex:1;" id="cookieSettingsSave">Save Preferences</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal('cookieSettingsModal'); });
    document.getElementById('cookieSettingsClose').addEventListener('click', () => closeModal('cookieSettingsModal'));
    document.getElementById('cookieSettingsReject').addEventListener('click', () => {
      const consent = saveConsent(false);
      applyConsent(consent);
      document.getElementById('cookieAnalyticsToggle').checked = false;
      hideBanner();
      closeModal('cookieSettingsModal');
      if (typeof showToast === 'function') showToast('Only essential cookies will be used.');
    });
    document.getElementById('cookieSettingsSave').addEventListener('click', () => {
      const analyticsOn = document.getElementById('cookieAnalyticsToggle').checked;
      const consent = saveConsent(analyticsOn);
      applyConsent(consent);
      hideBanner();
      closeModal('cookieSettingsModal');
      if (typeof showToast === 'function') showToast('Cookie preferences saved.');
    });
    return overlay;
  }

  function openSettings() {
    let modal = document.getElementById('cookieSettingsModal');
    if (!modal) modal = buildModal();
    const existing = getConsent();
    document.getElementById('cookieAnalyticsToggle').checked = !!(existing && existing.analytics);
    openModal('cookieSettingsModal');
  }

  // ---------- Footer "Cookie Settings" link (appended at runtime, footer markup itself untouched) ----------
  function injectFooterLink() {
    const bottom = document.querySelector('footer .foot-bottom');
    if (!bottom) return;
    const linksSpan = bottom.querySelector('span:last-child');
    if (!linksSpan || linksSpan.querySelector('#cookieSettingsFooterLink')) return;
    const sep = document.createTextNode(' · ');
    const link = document.createElement('a');
    link.href = '#';
    link.id = 'cookieSettingsFooterLink';
    link.textContent = 'Cookie Settings';
    link.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });
    linksSpan.appendChild(sep);
    linksSpan.appendChild(link);
  }

  // ---------- Wire up banner buttons ----------
  function wireBanner() {
    const banner = document.getElementById('cookieBanner');
    if (!banner) return;
    document.getElementById('cookieBtnAcceptAll').addEventListener('click', () => {
      const consent = saveConsent(true);
      applyConsent(consent);
      hideBanner();
    });
    document.getElementById('cookieBtnReject').addEventListener('click', () => {
      const consent = saveConsent(false);
      applyConsent(consent);
      hideBanner();
    });
    document.getElementById('cookieBtnSettings').addEventListener('click', () => {
      openSettings();
    });
  }

  // ---------- Init ----------
  function init() {
    injectFooterLink();
    const existing = getConsent();
    if (existing) {
      applyConsent(existing);
      return;
    }
    showBanner();
    wireBanner();
  }

  window.WorkXConsent = {
    get: getConsent,
    openSettings: openSettings,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
