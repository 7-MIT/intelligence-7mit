const API_URL = 'https://lajzrempjyoqkubkumhb.supabase.co/functions/v1/intellegence-7mit-public';
let aiVersion = null;
const SUPABASE_URL = 'https://lajzrempjyoqkubkumhb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_yGZ90Bkv3yreqc9pA55bpw_YKKBhWRw';
const SESSION_KEY = 'intellegence.7mit.session.v1';
const PROFILE_KEY = 'intellegence.7mit.profile.v1';
const GUEST_HISTORY_KEY = 'intellegence.7mit.guest-history.v1';
const THEME_KEY = 'intellegence.7mit.theme';
const LANGUAGE_KEY = 'intellegence.7mit.language';
const LOCATION_KEY = 'intellegence.7mit.location.enabled';
const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024;

const I18N = {
  id: {
    brandCaption:'Asisten digital 7 MIT', newChat:'Percakapan baru', search:'Cari riwayat', history:'Riwayat',
    settings:'Pengaturan', settingsCaption:'Akun, bahasa, dan data', ready:'AI siap digunakan',
    emptyTitle:'Mulai dari mana?', emptyCopy:'Tanyakan pelajaran, kembangkan ide, analisis file, atau minta bantuan menulis.',
    placeholder:'Tanya intelligence.7mit', inputLabel:'Pesan', attach:'Tambahkan file', send:'Kirim pesan',
    privacy:'Jawaban AI dapat keliru. Periksa kembali informasi penting. Histori tersimpan di akunmu.',
    listen:'Dengarkan', stopListening:'Hentikan', copyCode:'Salin kode', previewHtml:'Pratinjau', previewTitle:'Pratinjau HTML', closePreview:'Tutup pratinjau', copiedCode:'Kode disalin', speechUnavailable:'Fitur suara tidak tersedia di browser ini.',
    yesterday:'Kemarin', noHistory:'Belum ada riwayat', noSearch:'Riwayat tidak ditemukan', you:'Kamu', copy:'Salin', copied:'Jawaban disalin', copyFail:'Tidak dapat menyalin',
    thinking:'Sedang menyusun jawaban…', connectionError:'Koneksi bermasalah', newTitle:'Percakapan baru',
    deleteAsk:'Hapus percakapan ini dari perangkat?', deleted:'Percakapan dihapus', rename:'Nama percakapan:',
    tooMany:'Maksimal 8 file dalam satu pesan.', tooLarge:'Total lampiran maksimal 18 MB.', fileReadFail:'File tidak dapat dibaca.',
    fileAdded:'File ditambahkan', files:'file', removeFile:'Hapus file', analyzeFiles:'Tolong analisis lampiran ini.',
    timeout:'Permintaan terlalu lama. Silakan coba kirim lagi.', unavailable:'Maaf, layanan AI belum dapat merespons.', checkConnection:'Periksa koneksi lalu coba lagi.', unreadable:'Jawaban dari layanan tidak dapat dibaca.',
    storageFull:'Penyimpanan perangkat penuh', chats:'chat', stored:'percakapan tersimpan', emptyStored:'Belum ada percakapan tersimpan',
    downloadImage:'Unduh gambar', sources:'Sumber terkini', weatherNow:'Cuaca saat ini', feelsLike:'Terasa', humidity:'Kelembapan', wind:'Angin', forecast:'Prakiraan 5 hari', locationOff:'Aktifkan izin lokasi di Pengaturan untuk cuaca di lokasimu.',
    quizQuestion:'Soal', quizCheck:'Periksa jawaban', quizNext:'Soal berikutnya', quizResult:'Lihat hasil', quizRetry:'Ulangi kuis', quizCorrect:'Benar!', quizIncorrect:'Belum tepat', quizAnswer:'Jawaban benar', quizScore:'Skor kamu', quizComplete:'Kuis selesai', quizFallback:'Kuis belum bisa ditampilkan. Coba minta AI membuatnya lagi.',
    suggestions:{
      weather:{title:'Cuaca di lokasiku',sub:'Lihat kondisi dan prakiraan',prompt:'Bagaimana cuaca di lokasi saya sekarang? Tampilkan ringkasan dan prakiraan 5 hari.'},
      news:{title:'Berita terbaru',sub:'Ringkasan informasi terkini',prompt:'Ringkas berita penting terbaru hari ini dan sertakan sumber.'},
      image:{title:'Buat gambar',sub:'Hasilkan gambar dari deskripsi',prompt:'Buatkan gambar pemandangan kota futuristik 7 MIT dengan gaya sinematik.'},
      chart:{title:'Buat grafik',sub:'Ubah data menjadi visual',prompt:'Buat contoh grafik sederhana yang membandingkan nilai empat mata pelajaran.'}
      ,map:{title:'Peta Bumi',sub:'Negara, provinsi, dan kota',prompt:'Tampilkan Peta Bumi interaktif yang berfokus ke Indonesia dengan penanda Jakarta, lalu jelaskan letaknya.'}
      ,periodic:{title:'Tabel periodik',sub:'Pelajari setiap unsur',prompt:'Tampilkan tabel periodik interaktif dan jelaskan cara membacanya.'}
      ,visual3d:{title:'Visual 3D',sub:'Hewan, atom, dan sains',prompt:'Tampilkan visual 3D atom karbon dan jelaskan bagian-bagiannya.'}
      ,quiz:{title:'Buat kuis',sub:'Jawab soal interaktif',prompt:'Buat kuis interaktif 5 soal pilihan ganda tentang IPA kelas 7.'}
    }
  },
  en: {
    brandCaption:'7 MIT digital assistant', newChat:'New conversation', search:'Search history', history:'History',
    settings:'Settings', settingsCaption:'Account, language, and data', ready:'AI is ready',
    emptyTitle:'Where should we start?', emptyCopy:'Ask about a lesson, develop an idea, analyze a file, or get help with writing.',
    placeholder:'Ask intelligence.7mit', inputLabel:'Message', attach:'Attach file', send:'Send message',
    privacy:'AI responses can be incorrect. Check important information. History is saved to your account.',
    listen:'Read aloud', stopListening:'Stop reading', copyCode:'Copy code', previewHtml:'Preview', previewTitle:'HTML preview', closePreview:'Close preview', copiedCode:'Code copied', speechUnavailable:'Read aloud is not available in this browser.',
    yesterday:'Yesterday', noHistory:'No history yet', noSearch:'No matching conversations', you:'You', copy:'Copy', copied:'Response copied', copyFail:'Could not copy',
    thinking:'Preparing a response…', connectionError:'Connection problem', newTitle:'New conversation',
    deleteAsk:'Delete this conversation from your device?', deleted:'Conversation deleted', rename:'Conversation name:',
    tooMany:'You can attach up to 8 files per message.', tooLarge:'Attachments can total up to 18 MB.', fileReadFail:'The file could not be read.',
    fileAdded:'File added', files:'files', removeFile:'Remove file', analyzeFiles:'Please analyze the attached files.',
    timeout:'The request took too long. Please try again.', unavailable:'Sorry, the AI service could not respond.', checkConnection:'Check your connection and try again.', unreadable:'The response could not be read.',
    storageFull:'Device storage is full', chats:'chats', stored:'conversations stored', emptyStored:'No conversations stored yet',
    downloadImage:'Download image', sources:'Live sources', weatherNow:'Current weather', feelsLike:'Feels like', humidity:'Humidity', wind:'Wind', forecast:'5-day forecast', locationOff:'Enable location access in Settings for weather near you.',
    quizQuestion:'Question', quizCheck:'Check answer', quizNext:'Next question', quizResult:'See results', quizRetry:'Try again', quizCorrect:'Correct!', quizIncorrect:'Not quite', quizAnswer:'Correct answer', quizScore:'Your score', quizComplete:'Quiz complete', quizFallback:'The quiz could not be displayed. Ask the AI to make it again.',
    suggestions:{
      weather:{title:'Weather near me',sub:'See current conditions and forecast',prompt:'What is the weather at my location now? Show a summary and a 5-day forecast.'},
      news:{title:'Latest news',sub:'Summarize current information',prompt:'Summarize today’s most important news and include sources.'},
      image:{title:'Create an image',sub:'Generate an image from a description',prompt:'Create a cinematic image of a futuristic 7 MIT city.'},
      chart:{title:'Create a chart',sub:'Turn data into a visual',prompt:'Create a simple chart comparing scores across four school subjects.'}
      ,map:{title:'Explore maps',sub:'Countries, provinces, and cities',prompt:'Show an interactive map of Indonesia with a marker on Jakarta, then explain its location.'}
      ,periodic:{title:'Periodic table',sub:'Explore every element',prompt:'Show an interactive periodic table and explain how to read it.'}
      ,visual3d:{title:'3D visual',sub:'Animals, atoms, and science',prompt:'Show a 3D visual of a carbon atom and explain its parts.'}
      ,quiz:{title:'Create a quiz',sub:'Answer interactive questions',prompt:'Create an interactive five-question multiple-choice quiz about grade 7 science.'}
    }
  }
};
let language = localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'id';
const t = key => key.split('.').reduce((value,part)=>value?.[part],I18N[language]) ?? key;

const ICONS = {
  'mic':'<path d="M12 19v3m-4 0h8M5 10v2a7 7 0 0 0 14 0v-2"/><rect x="9" y="2" width="6" height="14" rx="3"/>',
  'calculator':'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2m4 0h2m-8 4h2m4 0h2m-8 4h2m4 0h2"/>',
  'arrow-left-right':'<path d="m8 3-4 4 4 4M4 7h16m-4 6 4 4-4 4M20 17H4"/>',
  'clock':'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  'file-text':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/>',
  'maximize':'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  'grid-2x2':'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',

  'x':'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'plus':'<path d="M5 12h14"/><path d="M12 5v14"/>',
  'search':'<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  'message-square':'<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>',
  'ellipsis':'<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'panel-left':'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-15.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  'moon':'<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
  'trash-2':'<path d="M10 11v6M14 11v6M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  'arrow-up':'<path d="m5 12 7-7 7 7M12 19V5"/>',
  'sparkles':'<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
  'book-open':'<path d="M12 5v16"/><path d="M20.001 19A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2 5 5 0 0 1 4-2z"/>',
  'lightbulb':'<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/>',
  'pen-line':'<path d="M13 21h8"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  'circle-check':'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  'arrow-up-right':'<path d="M7 7h10v10M7 17 17 7"/>',
  'copy':'<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  'hard-drive':'<path d="M10 16h.01M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM21.946 12.013H2.054M6 16h.01"/>'
  ,'paperclip':'<path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/>'
  ,'file':'<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/>'
  ,'image':'<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'
  ,'settings':'<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>'
  ,'chevron-right':'<path d="m9 18 6-6-6-6"/>'
  ,'cloud-sun':'<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>'
  ,'cloud':'<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>'
  ,'cloud-rain':'<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m8 19-2 3M13 19l-2 3M18 19l-2 3"/>'
  ,'cloud-drizzle':'<path d="M17.5 17H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="M8 19v1M8 23v1M13 19v1M13 23v1M18 19v1M18 23v1"/>'
  ,'cloud-lightning':'<path d="M17.5 17H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m13 17-3 5h4l-2 4"/>'
  ,'cloud-fog':'<path d="M17.5 15H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="M5 19h14M7 23h10"/>'
  ,'snowflake':'<path d="M12 2v20M4.93 6.93l14.14 10.14M4.93 17.07 19.07 6.93M8 4l4 2 4-2M8 20l4-2 4 2M3 10l3.5 2L3 14M21 10l-3.5 2L21 14"/>'
  ,'newspaper':'<path d="M15 18h-5"/><path d="M18 14h-8"/><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="10" y="6" rx="1"/>'
  ,'chart-no-axes-column':'<path d="M5 21v-6M12 21V3M19 21V9"/>'
  ,'external-link':'<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
  ,'download':'<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>'
  ,'map':'<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.382V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15M9 3.236v15"/>'
  ,'flask-conical':'<path d="M14 2v6.5L20 19a2 2 0 0 1-1.7 3H5.7A2 2 0 0 1 4 19l6-10.5V2"/><path d="M8.5 2h7M7 16h10"/>'
  ,'box':'<path d="m21 8-9-5-9 5 9 5z"/><path d="m3 8 9 5 9-5v8l-9 5-9-5z"/><path d="M12 13v8"/>'
  ,'list-checks':'<path d="m3 6 2 2 3-3M12 6h9M3 13l2 2 3-3M12 13h9M3 20l2 2 3-3M12 20h9"/>'
  ,'rotate-3d':'<path d="M16.466 7.5C15.504 5.834 13.703 5 12 5c-2.013 0-3.927 1.084-4.933 3M5 5v4h4"/><path d="M7.534 16.5C8.496 18.166 10.297 19 12 19c2.013 0 3.927-1.084 4.933-3M19 19v-4h-4"/>'
};
ICONS.eye='<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>';
ICONS['volume-2']='<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>';
ICONS['volume-x']='<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6m0-6 6 6"/>';
function hydrateIcons(root=document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    const name=el.dataset.icon;if(!ICONS[name]||el.dataset.ready)return;
    el.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;el.dataset.ready='true';
  });
}

const $ = (selector) => document.querySelector(selector);
const els = {
  sidebar: $('#sidebar'), scrim: $('#sidebarScrim'), history: $('#historyList'), count: $('#historyCount'),
  search: $('#searchInput'), empty: $('#emptyState'), messages: $('#messages'), scroll: $('#chatScroll'),
  form: $('#chatForm'), input: $('#messageInput'), send: $('#sendButton'), title: $('#conversationTitle'),
  connection: $('.connection'), connectionLabel: $('#connectionLabel'), toast: $('#toast'),
  settings: $('#settingsDialog'), storageSummary: $('#storageSummary'), fileInput: $('#fileInput'),
  attach: $('#attachButton'), attachmentTray: $('#attachmentTray')
};

let session = readSession();
let profile = readProfile();
let isGuest = session?.guest === true || profile?.provider === 'guest';
let isOrganization = profile?.provider === 'akun.7mit';
let conversations = [];
let activeId = null;
let isSending = false;
let toastTimer;
let pendingAttachments = [];
let syncTimer;

function updateAIVersion(data) {
  const value = data?.ai_version;
  if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) {
    aiVersion = String(value).trim().slice(0, 80);
  }
  const label = $('#aiModelLabel strong');
  if (label) label.textContent = aiVersion
    ? (/^intelligence\.7mit(?:\s|$)/i.test(aiVersion) ? aiVersion : `intelligence.7mit ${aiVersion}`)
    : 'intelligence.7mit';
}
async function refreshAIVersion() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(API_URL, {cache:'no-store', signal:controller.signal});
    if (response.ok) updateAIVersion(await response.json());
  } catch { /* Keep chat available when version metadata is temporarily unavailable. */ }
  finally { clearTimeout(timeout); }
}

function applyLanguage() {
  document.documentElement.lang=language;
  $('#brandCaption').textContent=t('brandCaption');$('#newChatLabel').textContent=t('newChat');
  els.search.placeholder=t('search');$('#historyHeading').textContent=t('history');
  $('#settingsLabel').textContent=t('settings');$('#settingsCaption').textContent=isOrganization?'Organization Mode':isGuest?(language==='en'?'Guest · local data':'Tamu · data lokal'):t('settingsCaption');
  $('#emptyTitle').innerHTML=t('emptyTitle');$('#emptyCopy').textContent=t('emptyCopy');
  els.input.placeholder=t('placeholder');els.input.setAttribute('aria-label',t('inputLabel'));
  els.attach.setAttribute('aria-label',t('attach'));els.attach.title=t('attach');els.send.setAttribute('aria-label',t('send'));
  $('#privacyNote').textContent=isGuest?(language==='en'?'AI responses can be incorrect. Guest history stays only on this device.':'Jawaban AI dapat keliru. Histori tamu hanya tersimpan di perangkat ini.'):t('privacy');
  $('#aiModelLabel').firstChild.textContent=language==='en'?'Active AI ':'AI aktif ';
  updateAIVersion();
  $('#htmlPreviewTitle').textContent=t('previewTitle');$('#htmlPreviewCopy').textContent=language==='en'?'This preview runs in an isolated frame.':'Pratinjau ini berjalan di bingkai terpisah.';$('#closeHtmlPreview').setAttribute('aria-label',t('closePreview'));
  document.querySelectorAll('[data-suggestion]').forEach(button=>{const item=t(`suggestions.${button.dataset.suggestion}`);button.querySelector('strong').textContent=item.title;button.querySelector('small').textContent=item.sub;button.dataset.prompt=item.prompt;});
  if(!isSending)setConnection('',isOrganization?'Organization Mode · '+t('ready'):t('ready'));
}

function conversationUUID(){
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}
function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
function readSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY))||null}catch{return null}}
function readProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY))||null}catch{return null}}
async function ensureSession(){
  session=readSession();if(session?.guest){isGuest=true;return session;}if(!session?.access_token){location.replace('/auth/?next=/chat/');throw new Error('AUTH_REQUIRED');}
  if((session.expires_at||0)*1000>Date.now()+60000)return session;
  if(!session.refresh_token){location.replace('/auth/?next=/chat/');throw new Error('AUTH_REQUIRED');}
  const response=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
  const data=await response.json().catch(()=>null);if(!response.ok||!data?.access_token){localStorage.removeItem(SESSION_KEY);location.replace('/auth/?next=/chat/');throw new Error('AUTH_REQUIRED');}
  session=data;localStorage.setItem(SESSION_KEY,JSON.stringify(data));return session;
}
async function remoteFetch(path,options={}){
  const active=await ensureSession();if(active.guest)throw new Error('GUEST_LOCAL_ONLY');return fetch(SUPABASE_URL+'/rest/v1/'+path,{...options,headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+active.access_token,'Content-Type':'application/json',...(options.headers||{})}});
}
async function loadConversations(){
  if(isGuest){try{conversations=JSON.parse(localStorage.getItem(GUEST_HISTORY_KEY))||[];}catch{conversations=[];}activeId=conversations[0]?.id||null;return;}
  try{
    const response=await remoteFetch('intellegence_chat_history?select=id,title,messages,created_at,updated_at&order=updated_at.desc');
    if(!response.ok)throw new Error('SYNC_FAILED');const rows=await response.json();
    conversations=rows.map(row=>({id:row.id,title:row.title,createdAt:new Date(row.created_at).getTime(),updatedAt:new Date(row.updated_at).getTime(),messages:Array.isArray(row.messages)?row.messages:[]}));
    activeId=conversations[0]?.id||null;
  }catch(error){if(error.message!=='AUTH_REQUIRED')showToast(language==='en'?'Could not load account history':'Histori akun belum dapat dimuat');}
}
function saveConversations() {
  if(isGuest){try{localStorage.setItem(GUEST_HISTORY_KEY,JSON.stringify(conversations));}catch{showToast(t('storageFull'));}return;}
  clearTimeout(syncTimer);syncTimer=setTimeout(syncConversations,260);
}
async function syncConversations(){
  if(isGuest)return;
  if(!conversations.length)return;
  try{
    const active=await ensureSession(),userId=active.user?.id;if(!userId)return;
    const rows=conversations.map(c=>({id:c.id,user_id:userId,title:c.title,messages:c.messages,created_at:new Date(c.createdAt).toISOString(),updated_at:new Date(c.updatedAt).toISOString()}));
    const response=await remoteFetch('intellegence_chat_history?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
    if(!response.ok)throw new Error();
  }catch(error){if(error.message!=='AUTH_REQUIRED')showToast(language==='en'?'History sync failed':'Sinkronisasi histori gagal');}
}
function activeConversation() { return conversations.find(c => c.id === activeId); }
function createConversation() {
  const conversation = { id: conversationUUID(), title: t('newTitle'), createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  conversations.unshift(conversation); activeId = conversation.id; saveConversations(); render(); closeSidebar(); els.input.focus();
}
function formatDate(timestamp) {
  const d = new Date(timestamp), now = new Date();
  const locale=language==='en'?'en-US':'id-ID';
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(locale, {hour:'2-digit', minute:'2-digit'});
  const yesterday = new Date(now); yesterday.setDate(now.getDate()-1);
  if (d.toDateString() === yesterday.toDateString()) return t('yesterday');
  return d.toLocaleDateString(locale, {day:'numeric', month:'short'});
}
function renderHistory() {
  const query = els.search.value.trim().toLowerCase();
  const filtered = conversations.filter(c => c.title.toLowerCase().includes(query));
  els.count.textContent = `${conversations.length} ${t('chats')}`;
  els.history.innerHTML = filtered.length ? filtered.map(c => `
    <button class="history-item ${c.id === activeId ? 'active' : ''}" data-id="${c.id}">
      <i data-icon="message-square"></i>
      <span class="history-copy"><strong>${escapeHtml(c.title)}</strong><small>${formatDate(c.updatedAt)}</small></span>
    </button>`).join('') : `<div style="padding:18px 10px;color:var(--faint);font-size:12px;text-align:center">${query ? t('noSearch') : t('noHistory')}</div>`;
  hydrateIcons(els.history);
  els.history.querySelectorAll('.history-item').forEach(b => b.addEventListener('click', () => { activeId = b.dataset.id; render(); closeSidebar(); }));
}
function render() {
  if(activeSpeechButton)stopSpeech();
  renderHistory();
  const c = activeConversation();
  const hasMessages = c?.messages?.length;
  document.body.classList.toggle('has-conversation',!!hasMessages);
  els.empty.style.display = hasMessages ? 'none' : 'flex';
  els.messages.classList.toggle('active', !!hasMessages);
  els.title.textContent = c?.title || t('newTitle');
  els.messages.innerHTML = hasMessages ? c.messages.map(messageTemplate).join('') : '';
  bindCopyButtons(); bindMessageTools(); bindVisualInteractions(); hydrateIcons(els.messages);
  els.storageSummary.textContent = conversations.length ? `${conversations.length} ${t('stored')}` : t('emptyStored');
  requestAnimationFrame(() => { els.scroll.scrollTop = els.scroll.scrollHeight; });
}
function messageTemplate(message) {
  const isUser = message.role === 'user';
  const content = message.loading ? '<div class="typing"><i></i><i></i><i></i></div>' : renderText(message.content,isUser?null:message);
  const image = !isUser && message.image?.data ? `<figure class="generated-image"><img src="data:${safeImageMime(message.image.mime)};base64,${message.image.data}" alt="${escapeHtml(message.image.alt||'AI generated image')}"><figcaption><a download="intelligence-7mit.png" href="data:${safeImageMime(message.image.mime)};base64,${message.image.data}"><i data-icon="download"></i>${t('downloadImage')}</a></figcaption></figure>` : '';
  const weather = !isUser && message.weather ? weatherTemplate(message.weather) : '';
  const sources = !isUser && message.sources?.length ? `<section class="source-list"><strong>${t('sources')}</strong><div>${message.sources.slice(0,6).map(source=>`<a href="${safeUrl(source.url)}" target="_blank" rel="noopener"><span>${escapeHtml(source.title||source.url)}</span><i data-icon="external-link"></i></a>`).join('')}</div></section>` : '';
  const webImages = !isUser && message.webImages?.length ? webImageTemplate(message.webImages) : '';
  return `<article class="message ${isUser ? 'user' : 'assistant'}">
    <div class="avatar">${isUser ? 'K' : '<i data-icon="sparkles"></i>'}</div>
    <div class="message-body"><div class="message-meta"><strong>${isUser ? t('you') : 'intelligence.7mit'}</strong><span>${formatDate(message.timestamp)}</span></div>
      ${message.attachments?.length ? `<div class="message-file-list">${message.attachments.map(file=>`<span><i data-icon="${file.mime?.startsWith('image/')?'image':'file'}"></i><b>${escapeHtml(file.name)}</b><small>${formatBytes(file.size)}</small></span>`).join('')}</div>` : ''}
      <div class="message-content">${weather}${content}${webImages}${image}${sources}</div>
      ${!isUser && !message.loading ? `<div class="message-actions"><button class="read-aloud" data-message-id="${message.id}" type="button" aria-label="${t('listen')}"><i data-icon="volume-2"></i>${t('listen')}</button><button class="copy-message" data-message-id="${message.id}" type="button"><i data-icon="copy"></i>${t('copy')}</button></div>` : ''}
    </div></article>`;
}
function escapeHtml(text='') { const d=document.createElement('div'); d.textContent=String(text); return d.innerHTML; }
function safeUrl(value=''){try{const u=new URL(value);return u.protocol==='https:'?escapeHtml(u.href):'#';}catch{return '#';}}
function safeImageMime(value=''){return ['image/png','image/jpeg','image/webp'].includes(value)?value:'image/png';}
function weatherLabel(code){const map={0:['Cerah','Clear'],1:['Cerah berawan','Mostly clear'],2:['Berawan','Partly cloudy'],3:['Mendung','Overcast'],45:['Berkabut','Foggy'],48:['Berkabut','Foggy'],51:['Gerimis','Drizzle'],53:['Gerimis','Drizzle'],55:['Gerimis','Drizzle'],61:['Hujan ringan','Light rain'],63:['Hujan','Rain'],65:['Hujan lebat','Heavy rain'],71:['Salju ringan','Light snow'],73:['Salju','Snow'],75:['Salju lebat','Heavy snow'],80:['Hujan lokal','Rain showers'],81:['Hujan lokal','Rain showers'],82:['Hujan deras','Heavy showers'],95:['Badai petir','Thunderstorm']};return (map[code]||['Cuaca berubah','Variable weather'])[language==='en'?1:0];}
function weatherIcon(code){
  const value=Number(code);
  if(value>=200){if(value<300)return 'cloud-lightning';if(value<400)return 'cloud-drizzle';if(value<600)return 'cloud-rain';if(value<700)return 'snowflake';if(value<800)return 'cloud-fog';if(value===800)return 'sun';if(value===801)return 'cloud-sun';return 'cloud';}
  if(value===0)return 'sun';if(value<=2)return 'cloud-sun';if(value===3)return 'cloud';if([45,48].includes(value))return 'cloud-fog';if(value>=51&&value<=57)return 'cloud-drizzle';if((value>=61&&value<=67)||(value>=80&&value<=82))return 'cloud-rain';if((value>=71&&value<=77)||(value>=85&&value<=86))return 'snowflake';if(value>=95)return 'cloud-lightning';return 'cloud-sun';
}
function weatherTemplate(weather){
  const current=weather.current||{},daily=weather.daily||{};const days=(daily.time||[]).slice(0,5);
  const locale=language==='en'?'en-US':'id-ID';
  return `<section class="weather-card"><div class="weather-current"><div><span>${t('weatherNow')}${weather.location?' · '+escapeHtml(weather.location):''}</span><strong>${Math.round(current.temperature_2m??0)}°</strong><b>${escapeHtml(current.description||weatherLabel(current.weather_code))}</b></div><i data-icon="${weatherIcon(current.weather_code)}"></i></div><div class="weather-details"><span>${t('feelsLike')} <b>${Math.round(current.apparent_temperature??0)}°</b></span><span>${t('humidity')} <b>${Math.round(current.relative_humidity_2m??0)}%</b></span><span>${t('wind')} <b>${Math.round(current.wind_speed_10m??0)} km/h</b></span></div>${days.length?`<div class="forecast-title">${t('forecast')}</div><div class="forecast-row">${days.map((day,i)=>`<div><span>${new Date(`${day}T12:00:00`).toLocaleDateString(locale,{weekday:'short'})}</span><i data-icon="${weatherIcon(daily.weather_code?.[i])}"></i><b>${Math.round(daily.temperature_2m_max?.[i]??0)}°</b><small>${Math.round(daily.temperature_2m_min?.[i]??0)}°</small></div>`).join('')}</div>`:''}<div class="weather-provider">${escapeHtml(weather.provider||'OpenWeather + Open-Meteo')}</div></section>`;
}
function inlineMarkdown(value='') {
  const code=[]; let s=value.replace(/`([^`]+)`/g,(_,v)=>{code.push(`<code>${v}</code>`);return `%%CODE${code.length-1}%%`;});
  s=s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,'<figure class="inline-image"><img src="$2" alt="$1" loading="lazy"></figure>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_]+)__/g,'<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g,'<del>$1</del>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g,'$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g,'$1<em>$2</em>');
  code.forEach((v,i)=>{s=s.replace(`%%CODE${i}%%`,v);}); return s;
}
function renderText(text='',message=null) {
  let safe=escapeHtml(String(text).replace(/\r\n?/g,'\n'));
  const codeBlocks=[];
  safe=safe.replace(/```([^\n`]*)\n?([\s\S]*?)```/g,(_,lang,code)=>{const label=lang.trim().replace(/[^a-zA-Z0-9_+#.-]/g,'').toLowerCase(),clean=code.replace(/^\n|\n$/g,'');const index=codeBlocks.length;const visual=label==='quiz'&&message?renderQuiz(clean,message,index):label==='chart'?renderChart(clean):label==='map'?renderMap(clean):label==='periodic'?renderPeriodicTable(clean):label==='visual3d'?renderVisual3D(clean):null;const canPreview=['html','htm','xhtml'].includes(label);const toolbar=`<div class="code-toolbar"><button class="code-copy-button" type="button"><i data-icon="copy"></i>${t('copyCode')}</button>${canPreview?`<button class="code-preview-button" type="button"><i data-icon="eye"></i>${t('previewHtml')}</button>`:''}</div>`;codeBlocks.push(visual??`<div class="code-block" data-code-language="${label}">${label?`<div class="code-label"><span>${label}</span>${toolbar}</div>`:`<div class="code-label">${toolbar}</div>`}<pre><code>${clean}</code></pre></div>`);return `\n%%BLOCK${codeBlocks.length-1}%%\n`;});
  const lines=safe.split('\n'), out=[]; let i=0, paragraph=[];
  const flush=()=>{if(paragraph.length){out.push(`<p>${inlineMarkdown(paragraph.join('<br>'))}</p>`);paragraph=[];}};
  const isBlock=l=>/^\s*(#{1,6}\s+|[-*_]\s*[-*_]\s*[-*_]|&gt;\s?|[-+*]\s+|\d+[.)]\s+|%%BLOCK\d+%%)/.test(l);
  while(i<lines.length){const line=lines[i],trim=line.trim();
    if(!trim){flush();i++;continue;}
    const token=trim.match(/^%%BLOCK(\d+)%%$/);if(token){flush();out.push(codeBlocks[Number(token[1])]);i++;continue;}
    const heading=trim.match(/^(#{1,6})\s+(.+)$/);if(heading){flush();const level=heading[1].length;out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);i++;continue;}
    if(/^([-*_])(?:\s*\1){2,}\s*$/.test(trim)){flush();out.push('<hr>');i++;continue;}
    if(trim.startsWith('&gt;')){flush();const quote=[];while(i<lines.length&&lines[i].trim().startsWith('&gt;')){quote.push(lines[i].trim().replace(/^&gt;\s?/,''));i++;}out.push(`<blockquote>${inlineMarkdown(quote.join('<br>'))}</blockquote>`);continue;}
    if(i+1<lines.length&&line.includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){flush();const split=r=>r.trim().replace(/^\||\|$/g,'').split('|').map(v=>v.trim());const heads=split(line);i+=2;const rows=[];while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){rows.push(split(lines[i]));i++;}out.push(`<div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${inlineMarkdown(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${heads.map((_,n)=>`<td>${inlineMarkdown(row[n]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue;}
    const list=trim.match(/^([-+*]|\d+[.)])\s+(.+)$/);if(list){flush();const ordered=/\d/.test(list[1]),tag=ordered?'ol':'ul',items=[];while(i<lines.length){const m=lines[i].trim().match(/^([-+*]|\d+[.)])\s+(.+)$/);if(!m||(/\d/.test(m[1])!==ordered))break;let item=m[2],task='';const check=item.match(/^\[([ xX])\]\s+(.+)/);if(check){task=`<input type="checkbox" disabled ${check[1].toLowerCase()==='x'?'checked':''}>`;item=check[2];}items.push(`<li>${task}${inlineMarkdown(item)}</li>`);i++;}out.push(`<${tag}>${items.join('')}</${tag}>`);continue;}
    paragraph.push(trim);i++;
  }
  flush(); return out.join('');
}
function renderChart(encoded){
  try{
    const chart=JSON.parse(encoded.replace(/&quot;/g,'"').replace(/&amp;/g,'&'));const labels=Array.isArray(chart.labels)?chart.labels.slice(0,12):[];const values=Array.isArray(chart.values)?chart.values.slice(0,labels.length).map(Number):[];
    if(!labels.length||values.length!==labels.length||values.some(value=>!Number.isFinite(value)))throw new Error();
    const max=Math.max(...values,1),min=Math.min(...values,0),range=Math.max(max-min,1),unit=escapeHtml(chart.unit||''),initial=chart.type==='bar'?'bar':'line';
    const points=values.map((value,i)=>`${38+(i*(504/Math.max(1,values.length-1)))},${184-((value-min)/range)*132}`).join(' ');
    const line=`<svg viewBox="0 0 580 230" role="img" aria-label="${escapeHtml(chart.title||'Grafik data')}"><path class="chart-grid" d="M38 52H542M38 96H542M38 140H542M38 184H542"/><path class="chart-axis" d="M38 184H542"/><polyline class="chart-line" points="${points}"/>${values.map((value,i)=>{const x=38+(i*(504/Math.max(1,values.length-1))),y=184-((value-min)/range)*132;return `<g class="chart-point" tabindex="0" data-label="${escapeHtml(labels[i])}" data-value="${value}${unit}"><circle cx="${x}" cy="${y}" r="6"/><text class="chart-value" x="${x}" y="${Math.max(18,y-15)}">${value}${unit}</text><text class="axis-label" x="${x}" y="215">${escapeHtml(labels[i])}</text></g>`;}).join('')}</svg>`;
    const bars=`<div class="bar-chart">${values.map((value,i)=>{const height=Math.max(5,((value-min)/range)*100);return `<div class="bar-item" tabindex="0" data-label="${escapeHtml(labels[i])}" data-value="${value}${unit}"><span style="bottom:calc(${height}% + 9px)">${value}${unit}</span><div style="height:${height}%"></div><b>${escapeHtml(labels[i])}</b></div>`;}).join('')}</div>`;
    return `<figure class="visual-card visual-chart" data-chart-mode="${initial}"><figcaption><span><i data-icon="chart-no-axes-column"></i><b>${escapeHtml(chart.title||'Grafik interaktif')}</b></span><span class="visual-badge">Visual+</span></figcaption><div class="chart-toolbar" role="group" aria-label="Jenis grafik"><button type="button" data-chart-view="line" class="${initial==='line'?'active':''}">Garis</button><button type="button" data-chart-view="bar" class="${initial==='bar'?'active':''}">Batang</button></div><div class="chart-canvas"><div class="chart-view chart-line-view ${initial==='line'?'active':''}">${line}</div><div class="chart-view chart-bar-view ${initial==='bar'?'active':''}">${bars}</div><output class="chart-tooltip" aria-live="polite"></output></div>${chart.caption?`<p class="visual-caption">${escapeHtml(chart.caption)}</p>`:''}</figure>`;
  }catch{return `<div class="code-block"><div class="code-label">chart</div><pre><code>${encoded}</code></pre></div>`;}
}
function parseVisualJson(encoded){try{return JSON.parse(encoded.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&'));}catch{return {};}}
function normalizeQuiz(value){
  if(!value||!Array.isArray(value.questions)||!value.questions.length)return null;
  const questions=value.questions.slice(0,20).map(row=>{
    const options=Array.isArray(row?.options)?row.options.slice(0,6).map(item=>String(item).trim().slice(0,300)):[];
    const rawAnswer=row?.answer??row?.correct_index??row?.correctIndex,answer=Number(rawAnswer);
    if(rawAnswer==null||!String(row?.question||'').trim()||options.length<2||options.some(item=>!item)||!Number.isInteger(answer)||answer<0||answer>=options.length)return null;
    return {question:String(row.question).trim().slice(0,600),options,answer,explanation:String(row.explanation||'').trim().slice(0,900)};
  });
  return questions.some(row=>!row)?null:{title:String(value.title||'Kuis interaktif').slice(0,140),description:String(value.description||'').slice(0,300),questions};
}
function parseQuiz(encoded,escaped=false){try{const area=document.createElement('textarea');if(escaped)area.innerHTML=encoded;return normalizeQuiz(JSON.parse(escaped?area.value:encoded));}catch{return null;}}
function quizMarkup(quiz,message,index){
  const state=message.quizStates?.[index]||{current:0,answers:[],checked:[],finished:false};
  const current=Math.max(0,Math.min(quiz.questions.length-1,Number(state.current)||0)),q=quiz.questions[current],selected=state.answers?.[current],checked=state.checked?.[current]===true;
  const progress=state.finished?100:Math.round((current/quiz.questions.length)*100);
  const head=`<figcaption><span><i data-icon="list-checks"></i><b>${escapeHtml(quiz.title)}</b></span><span class="visual-badge">Visual+</span></figcaption>${quiz.description?`<p class="quiz-description">${escapeHtml(quiz.description)}</p>`:''}`;
  const body=state.finished?`<div class="quiz-finished" aria-live="polite"><span>${t('quizComplete')}</span><strong>${t('quizScore')}: ${(state.answers||[]).filter((answer,i)=>answer===quiz.questions[i].answer).length}/${quiz.questions.length}</strong><div class="quiz-review">${quiz.questions.map((item,i)=>`<div class="${state.answers?.[i]===item.answer?'correct':'incorrect'}"><b>${i+1}. ${escapeHtml(item.question)}</b><small>${t('quizAnswer')}: ${escapeHtml(item.options[item.answer])}</small></div>`).join('')}</div><button type="button" class="quiz-primary" data-quiz-action="retry">${t('quizRetry')}</button></div>`:`<div class="quiz-progress-label">${t('quizQuestion')} ${current+1} / ${quiz.questions.length}</div><div class="quiz-progress"><span style="width:${progress}%"></span></div><h3 class="quiz-question">${escapeHtml(q.question)}</h3><div class="quiz-options">${q.options.map((option,i)=>`<button type="button" data-quiz-action="select" data-option="${i}" aria-pressed="${selected===i}" class="${selected===i?'selected ':''}${checked&&i===q.answer?'correct ':''}${checked&&selected===i&&i!==q.answer?'incorrect':''}" ${checked?'disabled':''}><span>${String.fromCharCode(65+i)}</span><b>${escapeHtml(option)}</b></button>`).join('')}</div>${checked?`<div class="quiz-feedback ${selected===q.answer?'correct':'incorrect'}" aria-live="polite"><strong>${selected===q.answer?t('quizCorrect'):t('quizIncorrect')}</strong>${selected!==q.answer?`<p>${t('quizAnswer')}: ${escapeHtml(q.options[q.answer])}</p>`:''}${q.explanation?`<p>${escapeHtml(q.explanation)}</p>`:''}</div><button type="button" class="quiz-primary" data-quiz-action="next">${current+1===quiz.questions.length?t('quizResult'):t('quizNext')}</button>`:`<button type="button" class="quiz-primary" data-quiz-action="check" ${selected==null?'disabled':''}>${t('quizCheck')}</button>`}`;
  return `<figure class="visual-card quiz-card" data-message-id="${escapeHtml(message.id)}" data-quiz-block="${index}">${head}${body}</figure>`;
}
function renderQuiz(encoded,message,index){const quiz=parseQuiz(encoded,true);return quiz?quizMarkup(quiz,message,index):null;}
function ensureQuizBlock(answer){
  if(/```quiz\s*\n[\s\S]*?```/i.test(answer))return answer;
  const fenced=answer.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  if(fenced){const quiz=parseQuiz(fenced[1].trim());if(quiz)return answer.replace(fenced[0],`\`\`\`quiz\n${JSON.stringify(quiz)}\n\`\`\``);}
  const start=answer.indexOf('{'),end=answer.lastIndexOf('}');if(start>=0&&end>start){const quiz=parseQuiz(answer.slice(start,end+1));if(quiz)return answer.slice(0,start)+`\`\`\`quiz\n${JSON.stringify(quiz)}\n\`\`\``+answer.slice(end+1);}
  return answer;
}
function handleQuizClick(event){
  const button=event.target.closest('button[data-quiz-action]');if(!button||!els.messages.contains(button))return;
  const card=button.closest('.quiz-card'),message=activeConversation()?.messages.find(row=>row.id===card?.dataset.messageId),index=Number(card?.dataset.quizBlock);
  if(!message||!Number.isInteger(index))return;
  const blocks=[...String(message.content||'').matchAll(/```([^\n`]*)\n?([\s\S]*?)```/g)];if(blocks[index]?.[1]?.trim().toLowerCase()!=='quiz')return;
  const quiz=parseQuiz(blocks[index][2].trim());if(!quiz)return;
  message.quizStates ||= {};const state=message.quizStates[index] ||= {current:0,answers:[],checked:[],finished:false};const current=state.current||0;
  if(button.dataset.quizAction==='select'&&!state.checked[current])state.answers[current]=Number(button.dataset.option);
  else if(button.dataset.quizAction==='check'&&state.answers[current]!=null)state.checked[current]=true;
  else if(button.dataset.quizAction==='next'&&state.checked[current]){if(current+1<quiz.questions.length)state.current=current+1;else state.finished=true;}
  else if(button.dataset.quizAction==='retry')message.quizStates[index]={current:0,answers:[],checked:[],finished:false};
  card.outerHTML=quizMarkup(quiz,message,index);saveConversations();hydrateIcons(els.messages);
}
function renderMap(encoded){
  const map=parseVisualJson(encoded),center=Array.isArray(map.center)?map.center:[map.latitude,map.longitude];let lat=Number(center[0]),lon=Number(center[1]);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)){lat=0;lon=118;}
  lat=Math.max(-85,Math.min(85,lat));lon=Math.max(-180,Math.min(180,lon));
  const zoom=Math.max(1,Math.min(14,Number(map.zoom)||5));
  const lonSpan=360/Math.pow(2,zoom-1),latSpan=lonSpan*.55;
  const bbox=[Math.max(-180,lon-lonSpan),Math.max(-85,lat-latSpan),Math.min(180,lon+lonSpan),Math.min(85,lat+latSpan)].join(',');
  const embed='https://www.openstreetmap.org/export/embed.html?'+new URLSearchParams({bbox:bbox,layer:'mapnik',marker:lat+','+lon}).toString();
  const full='https://www.openstreetmap.org/?mlat='+encodeURIComponent(lat)+'&mlon='+encodeURIComponent(lon)+'#map='+zoom+'/'+encodeURIComponent(lat)+'/'+encodeURIComponent(lon);
  return '<figure class="visual-card visual-map"><figcaption><span><i data-icon="map"></i><b>'+escapeHtml(map.title||map.label||'Peta interaktif')+'</b></span><span class="visual-actions"><span class="visual-badge">Visual+</span><a href="'+escapeHtml(full)+'" target="_blank" rel="noopener">Buka lebih besar <i data-icon="external-link"></i></a></span></figcaption><iframe src="'+escapeHtml(embed)+'" loading="lazy" referrerpolicy="no-referrer" title="'+escapeHtml(map.title||'Peta interaktif')+'"></iframe><small>'+escapeHtml(map.caption||map.region||'Geser dan perbesar peta untuk menjelajahi wilayah.')+'</small></figure>';
}
function webImageTemplate(images){
  const cards=images.slice(0,6).map(function(item){const url=safeUrl(item.url||item.thumbnail),source=safeUrl(item.source_url||item.page_url||item.url);if(url==='#')return '';return '<a class="web-image-card" href="'+source+'" target="_blank" rel="noopener"><img src="'+url+'" alt="'+escapeHtml(item.title||'Gambar dari internet')+'" loading="lazy"><span><b>'+escapeHtml(item.title||'Gambar')+'</b><small>'+escapeHtml(item.source||item.credit||'Sumber gambar')+'</small></span></a>';}).join('');
  return cards?'<figure class="web-image-gallery"><figcaption><i data-icon="image"></i><b>Gambar dari internet</b></figcaption><div>'+cards+'</div></figure>':'';
}
const ELEMENT_SYMBOLS='H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
const ELEMENT_NAMES=(
  'Hidrogen Helium Litium Berilium Boron Karbon Nitrogen Oksigen Fluorin Neon Natrium Magnesium Aluminium Silikon Fosfor Belerang Klorin Argon Kalium Kalsium '+
  'Skandium Titanium Vanadium Kromium Mangan Besi Kobalt Nikel Tembaga Seng Galium Germanium Arsen Selenium Bromin Kripton Rubidium Stronsium Itrium Zirkonium '+
  'Niobium Molibdenum Teknesium Rutenium Rodium Paladium Perak Kadmium Indium Timah Antimon Telurium Iodin Xenon Sesium Barium Lantanum Serium Praseodimium Neodimium '+
  'Prometium Samarium Europium Gadolinium Terbium Disprosium Holmium Erbium Tulium Iterbium Lutetium Hafnium Tantalum Tungsten Renium Osmium Iridium Platina Emas Raksa '+
  'Talium Timbal Bismut Polonium Astatin Radon Fransium Radium Aktinium Torium Protaktinium Uranium Neptunium Plutonium Amerisium Kurium Berkelium Kalifornium Einsteinium '+
  'Fermium Mendelevium Nobelium Lawrensium Rutherfordium Dubnium Seaborgium Bohrium Hassium Meitnerium Darmstadtium Roentgenium Kopernisium Nihonium Flerovium Moskovium Livermorium Tenesin Oganeson'
).split(' ');
const PERIOD_ROWS=[
  ['H',,,,,,,,,,,,,,,,,,'He'],
  ['Li','Be',,,,,,,,,,,,'B','C','N','O','F','Ne'],
  ['Na','Mg',,,,,,,,,,,,'Al','Si','P','S','Cl','Ar'],
  ['K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr'],
  ['Rb','Sr','Y','Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','I','Xe'],
  ['Cs','Ba','57–71','Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg','Tl','Pb','Bi','Po','At','Rn'],
  ['Fr','Ra','89–103','Rf','Db','Sg','Bh','Hs','Mt','Ds','Rg','Cn','Nh','Fl','Mc','Lv','Ts','Og']
];
function elementCategory(number){
  if([2,10,18,36,54,86,118].includes(number))return ['noble','Gas mulia'];
  if([9,17,35,53,85,117].includes(number))return ['halogen','Halogen'];
  if([3,11,19,37,55,87].includes(number))return ['alkali','Logam alkali'];
  if([4,12,20,38,56,88].includes(number))return ['alkaline','Logam alkali tanah'];
  if([5,14,32,33,51,52,84].includes(number))return ['metalloid','Metaloid'];
  if([1,6,7,8,15,16,34].includes(number))return ['nonmetal','Nonlogam'];
  if(number>=57&&number<=71)return ['inner','Lantanida'];
  if(number>=89&&number<=103)return ['inner','Aktinida'];
  if((number>=21&&number<=30)||(number>=39&&number<=48)||(number>=72&&number<=80)||(number>=104&&number<=112))return ['transition','Logam transisi'];
  return ['main','Logam pascatransisi'];
}
function elementButton(symbol,row,col,highlight){
  if(!symbol)return '';if(symbol.includes('–'))return '<span class="element-placeholder" style="grid-row:'+(row+1)+';grid-column:'+(col+1)+'">'+symbol+'</span>';
  const number=ELEMENT_SYMBOLS.indexOf(symbol)+1,name=ELEMENT_NAMES[number-1]||symbol,category=elementCategory(number),period=row<7?row+1:(row===7?6:7),group=row<7?col+1:'—';
  return '<button type="button" class="periodic-element '+category[0]+(highlight.includes(symbol)?' highlighted':'')+'" style="grid-row:'+(row+1)+';grid-column:'+(col+1)+'" data-element="'+symbol+'" data-name="'+name+'" data-number="'+number+'" data-category="'+category[1]+'" data-period="'+period+'" data-group="'+group+'" aria-label="'+name+', simbol '+symbol+', nomor atom '+number+'"><small>'+number+'</small><b>'+symbol+'</b><em>'+name+'</em></button>';
}
function renderPeriodicTable(encoded){
  const data=parseVisualJson(encoded),highlight=Array.isArray(data.highlight)?data.highlight.map(String):[];
  const main=PERIOD_ROWS.map(function(row,rowIndex){return row.map(function(symbol,colIndex){return elementButton(symbol,rowIndex,colIndex,highlight);}).join('');}).join('');
  const lanthanides=ELEMENT_SYMBOLS.slice(56,71).map(function(symbol){return elementButton(symbol,7,ELEMENT_SYMBOLS.slice(56,71).indexOf(symbol)+2,highlight);}).join('');
  const actinides=ELEMENT_SYMBOLS.slice(88,103).map(function(symbol){return elementButton(symbol,8,ELEMENT_SYMBOLS.slice(88,103).indexOf(symbol)+2,highlight);}).join('');
  return '<figure class="visual-card periodic-card"><figcaption><span><i data-icon="flask-conical"></i><b>'+escapeHtml(data.title||'Tabel Periodik Unsur')+'</b></span><span class="visual-actions"><small>Klik unsur untuk melihat detail</small><span class="visual-badge">Visual+</span></span></figcaption><div class="periodic-legend"><span class="nonmetal">Nonlogam</span><span class="alkali">Alkali</span><span class="transition">Transisi</span><span class="metalloid">Metaloid</span><span class="halogen">Halogen</span><span class="noble">Gas mulia</span><span class="inner">Lantanida/Aktinida</span></div><div class="periodic-scroll"><div class="periodic-grid">'+main+lanthanides+actinides+'</div></div><div class="element-detail" aria-live="polite"><span>H</span><div><b>Hidrogen <small>(H)</small></b><p>Nomor atom <strong>1</strong> · Nonlogam</p><p>Periode <strong>1</strong> · Golongan <strong>1</strong></p></div></div></figure>';
}
function safeModelUrl(value){
  try{const url=new URL(value),hosts=['raw.githubusercontent.com','threejs.org','modelviewer.dev'];return url.protocol==='https:'&&hosts.some(function(host){return url.hostname===host||url.hostname.endsWith('.'+host);})?url.href:'';}catch{return '';}
}
function renderVisual3D(encoded){
  const data=parseVisualJson(encoded),subject=String(data.subject||data.type||'atom').toLowerCase(),title=escapeHtml(data.title||('Visual 3D '+subject));
  const presets={
    fox:'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb',
    rubah:'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb',
    duck:'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb',
    bebek:'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb',
    horse:'https://threejs.org/examples/models/gltf/Horse.glb',
    kuda:'https://threejs.org/examples/models/gltf/Horse.glb',
    parrot:'https://threejs.org/examples/models/gltf/Parrot.glb',
    burung:'https://threejs.org/examples/models/gltf/Parrot.glb',
    flamingo:'https://threejs.org/examples/models/gltf/Flamingo.glb',
    brain:'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BrainStem/glTF-Binary/BrainStem.glb',
    otak:'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BrainStem/glTF-Binary/BrainStem.glb'
  };
  const presetKey=Object.keys(presets).find(function(key){return subject.includes(key);}),model=safeModelUrl(data.model_url)||presets[presetKey||''];
  const electrons=Math.max(1,Math.min(20,Number(data.electrons||data.atomic_number)||6));
  const attributes=model?' data-model="'+escapeHtml(model)+'"':' data-electrons="'+electrons+'"';
  return '<figure class="visual-card model-card"><figcaption><span><i data-icon="box"></i><b>'+title+'</b></span><span class="visual-badge">3D</span></figcaption><div class="three-stage" data-three="'+(model?'model':'atom')+'"'+attributes+' role="img" aria-label="Model 3D interaktif"><p class="three-loading">Memuat visual 3D…</p></div><p class="three-caption">'+escapeHtml(data.caption||'Geser untuk memutar, gunakan gulir atau cubit untuk memperbesar. Diagram atom bersifat skematis, bukan orbit elektron sebenarnya.')+'</p></figure>';

}
function bindVisualInteractions(){
  document.querySelectorAll('.periodic-element').forEach(function(button){button.addEventListener('click',function(){const card=button.closest('.periodic-card'),detail=card.querySelector('.element-detail');card.querySelectorAll('.periodic-element').forEach(function(el){el.classList.toggle('selected',el===button);});detail.innerHTML='<span>'+escapeHtml(button.dataset.element)+'</span><div><b>'+escapeHtml(button.dataset.name)+' <small>('+escapeHtml(button.dataset.element)+')</small></b><p>Nomor atom <strong>'+escapeHtml(button.dataset.number)+'</strong> · '+escapeHtml(button.dataset.category)+'</p><p>Periode <strong>'+escapeHtml(button.dataset.period)+'</strong> · Golongan <strong>'+escapeHtml(button.dataset.group)+'</strong></p></div>';});});
  document.querySelectorAll('.atom-stage').forEach(function(stage){let dragging=false,startX=0,startY=0,rx=-16,ry=24;const draw=function(){stage.style.setProperty('--rx',rx+'deg');stage.style.setProperty('--ry',ry+'deg');};stage.addEventListener('pointerdown',function(e){dragging=true;startX=e.clientX;startY=e.clientY;stage.setPointerCapture(e.pointerId);});stage.addEventListener('pointermove',function(e){if(!dragging)return;ry+=(e.clientX-startX)*.45;rx-=(e.clientY-startY)*.35;startX=e.clientX;startY=e.clientY;draw();});stage.addEventListener('pointerup',function(){dragging=false;});draw();});
  document.querySelectorAll('.visual-chart').forEach(function(card){
    const show=function(mode){card.dataset.chartMode=mode;card.querySelectorAll('[data-chart-view]').forEach(function(button){button.classList.toggle('active',button.dataset.chartView===mode);button.setAttribute('aria-pressed',button.dataset.chartView===mode?'true':'false');});card.querySelector('.chart-line-view')?.classList.toggle('active',mode==='line');card.querySelector('.chart-bar-view')?.classList.toggle('active',mode==='bar');};
    card.querySelectorAll('[data-chart-view]').forEach(function(button){button.addEventListener('click',function(){show(button.dataset.chartView);});});
    const tooltip=card.querySelector('.chart-tooltip');card.querySelectorAll('[data-label][data-value]').forEach(function(point){const reveal=function(){tooltip.textContent=point.dataset.label+' · '+point.dataset.value;tooltip.classList.add('show');};point.addEventListener('mouseenter',reveal);point.addEventListener('focus',reveal);point.addEventListener('click',reveal);point.addEventListener('mouseleave',function(){tooltip.classList.remove('show');});point.addEventListener('blur',function(){tooltip.classList.remove('show');});});show(card.dataset.chartMode||'line');
  });
}
function bindCopyButtons() {
  document.querySelectorAll('.copy-message').forEach(button => button.addEventListener('click', async () => {
    const message = activeConversation()?.messages.find(m => m.id === button.dataset.messageId); if (!message) return;
    try { await navigator.clipboard.writeText(message.content); showToast(t('copied')); } catch { showToast(t('copyFail')); }
  }));
}
let activeSpeechButton=null,activeSpeechUtterance=null;
function resetSpeechButton(){if(!activeSpeechButton)return;activeSpeechButton.innerHTML=`<i data-icon="volume-2"></i>${t('listen')}`;activeSpeechButton.classList.remove('speaking');hydrateIcons(activeSpeechButton);activeSpeechButton=null;}
function copyText(text){const fallback=()=>new Promise((resolve,reject)=>{const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();try{document.execCommand('copy')?resolve():reject();}catch(error){reject(error);}finally{field.remove();}});return navigator.clipboard?.writeText?navigator.clipboard.writeText(text).catch(fallback):fallback();}
function openHtmlPreview(source){const dialog=$('#htmlPreviewDialog'),frame=$('#htmlPreviewFrame');const csp='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; font-src data:; media-src data: blob:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'">';frame.setAttribute('sandbox','allow-scripts');frame.srcdoc=/<head\b[^>]*>/i.test(source)?source.replace(/<head\b[^>]*>/i,head=>head+csp):`<!doctype html><html><head>${csp}<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${source}</body></html>`;if(!dialog.open)dialog.showModal();}
function stopSpeech(){if(activeSpeechUtterance){activeSpeechUtterance.onend=null;activeSpeechUtterance.onerror=null;window.speechSynthesis.cancel();activeSpeechUtterance=null;}resetSpeechButton();}
function bindMessageTools(){
  document.querySelectorAll('.code-copy-button').forEach(button=>button.addEventListener('click',async()=>{const code=button.closest('.code-block')?.querySelector('pre code')?.textContent||'';try{await copyText(code);showToast(t('copiedCode'));}catch{showToast(t('copyFail'));}}));
  document.querySelectorAll('.code-preview-button').forEach(button=>button.addEventListener('click',()=>openHtmlPreview(button.closest('.code-block')?.querySelector('pre code')?.textContent||'')));
  $('#closeHtmlPreview').onclick=()=>{$('#htmlPreviewFrame').srcdoc='';};
  document.querySelectorAll('.read-aloud').forEach(button=>button.addEventListener('click',()=>{
    if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance){showToast(t('speechUnavailable'));return;}
    if(activeSpeechButton===button){stopSpeech();return;}
    stopSpeech();const body=button.closest('.message-body')?.querySelector('.message-content')?.cloneNode(true);body?.querySelectorAll('.code-block,.message-actions').forEach(node=>node.remove());const speech=new SpeechSynthesisUtterance(body?.textContent?.trim()||'');speech.lang=language==='en'?'en-US':'id-ID';activeSpeechButton=button;activeSpeechUtterance=speech;button.innerHTML=`<i data-icon="volume-x"></i>${t('stopListening')}`;button.classList.add('speaking');hydrateIcons(button);speech.onend=()=>{if(activeSpeechUtterance===speech){activeSpeechUtterance=null;resetSpeechButton();}};speech.onerror=speech.onend;window.speechSynthesis.speak(speech);
  }));
  $('#htmlPreviewDialog').onclose=()=>{$('#htmlPreviewFrame').srcdoc='';};
}
function setConnection(state, text) { els.connection.className = `connection ${state || ''}`; els.connectionLabel.textContent = text; }
function showToast(text) { clearTimeout(toastTimer); els.toast.textContent=text; els.toast.classList.add('show'); toastTimer=setTimeout(()=>els.toast.classList.remove('show'),2200); }
function titleFrom(text) { return text.trim().replace(/\s+/g,' ').slice(0,46) || t('newTitle'); }
function extractAnswer(data) {
  if (typeof data === 'string') return data;
  const direct = data?.response ?? data?.answer ?? data?.text ?? data?.output ?? data?.message ?? data?.content ?? data?.result ?? data?.error;
  if (typeof direct === 'string') return direct;
  if (typeof direct?.content === 'string') return direct.content;
  const candidate = data?.candidates?.[0]?.content?.parts?.map(p=>p.text).filter(Boolean).join('\n');
  if (candidate) return candidate;
  return '';
}
function formatBytes(bytes=0){if(bytes<1024)return `${bytes} B`;if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1024/1024).toFixed(1)} MB`;}
function fileMime(file){
  if(file.type)return file.type.toLowerCase();
  const ext=file.name.split('.').pop()?.toLowerCase();
  return ({txt:'text/plain',md:'text/plain',csv:'text/csv',json:'application/json',html:'text/html',css:'text/css',js:'text/javascript',xml:'text/xml',rtf:'text/rtf',pdf:'application/pdf'})[ext]||'application/octet-stream';
}
function readAsData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=reject;reader.readAsDataURL(file);});}
async function addFiles(fileList){
  const files=Array.from(fileList||[]);if(!files.length)return;
  if(pendingAttachments.length+files.length>MAX_ATTACHMENTS){showToast(t('tooMany'));return;}
  const total=pendingAttachments.reduce((sum,file)=>sum+file.size,0)+files.reduce((sum,file)=>sum+file.size,0);
  if(total>MAX_ATTACHMENT_BYTES){showToast(t('tooLarge'));return;}
  els.form.classList.add('reading-files');els.attach.disabled=true;
  try{
    for(const file of files){
      const mime=fileMime(file),data=await readAsData(file);
      const isText=mime.startsWith('text/')||['application/json'].includes(mime);
      const textPreview=isText?(await file.text()).slice(0,120000):'';
      pendingAttachments.push({id:uid(),name:file.name.slice(0,240),mime,size:file.size,data,textPreview});
    }
    renderAttachmentTray();showToast(`${files.length} ${t('fileAdded').toLowerCase()}`);
  }catch{showToast(t('fileReadFail'));}
  finally{els.form.classList.remove('reading-files');els.attach.disabled=false;els.fileInput.value='';autoResize();}
}
function renderAttachmentTray(){
  els.attachmentTray.innerHTML=pendingAttachments.map(file=>`<div class="attachment-chip"><span class="attachment-file-icon"><i data-icon="${file.mime.startsWith('image/')?'image':'file'}"></i></span><span><strong>${escapeHtml(file.name)}</strong><small>${formatBytes(file.size)}</small></span><button type="button" data-remove-file="${file.id}" aria-label="${t('removeFile')}"><i data-icon="x"></i></button></div>`).join('');
  els.attachmentTray.classList.toggle('active',pendingAttachments.length>0);hydrateIcons(els.attachmentTray);
  els.attachmentTray.querySelectorAll('[data-remove-file]').forEach(button=>button.addEventListener('click',()=>{pendingAttachments=pendingAttachments.filter(file=>file.id!==button.dataset.removeFile);renderAttachmentTray();autoResize();}));
}
function isImageRequest(text=''){return /\b(buat(?:kan)?|hasilkan|generate|create|draw|gambar(?:kan)?)\b[\s\S]{0,45}\b(gambar|image|ilustrasi|illustration|poster|infografik|infographic)\b|\b(gambar|image|ilustrasi|poster|infografik)\b[\s\S]{0,35}\b(buat|generate|create)\b/i.test(text);}
function isWebImageRequest(text=''){return /\b(gambar|foto|image|photo)\b[\s\S]{0,45}\b(internet|web|asli|real|referensi|reference)\b|\b(cari|search|temukan|find|tampilkan|show)\b[\s\S]{0,35}\b(gambar|foto|image|photo)\b/i.test(text);}
function isMapRequest(text=''){return /\b(peta|map|atlas|lokasi negara|wilayah|province|provinsi|kabupaten|kota)\b/i.test(text);}
function isPeriodicRequest(text=''){return /\b(tabel periodik|periodic table|unsur kimia|chemical element)\b/i.test(text);}
function is3DRequest(text=''){return /\b(3d|tiga dimensi|model tiga dimensi|visual 3d|atom|molekul|molecule)\b/i.test(text);}
function isChartRequest(text=''){return /\b(grafik|diagram|chart|plot|visualisasi data|data visualization|tren|trend)\b/i.test(text);}
function isQuizRequest(text=''){return /\b(quiz|kuis|trivia)\b|latihan soal|pilihan ganda|tebak.tebakan|multiple.choice|practice questions|test me/i.test(text);}
function isWeatherRequest(text=''){return /\b(cuaca|weather|suhu|temperature|hujan|rain|prakiraan|forecast)\b/i.test(text);}
function needsLiveData(text=''){return /\b(terbaru|terkini|hari ini|sekarang|real[ -]?time|live|latest|current|today|now|berita|news|cuaca|weather|harga|price|skor|score|jadwal|schedule)\b/i.test(text);}
function getDeviceLocation(){return new Promise(resolve=>{if(localStorage.getItem(LOCATION_KEY)!=='true'||!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(position=>resolve({latitude:Number(position.coords.latitude.toFixed(6)),longitude:Number(position.coords.longitude.toFixed(6))}),()=>resolve(null),{enableHighAccuracy:false,maximumAge:300000,timeout:8000});});}
async function getWeather(location){
  if(!location)return null;
  const base={lat:String(location.latitude),lon:String(location.longitude),lang:language==='en'?'en':'id'};
  const meteoQuery=new URLSearchParams({latitude:location.latitude,longitude:location.longitude,current:'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',daily:'weather_code,temperature_2m_max,temperature_2m_min',timezone:'auto',forecast_days:'5'});
  const [currentResult,forecastResult,meteoResult]=await Promise.allSettled([
    fetch('/api/weather?'+new URLSearchParams({...base,type:'weather'})),
    fetch('/api/weather?'+new URLSearchParams({...base,type:'forecast'})),
    fetch('https://api.open-meteo.com/v1/forecast?'+meteoQuery)
  ]);
  const currentResponse=currentResult.status==='fulfilled'?currentResult.value:null,forecastResponse=forecastResult.status==='fulfilled'?forecastResult.value:null,meteoResponse=meteoResult.status==='fulfilled'?meteoResult.value:null;
  const meteo=meteoResponse?.ok?await meteoResponse.json().catch(()=>null):null;
  if(!currentResponse?.ok||!forecastResponse?.ok){if(meteo)return {...meteo,provider:'Open-Meteo'};return null;}
  const currentData=await currentResponse.json(),forecastData=await forecastResponse.json(),byDay=new Map();
  (forecastData.list||[]).forEach(function(item){const date=new Date(item.dt*1000),key=date.toISOString().slice(0,10),entry=byDay.get(key)||{time:key,max:-Infinity,min:Infinity,code:item.weather?.[0]?.id||800};entry.max=Math.max(entry.max,Number(item.main?.temp_max));entry.min=Math.min(entry.min,Number(item.main?.temp_min));if(date.getUTCHours()>=10&&date.getUTCHours()<=15)entry.code=item.weather?.[0]?.id||entry.code;byDay.set(key,entry);});
  const days=Array.from(byDay.values()).slice(0,5),condition=currentData.weather?.[0];
  return {provider:meteo?'OpenWeather + Open-Meteo':'OpenWeather',location:[currentData.name,currentData.sys?.country].filter(Boolean).join(', '),current:{temperature_2m:currentData.main?.temp,apparent_temperature:currentData.main?.feels_like,relative_humidity_2m:currentData.main?.humidity,wind_speed_10m:Number(currentData.wind?.speed||0)*3.6,weather_code:condition?.id,description:condition?.description},daily:{time:days.map(day=>day.time),temperature_2m_max:days.map(day=>day.max),temperature_2m_min:days.map(day=>day.min),weather_code:days.map(day=>day.code)},comparison:meteo?.current||null};
}
async function sendMessage(forcedText) {
  let text = (forcedText ?? els.input.value).trim(); if ((!text && !pendingAttachments.length) || isSending) return;
  if(window.openStudyFromPrompt?.(text))return;
  if(window.transformWorkspacePrompt)text=window.transformWorkspacePrompt(text);
  window.showChatWorkspace?.();
  const outgoingAttachments=pendingAttachments;
  if(!text)text=t('analyzeFiles');
  if (!activeConversation()) createConversation();
  const c = activeConversation();
  const userMessage = {id:uid(),role:'user',content:text,timestamp:Date.now(),attachments:outgoingAttachments.map(({name,mime,size})=>({name,mime,size}))};
  const loading = {id:uid(),role:'assistant',content:'',timestamp:Date.now(),loading:true};
  c.messages.push(userMessage,loading); if(c.messages.length===2)c.title=titleFrom(text); c.updatedAt=Date.now(); saveConversations();
  pendingAttachments=[];renderAttachmentTray();els.input.value=''; autoResize(); isSending=true; els.send.disabled=true; setConnection('busy',t('thinking')); render();
  const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),85000);
  try {
    const quizRequest=isQuizRequest(text),liveContext=needsLiveData(text),weatherRequest=isWeatherRequest(text),webImageRequest=isWebImageRequest(text),imageRequest=isImageRequest(text)&&!webImageRequest&&!quizRequest,mapRequest=isMapRequest(text),periodicRequest=isPeriodicRequest(text),visual3DRequest=is3DRequest(text),chartRequest=isChartRequest(text)&&!weatherRequest&&!quizRequest;
    const location=weatherRequest?await getDeviceLocation():null;
    const weather=weatherRequest&&location?await getWeather(location).catch(()=>null):null;
    if(weather){loading.weather=weather;render();}else if(weatherRequest&&!location){loading.content=t('locationOff');}
    const history=c.messages.filter(m=>!m.loading&&m.id!==userMessage.id).slice(-20).map(({role,content})=>({role,content}));
    const attachments=outgoingAttachments.map(({name,mime,size,data,textPreview})=>({name,mime,size,data,textPreview}));
    const active=await ensureSession();
    const visualInstruction=quizRequest?'\n\nBuat Visual+ kuis interaktif. Keluarkan tepat satu blok kode ```quiz berisi JSON valid dengan title, description, dan questions. Setiap soal harus memiliki question, options (2-5 pilihan), answer (indeks 0-based), explanation. Buat 3-8 soal kecuali pengguna meminta jumlah lain. Jangan tulis kunci jawaban di luar JSON.':chartRequest?'\n\nBuat Visual+ interaktif. Sertakan satu blok ```chart berisi JSON valid: {"type":"line" atau "bar","title":"judul jelas","labels":[...],"values":[angka...],"unit":"opsional","caption":"opsional"}. Jangan letakkan JSON grafik di blok kode lain.':'';
    const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(active.access_token||SUPABASE_KEY)},body:JSON.stringify({ai_version:aiVersion ?? undefined,message:text,prompt:text+visualInstruction+(window.studyAnswerInstruction?.()||''),history,messages:history,attachments,mode:imageRequest?'image':'chat',live_context:liveContext||webImageRequest||mapRequest,web_image_search:webImageRequest,visual_requests:{quiz:quizRequest,chart:chartRequest,map:mapRequest,periodic:periodicRequest,three_d:visual3DRequest},visual_plus:quizRequest||chartRequest||mapRequest||periodicRequest||visual3DRequest,organization_mode:isOrganization,account_context:isOrganization?{mode:'organization',organization:'7 MIT',role:profile?.role||'',account_type:profile?.account_type||''}:{mode:isGuest?'guest':'personal'},context:{location,weather}}),signal:controller.signal});
    const raw=await response.text(); let data; try{data=JSON.parse(raw);}catch{data=raw;}
    if(!response.ok)throw new Error(extractAnswer(data)||`HTTP ${response.status}`);
    updateAIVersion(data);
    const answer=extractAnswer(data); if(!answer&&!data?.image?.data)throw new Error(t('unreadable'));
    loading.content=quizRequest?ensureQuizBlock(answer||''):answer||'';window.receiveStudyCards?.(answer||'');if(periodicRequest&&!loading.content.includes('```periodic'))loading.content+='\n\n```periodic\n{"title":"Tabel Periodik Unsur"}\n```';if(visual3DRequest&&!loading.content.includes('```visual3d'))loading.content+='\n\n```visual3d\n'+JSON.stringify({title:'Visual 3D',subject:text,electrons:/karbon|carbon/i.test(text)?6:6})+'\n```';loading.image=data?.image||null;loading.webImages=Array.isArray(data?.web_images)?data.web_images:[];loading.sources=Array.isArray(data?.sources)?data.sources:[];loading.loading=false; setConnection('',isOrganization?'Organization Mode · '+t('ready'):t('ready'));
  } catch(error) {
    loading.loading=false; loading.content=error.name==='AbortError'?t('timeout'):`${t('unavailable')} ${error.message || t('checkConnection')}`;
    setConnection('error',t('connectionError'));
  } finally { clearTimeout(timeout); c.updatedAt=Date.now(); saveConversations(); isSending=false; els.send.disabled=!els.input.value.trim(); render(); }
}
function autoResize(){els.input.style.height='auto';els.input.style.height=`${Math.min(els.input.scrollHeight,170)}px`;els.send.disabled=isSending||(!els.input.value.trim()&&!pendingAttachments.length);}
function closeSidebar(){els.sidebar.classList.remove('open');$('#menuButton').setAttribute('aria-expanded','false');}
function openSidebar(){els.sidebar.classList.add('open');$('#menuButton').setAttribute('aria-expanded','true');}
async function deleteRemote(id){if(isGuest){try{localStorage.setItem(GUEST_HISTORY_KEY,JSON.stringify(conversations));}catch{}return;}try{await remoteFetch('intellegence_chat_history?id=eq.'+encodeURIComponent(id),{method:'DELETE'});}catch{}}
function deleteCurrent(){if(!activeId)return; const c=activeConversation(); if(c?.messages.length&&!confirm(t('deleteAsk')))return;const deletedId=activeId;conversations=conversations.filter(x=>x.id!==activeId);activeId=conversations[0]?.id||null;deleteRemote(deletedId);render();showToast(t('deleted'));}

els.form.addEventListener('submit',e=>{e.preventDefault();sendMessage();});
els.input.addEventListener('input',autoResize);
els.input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});
els.attach.addEventListener('click',()=>els.fileInput.click());
els.fileInput.addEventListener('change',()=>addFiles(els.fileInput.files));
['dragenter','dragover'].forEach(type=>els.form.addEventListener(type,e=>{e.preventDefault();els.form.classList.add('dragging');}));
['dragleave','drop'].forEach(type=>els.form.addEventListener(type,e=>{e.preventDefault();els.form.classList.remove('dragging');}));
els.form.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
$('#newChat').addEventListener('click',createConversation);
$('#menuButton').setAttribute('aria-expanded','false');
$('#menuButton').setAttribute('aria-controls','sidebar');
$('#menuButton').addEventListener('click',openSidebar);
$('#closeSidebar').addEventListener('click',closeSidebar); els.scrim.addEventListener('click',closeSidebar);
els.search.addEventListener('input',renderHistory);
$('#clearCurrent').addEventListener('click',deleteCurrent);
els.title.addEventListener('click',()=>{const c=activeConversation();if(!c)return;const title=prompt(t('rename'),c.title);if(title?.trim()){c.title=title.trim().slice(0,60);saveConversations();render();}});
$('#settingsButton').addEventListener('click',()=>{window.location.href='/chat/pengaturan/';});
$('#clearAllButton').addEventListener('click',async()=>{if(!conversations.length)return showToast('Belum ada riwayat');if(confirm(isGuest?'Hapus semua histori tamu dari perangkat ini?':'Hapus semua histori percakapan dari akun ini?')){conversations=[];activeId=null;if(isGuest)localStorage.removeItem(GUEST_HISTORY_KEY);else await remoteFetch('intellegence_chat_history?user_id=eq.'+encodeURIComponent(session.user.id),{method:'DELETE'}).catch(()=>{});els.settings.close();render();showToast('Semua histori dihapus');}});
$('#suggestionGrid').addEventListener('click',e=>{const button=e.target.closest('button[data-suggestion]');if(button)sendMessage(button.dataset.prompt);});
els.messages.addEventListener('click',handleQuizClick);
$('#themeToggle').addEventListener('click',()=>{document.body.classList.toggle('light');localStorage.setItem(THEME_KEY,document.body.classList.contains('light')?'light':'dark');});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();createConversation();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&els.sidebar.classList.contains('open'))closeSidebar();});
if(localStorage.getItem(THEME_KEY)==='light'||(!localStorage.getItem(THEME_KEY)&&matchMedia('(prefers-color-scheme: light)').matches))document.body.classList.add('light');
async function initialize(){if(!session?.access_token&&!session?.guest)return location.replace('/auth/?next=/chat/');hydrateIcons();applyLanguage();void refreshAIVersion();renderAttachmentTray();render();autoResize();const name=profile?.display_name||session.user?.user_metadata?.display_name||session.user?.email?.split('@')[0]||t('you');document.querySelector('.profile-orb').textContent=name.slice(0,1).toUpperCase();$('#settingsLabel').textContent=name;$('#settingsCaption').textContent=isOrganization?'Organization Mode':isGuest?(language==='en'?'Guest · local data':'Tamu · data lokal'):t('settingsCaption');await loadConversations();render();}
initialize();
