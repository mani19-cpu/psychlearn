// State
let currentLang = 'es';
let currentView = 'grid';
let currentCategory = 'all';
let searchQuery = '';
let expandedCard = null;

// Languages that need transliteration (non-Latin script)
const NEEDS_TRANSLIT = new Set([
  'ja', 'ko', 'zh', 'ar',          // original
  'ru', 'th', 'el', 'uk',          // batch 1-2
  'bn', 'ur', 'fa', 'pa',          // batch 3
  'kk', 'ps', 'mn', 'ne', 'bo', 'ks' // batch 4
]);

// Speech synthesis lang codes
const SPEECH_CODES = {
  en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE',
  ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', pt: 'pt-BR',
  it: 'it-IT', ar: 'ar-SA',
  // Batch 1
  ru: 'ru-RU', tr: 'tr-TR', nl: 'nl-NL', sv: 'sv-SE', pl: 'pl-PL',
  vi: 'vi-VN', id: 'id-ID', fi: 'fi-FI', no: 'nb-NO',
  // Batch 2
  th: 'th-TH', el: 'el-GR', hu: 'hu-HU', ro: 'ro-RO', uk: 'uk-UA',
  sw: 'sw-KE', so: 'so-SO', sq: 'sq-AL', ca: 'ca-ES',
  // Batch 3
  bn: 'bn-BD', ur: 'ur-PK', fa: 'fa-IR', ms: 'ms-MY', tl: 'tl-PH',
  la: 'la', uz: 'uz-UZ', pa: 'pa-IN', ku: 'ku',
  // Batch 4
  kk: 'kk-KZ', ps: 'ps-AF', mn: 'mn-MN', ne: 'ne-NP', wo: 'wo-SN',
  bo: 'bo', yo: 'yo-NG', xh: 'xh-ZA', haw: 'haw', ks: 'ks'
};

const SPEAKER_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

const SPEAKER_SM = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;

// Init
document.addEventListener('DOMContentLoaded', () => {
  renderLangDropdown();
  renderCategoryNav();
  renderContent();
  updateWordCount();
  setupListeners();
});

// ── Language Dropdown ──
function renderLangDropdown() {
  const langs = LANGUAGES.filter(l => l.code !== 'en');
  const current = langs.find(l => l.code === currentLang);

  document.getElementById('langBtnFlag').textContent = current.flag;
  document.getElementById('langBtnText').textContent = current.name;

  document.getElementById('langMenu').innerHTML = langs.map(l =>
    `<button class="lang-option ${l.code === currentLang ? 'active' : ''}" data-lang="${l.code}">
      <span class="opt-flag">${l.flag}</span>
      <span>${l.name}</span>
      <svg class="opt-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
    </button>`
  ).join('');
}

// ── Category Nav ──
function renderCategoryNav() {
  const nav = document.getElementById('categoryNav');
  const totalWords = CATEGORIES.reduce((sum, c) => sum + c.words.length, 0);
  nav.innerHTML = `<button class="cat-btn active" data-cat="all">All (${totalWords})</button>` +
    CATEGORIES.map(c =>
      `<button class="cat-btn" data-cat="${c.name}">${c.icon} ${c.name}</button>`
    ).join('');
}

// ── Render Content ──
function renderContent() {
  const main = document.getElementById('mainContent');
  const filtered = getFilteredCategories();

  if (filtered.length === 0) {
    main.innerHTML = `<div class="no-results"><h3>No words found</h3><p>Try a different search term</p></div>`;
    updateWordCount();
    return;
  }

  main.innerHTML = filtered.map(cat => `
    <div class="section" id="section-${cat.name.replace(/\s+/g, '-')}">
      <div class="section-header">
        <span class="section-icon">${cat.icon}</span>
        <span class="section-title">${cat.name}</span>
        <span class="section-count">${cat.filteredWords.length} words</span>
      </div>
      <div class="${currentView === 'grid' ? 'words-grid' : 'words-list'}">
        ${cat.filteredWords.map((w, i) => {
          const origIdx = cat.words.indexOf(w);
          return renderWord(w, `${cat.name}-${origIdx}`);
        }).join('')}
      </div>
    </div>
  `).join('');

  updateWordCount();
}

function getTranslit(englishWord, langCode) {
  if (!NEEDS_TRANSLIT.has(langCode)) return '';
  if (typeof TRANSLIT === 'undefined') return '';
  const key = englishWord.toLowerCase();
  const entry = TRANSLIT[key];
  if (!entry) return '';
  return entry[langCode] || '';
}

function renderWord(word, id) {
  const en = word.en;
  const trans = word[currentLang];
  const translit = getTranslit(en, currentLang);
  const escapedId = id.replace(/'/g, "\\'");

  if (currentView === 'grid') {
    return `
      <div class="word-card" data-id="${id}">
        <div class="word-top">
          <div class="word-text" onclick="toggleExpand(this.parentElement.parentElement, '${escapedId}')">
            <div class="english">${en}</div>
            <div class="translation">${trans}</div>
            ${translit ? `<div class="transliteration">${translit}</div>` : ''}
          </div>
          <button class="speak-btn" onclick="event.stopPropagation(); speak('${escapeForAttr(trans)}', '${currentLang}', this)" title="Listen">
            ${SPEAKER_SVG}
          </button>
        </div>
      </div>`;
  }

  return `
    <div class="word-row" data-id="${id}">
      <span class="english" onclick="toggleExpand(this.parentElement, '${escapedId}')">${en}</span>
      <span class="translation" onclick="toggleExpand(this.parentElement, '${escapedId}')">${trans}</span>
      ${translit ? `<span class="transliteration" onclick="toggleExpand(this.parentElement, '${escapedId}')">${translit}</span>` : ''}
      <button class="speak-btn" onclick="event.stopPropagation(); speak('${escapeForAttr(trans)}', '${currentLang}', this)" title="Listen">
        ${SPEAKER_SVG}
      </button>
    </div>`;
}

function escapeForAttr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ── Expand / Collapse ──
function toggleExpand(el, id) {
  if (expandedCard && expandedCard !== id) {
    const prev = document.querySelector(`[data-id="${expandedCard}"]`);
    if (prev) {
      prev.classList.remove('expanded');
      const existing = prev.querySelector('.all-translations');
      if (existing) existing.remove();
    }
  }

  if (el.classList.contains('expanded')) {
    el.classList.remove('expanded');
    const existing = el.querySelector('.all-translations');
    if (existing) existing.remove();
    expandedCard = null;
    return;
  }

  const word = findWordById(id);
  if (!word) return;

  el.classList.add('expanded');
  expandedCard = id;

  const allTrans = document.createElement('div');
  allTrans.className = 'all-translations';
  allTrans.innerHTML = LANGUAGES.map(l => {
    const w = word[l.code];
    const roman = getTranslit(word.en, l.code);
    const escapedW = escapeForAttr(w);
    return `
      <div class="trans-item">
        <span class="lang-flag">${l.flag}</span>
        <span class="lang-name">${l.name}</span>
        <span class="trans-word">${w}${roman ? ` <span class="trans-roman">(${roman})</span>` : ''}</span>
        <button class="trans-speak" onclick="event.stopPropagation(); speak('${escapedW}', '${l.code}', this)" title="Listen in ${l.name}">${SPEAKER_SM}</button>
      </div>`;
  }).join('');
  el.appendChild(allTrans);
}

function findWordById(id) {
  const match = id.match(/^(.+)-(\d+)$/);
  if (!match) return null;
  const catName = match[1];
  const index = parseInt(match[2]);
  const cat = CATEGORIES.find(c => c.name === catName);
  if (!cat) return null;
  return cat.words[index];
}

// ── Speech ──
let cachedVoices = [];
function loadVoices() {
  cachedVoices = window.speechSynthesis.getVoices();
}
if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function findVoice(langCode) {
  const tag = SPEECH_CODES[langCode] || langCode;
  const prefix = tag.split('-')[0].toLowerCase();
  // Exact match first, then prefix match
  return cachedVoices.find(v => v.lang.toLowerCase() === tag.toLowerCase())
      || cachedVoices.find(v => v.lang.toLowerCase().startsWith(prefix));
}

// Languages that rarely have native voices on Windows — always use Google TTS first
const PREFER_GOOGLE_TTS = new Set([
  'sq', 'sw', 'so', 'la', 'ku', 'kk', 'ps', 'mn', 'wo', 'bo',
  'yo', 'xh', 'haw', 'ks', 'uz', 'tl', 'ne', 'pa'
]);

function speak(text, langCode, btn) {
  let cleanText = text.replace(/\s*\(.*?\)\s*/g, ' ').trim();

  window.speechSynthesis.cancel();

  if (btn) btn.classList.add('speaking');
  const stopSpeaking = () => { if (btn) btn.classList.remove('speaking'); };

  // For languages without reliable native voices, go straight to Google TTS
  if (PREFER_GOOGLE_TTS.has(langCode)) {
    speakFallback(cleanText, langCode, btn);
    return;
  }

  const voice = findVoice(langCode);

  if (voice) {
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.voice = voice;
    utter.lang = voice.lang;
    utter.rate = 0.85;
    utter.onend = stopSpeaking;
    utter.onerror = () => { stopSpeaking(); speakFallback(cleanText, langCode, btn); };
    window.speechSynthesis.speak(utter);
  } else {
    speakFallback(cleanText, langCode, btn);
  }
}

function speakFallback(text, langCode, btn) {
  const tag = SPEECH_CODES[langCode] || langCode;
  const tl = tag.split('-')[0];
  const encoded = encodeURIComponent(text.substring(0, 200));

  if (btn) btn.classList.add('speaking');
  const stop = () => { if (btn) btn.classList.remove('speaking'); };

  // Try multiple TTS endpoints as fallbacks
  const urls = [
    `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${tl}&client=tw-ob`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${tl}&client=gtx`
  ];

  function tryUrl(i) {
    if (i >= urls.length) {
      // Last resort: force a native voice with just the language prefix
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = tag;
      utter.rate = 0.85;
      utter.onend = stop;
      utter.onerror = stop;
      window.speechSynthesis.speak(utter);
      return;
    }
    const audio = new Audio(urls[i]);
    audio.onended = stop;
    audio.onerror = () => tryUrl(i + 1);
    audio.play().catch(() => tryUrl(i + 1));
  }
  tryUrl(0);
}

// ── Filtering ──
function getFilteredCategories() {
  const cats = currentCategory === 'all' ? CATEGORIES : CATEGORIES.filter(c => c.name === currentCategory);
  const q = searchQuery.toLowerCase().trim();

  return cats.map(cat => {
    const filteredWords = q
      ? cat.words.filter(w => Object.values(w).some(v => v.toLowerCase().includes(q)))
      : cat.words;
    return { ...cat, filteredWords };
  }).filter(cat => cat.filteredWords.length > 0);
}

function updateWordCount() {
  const filtered = getFilteredCategories();
  const total = filtered.reduce((sum, c) => sum + c.filteredWords.length, 0);
  const allTotal = CATEGORIES.reduce((sum, c) => sum + c.words.length, 0);

  document.getElementById('wordBadge').textContent = `${total} words`;
  document.getElementById('wordCount').textContent =
    searchQuery || currentCategory !== 'all'
      ? `Showing ${total} of ${allTotal} words`
      : `${allTotal} words across ${LANGUAGES.length} languages`;
}

// ── Event Listeners ──
function setupListeners() {
  // Language dropdown toggle
  const dropdown = document.getElementById('langDropdown');
  document.getElementById('langBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  // Close dropdown on outside click
  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
  });

  document.getElementById('langMenu').addEventListener('click', (e) => {
    e.stopPropagation();
    const opt = e.target.closest('.lang-option');
    if (!opt) return;
    currentLang = opt.dataset.lang;
    expandedCard = null;
    dropdown.classList.remove('open');
    renderLangDropdown();
    renderContent();
  });

  // Category nav
  document.getElementById('categoryNav').addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    currentCategory = btn.dataset.cat;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    expandedCard = null;
    renderContent();
  });

  // Search
  document.getElementById('searchInput').addEventListener('input', e => {
    searchQuery = e.target.value;
    expandedCard = null;
    renderContent();
  });

  // View toggle
  document.getElementById('gridViewBtn').addEventListener('click', () => {
    currentView = 'grid';
    document.getElementById('gridViewBtn').classList.add('active');
    document.getElementById('listViewBtn').classList.remove('active');
    expandedCard = null;
    renderContent();
  });

  document.getElementById('listViewBtn').addEventListener('click', () => {
    currentView = 'list';
    document.getElementById('listViewBtn').classList.add('active');
    document.getElementById('gridViewBtn').classList.remove('active');
    expandedCard = null;
    renderContent();
  });
}
