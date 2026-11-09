(() => {
  'use strict';
  if (window.SiteCookieSettings) return;
  const analyticsId = null;
  const key = 'site.cookie-consent.v1';
  const maxAge = 180 * 24 * 60 * 60 * 1000;
  let consent = null, host, root, banner, dialog, status;
  const language = () => document.documentElement.lang.startsWith('en') ? 'en' : 'id';
  const words = {
    id: { title:'Pengaturan Cookies', bannerTitle:'Pilihan Cookies Anda', description:'Penyimpanan yang diperlukan menjaga login, keamanan, dan pilihan yang Anda simpan. Analytics opsional hanya aktif setelah Anda menyetujuinya.', all:'Terima semua', necessaryOnly:'Hanya yang diperlukan', customize:'Atur Cookies', save:'Simpan pilihan', close:'Tutup', necessary:'Diperlukan', necessaryDescription:'Selalu aktif untuk sesi login, keamanan, dan fungsi yang Anda gunakan. Tidak dapat dinonaktifkan dari pengaturan ini.', analytics:'Analytics opsional', analyticsDescription:'Membantu memahami penggunaan situs melalui Google Analytics. Tidak dimuat sebelum Anda setuju.', unavailable:'Situs ini tidak memasang analytics opsional.', saved:'Pilihan Cookies disimpan.', session:'Pilihan diterapkan untuk sesi ini. Browser tidak mengizinkan penyimpanan preferensi.', revoke:'Anda dapat mengubah atau menarik persetujuan kapan saja melalui tombol Cookies.', active:'Selalu aktif', settings:'Cookies' },
    en: { title:'Cookie Settings', bannerTitle:'Your Cookie Choices', description:'Necessary storage keeps sign-in, security, and the choices you save working. Optional analytics runs only after you agree.', all:'Accept all', necessaryOnly:'Necessary only', customize:'Customize Cookies', save:'Save choices', close:'Close', necessary:'Necessary', necessaryDescription:'Always active for sign-in sessions, security, and the functions you use. These cannot be disabled here.', analytics:'Optional analytics', analyticsDescription:'Helps understand site usage through Google Analytics. It is not loaded before you agree.', unavailable:'This site does not use optional analytics.', saved:'Cookie choices saved.', session:'Choices applied for this session. Your browser does not allow saving preferences.', revoke:'You can change or withdraw consent at any time using the Cookies button.', active:'Always active', settings:'Cookies' }
  };
  function readConsent() {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      const age = Date.now() - Date.parse(value?.updatedAt);
      if (value?.version === 1 && value.necessary === true && typeof value.analytics === 'boolean' && Number.isFinite(age) && age >= 0 && age < maxAge) return value;
    } catch {}
    return null;
  }
  function removeAnalyticsCookies() {
    const domains = location.hostname.split('.');
    for (const pair of document.cookie.split(';')) {
      const name = pair.trim().split('=')[0];
      if (!/^(_ga|_gid|_gat|_gac|_gcl)(_|$)/.test(name)) continue;
      document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax';
      for (let i = 0; i < domains.length - 1; i++) document.cookie = name + '=; Max-Age=0; path=/; domain=.' + domains.slice(i).join('.') + '; SameSite=Lax';
    }
  }
  function applyAnalytics() {
    if (!analyticsId) return;
    const allowed = consent?.analytics === true;
    window['ga-disable-' + analyticsId] = !allowed;
    if (!allowed) {
      if (typeof window.gtag === 'function') window.gtag('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      removeAnalyticsCookies();
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    if (!document.getElementById('consented-google-analytics')) {
      window.gtag('js',new Date());
      window.gtag('config',analyticsId,{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});
      const script = document.createElement('script');
      script.id = 'consented-google-analytics';script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(analyticsId);
      document.head.appendChild(script);
    }
  }
  function choose(analytics) {
    consent = {version:1,necessary:true,analytics:Boolean(analyticsId && analytics),updatedAt:new Date().toISOString()};
    let saved = true;
    try { localStorage.setItem(key,JSON.stringify(consent)); } catch { saved = false; }
    applyAnalytics();
    if (dialog.open) dialog.close();
    render();
    status.textContent = words[language()][saved ? 'saved' : 'session'];
    window.dispatchEvent(new CustomEvent('site:cookieconsent',{detail:{necessary:true,analytics:consent.analytics}}));
  }
  function render() {
    if (!root) return;
    const t = words[language()];
    for (const element of root.querySelectorAll('[data-copy]')) element.textContent = t[element.dataset.copy];
    root.querySelector('#cookie-close').setAttribute('aria-label',t.close);
    root.querySelector('#cookie-open').setAttribute('aria-label',t.title);
    banner.setAttribute('aria-label',t.bannerTitle);
    banner.hidden = Boolean(consent);
    const toggle = root.querySelector('#cookie-analytics');
    toggle.checked = Boolean(consent?.analytics && analyticsId);
    toggle.disabled = !analyticsId;
    root.querySelector('#analytics-description').textContent = analyticsId ? t.analyticsDescription : t.unavailable;
    host.dataset.analytics = consent?.analytics ? 'granted' : 'denied';
  }
  function mount() {
    consent = readConsent();
    applyAnalytics();
    host = document.createElement('div');host.id='site-cookie-settings';host.setAttribute('translate','no');
    root = host.attachShadow({mode:'open'});
    root.innerHTML = `<style>:host{font:14px/1.5 system-ui,-apple-system,sans-serif;color:#172033;color-scheme:light}*{box-sizing:border-box}button{font:inherit;font-weight:650;cursor:pointer;min-height:42px;border:1px solid #cbd5e1;background:#fff;color:#172033;border-radius:11px;padding:9px 15px}button:hover{background:#f1f5f9}button:focus-visible,input:focus-visible{outline:3px solid #60a5fa;outline-offset:3px}.primary{background:#173d6b;color:#fff;border-color:#173d6b}.primary:hover{background:#23558e}.banner{position:fixed;z-index:2147483001;bottom:86px;left:50%;transform:translateX(-50%);width:min(680px,calc(100vw - 24px));max-height:calc(100dvh - 110px);overflow:auto;background:white;border:1px solid #cbd5e1;box-shadow:0 12px 56px #0f172a35;border-radius:20px;padding:22px}.banner[hidden]{display:none}h2{font-size:19px;line-height:1.3;margin:0 0 9px}p{margin:0;color:#526074}.actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.open{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:2147483000;box-shadow:0 4px 18px #0f172a26;background:#fff;border-radius:14px}dialog{color:#172033;width:min(560px,calc(100vw - 24px));max-height:calc(100dvh - 30px);overflow:auto;padding:26px;border:1px solid #cbd5e1;border-radius:22px;background:#fff;box-shadow:0 24px 80px #0004}dialog::backdrop{background:#07132688}.heading{display:flex;justify-content:space-between;align-items:start;gap:16px}.close{font-size:21px;line-height:1;padding:7px 12px;min-width:42px}.category{border:1px solid #dce3ec;padding:16px;border-radius:14px;margin-top:16px}.category label{display:flex;align-items:center;justify-content:space-between;gap:16px;font-weight:700}.category p{font-size:13px;margin-top:8px}.category input{width:22px;height:22px;accent-color:#173d6b;flex-shrink:0}.note{font-size:12px;margin-top:16px}.sr{position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:480px){.banner{padding:18px;bottom:84px}.actions button{flex:1 1 auto}.open{font-size:12px;padding:8px 11px}dialog{padding:20px}}</style><section class="banner" role="region"><h2 data-copy="bannerTitle"></h2><p data-copy="description"></p><div class="actions"><button class="primary" data-choice="all" data-copy="all"></button><button data-choice="necessary" data-copy="necessaryOnly"></button><button data-open data-copy="customize"></button></div></section><button class="open" id="cookie-open" data-open data-copy="settings"></button><dialog aria-labelledby="cookie-title"><div class="heading"><h2 id="cookie-title" data-copy="title"></h2><button id="cookie-close" class="close" type="button">×</button></div><p data-copy="description"></p><div class="category"><label><span data-copy="necessary"></span><input type="checkbox" checked disabled></label><p data-copy="necessaryDescription"></p></div><div class="category"><label><span data-copy="analytics"></span><input id="cookie-analytics" type="checkbox"></label><p id="analytics-description"></p></div><p class="note" data-copy="revoke"></p><div class="actions"><button class="primary" id="cookie-save" data-copy="save"></button><button data-choice="necessary" data-copy="necessaryOnly"></button></div></dialog><span class="sr" role="status" aria-live="polite"></span>`;
    banner=root.querySelector('.banner');dialog=root.querySelector('dialog');status=root.querySelector('[role="status"]');
    for (const button of root.querySelectorAll('[data-choice]')) button.addEventListener('click',()=>choose(button.dataset.choice==='all'));
    for (const button of root.querySelectorAll('[data-open]')) button.addEventListener('click',()=>{render();dialog.showModal();});
    root.querySelector('#cookie-close').addEventListener('click',()=>dialog.close());
    root.querySelector('#cookie-save').addEventListener('click',()=>choose(root.querySelector('#cookie-analytics').checked));
    document.body.appendChild(host);render();
    window.addEventListener('7mit:languagechange',render);
    window.addEventListener('storage',event=>{if(event.key===key){consent=readConsent();applyAnalytics();render();}});
  }
  window.SiteCookieSettings={open:()=>{render();dialog?.showModal();},get:()=>consent&&{necessary:true,analytics:consent.analytics}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
