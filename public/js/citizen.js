// Citizen Portal Client Logic (CivicAI)

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : 'https://civic-ai-mnw1.onrender.com';

let recognition = null;
let isRecording = false;
let userWantsRecording = false; // Flag to keep recording across speech gaps/pauses
let leafletMap = null;
let currentMarker = null;
let pendingPayload = null;

let cachedVoices = [];
let currentSpeechText = '';
let currentSpeechLang = 'te-IN';

function cleanLocationString(str) {
  if (!str) return '';
  const cleaned = str
    .replace(/à¤šà¤¿à¤¤à¥à¤¤à¥‚à¤°/g, 'Chittoor')
    .replace(/à¤•à¥à¤ªà¥à¤ªà¤®/g, 'Kuppam')
    .replace(/à¤ªà¥‡à¤¨à¥à¤®à¥‚à¤°à¥/g, 'Penumur')
    .replace(/à¤†à¤‚à¤§à¥à¤° à¤ªà¥à¤°à¤¦à¥‡à¤¶/g, 'Andhra Pradesh')
    .replace(/[\u0900-\u097F]/g, '')
    .trim();
  return cleaned;
}
// Note: Real LGD administrative location dataset (AP & TS) is authoritatively loaded via /js/locations.js and stored in window.locationData


const locationTranslations = {
  // States
  "Andhra Pradesh": { te: "ఆంధ్రప్రదేశ్", hi: "आंध्र प्रदेश", ta: "ஆந்திரப் பிரதேசம்", kn: "ಆಂಧ್ರಪ್ರದೇಶ", bn: "অন্ধ্রপ্রদেশ", mr: "आंध्र प्रदेश", gu: "આંધ્રપ્રદેશ", or: "ଆନ୍ଧ୍ର ପ୍ରଦେଶ", ml: "ആന്ധ്രാപ്രദേശ്", pa: "ਆਧਰਾ ਪ੍ਰਦੇਸ਼", as: "অন্ধ্ৰ প্ৰদেশ" },
  "Telangana": { te: "తెలంగాణ", hi: "तेलंगाना", ta: "தெலுங்கானா", kn: "ತೆಲಂಗಾಣ", bn: "তেলেঙ্গানা", mr: "तेलंगणा", gu: "તેલંગાણા", or: "ତେଲେଙ୍ଗାନା", ml: "തെലങ്കാന", pa: "ਤੇਲੰਗਾਨਾ", as: "তেলেংগানা" },
  "Karnataka": { te: "కర్ణాటక", hi: "कर्नाटक", ta: "கர்நாடகா", kn: "ಕರ್ನಾಟಕ", bn: "কর্ণাটক", mr: "कर्नाटक", gu: "કર્ણાટક", or: "କର୍ଣ୍ଣାଟକ", ml: "കർണാടക", pa: "ਕਰਨਾਟਕ", as: "কৰ্ণাটক" },
  "Tamil Nadu": { te: "తమిళనాడు", hi: "तमिलनाडु", ta: "தமிழ்நாடு", kn: "ತಮಿಳುನಾಡು", bn: "তামিলনাড়ু", mr: "तमिळनाडू", gu: "તમિલનાડુ", or: "ତାମିଲନାଡୁ", ml: "തമിഴ്‌നാട്", pa: "ਤਮਿਲਨਾਡੂ", as: "তামিলনাডু" },

  // Districts
  "Chittoor": { te: "చిత్తూరు", hi: "चित्तूर", ta: "சித்தூர்", kn: "ಚಿತ್ತೂರು", bn: "চিত্তুর", mr: "चित्तूर", gu: "ચિત્તૂર", or: "ଚିତ୍ତୋର", ml: "ചിറ്റൂർ", pa: "ਚਿੱਤੂਰ", as: "চিত্তুৰ" },
  "Tirupati": { te: "తిరుపతి", hi: "तिरुपति", ta: "திருப்பதி", kn: "ತಿರುಪತಿ", bn: "তিরুপতি", mr: "तिरुपती", gu: "તિરુપતિ", or: "ତିରୁପତି", ml: "തിരുപ്പതി", pa: "ਤਿਰੁਪਤੀ", as: "তিৰুপতি" },
  "Annamayya": { te: "అన్నమయ్య", hi: "अन्नमय्या", ta: "அன்னமய்யா", kn: "ಅನ್ನಮಯ್ಯ", bn: "অন্নময়্যা", mr: "अन्नमय्या", gu: "અન્નમય્યા", or: "ଅନ୍ନମୟା", ml: "അന്നമയ്യ", pa: "ਅੰਨਾਮੱਯਾ", as: "অন্নময়্যা" },
  "YSR Kadapa": { te: "వైఎస్సార్ కడప", hi: "कडपा", ta: "கடப்பா", kn: "ಕಡಪ", bn: "কাডাপা", mr: "कडप्पा", gu: "કડપા", or: "କଡ଼ପା", ml: "കടപ്പ", pa: "ਕੜਪਾ", as: "কদপা" },
  "Anantapur": { te: "అనంతపురం", hi: "अनंतपुर", ta: "அனந்தபூர்", kn: "ಅನಂತಪುರ", bn: "অনন্তপুর", mr: "अनंतपूर", gu: "અનંતપુર", or: "ଅନନ୍ତପୁର", ml: "അനന്തപൂർ", pa: "ਅਨੰਤਪੁਰ", as: "অনন্তপুৰ" },
  "Guntur": { te: "గుంటూరు", hi: "गुंटूर", ta: "குண்டூர்", kn: "ಗುಂಟೂರು", bn: "গুন্টুর", mr: "गुंटूर", gu: "ગુંટૂર", or: "ଗୁଣ୍ଟୁର", ml: "ഗുണ്ടൂർ", pa: "ਗੁੰਟੂਰ", as: "গুণ্টুৰ" },
  "Visakhapatnam": { te: "విశాఖపట్నం", hi: "विशाखापट्टनम", ta: "விசாகப்பட்டினம்", kn: "ವಿಶಾಖಪಟ್ಟಣಂ", bn: "বিশাখাপত্তনম", mr: "विशाखापट्टणम", gu: "વિશાખાપટ્ટનમ", or: "ବିଶାଖାପାଟଣା", ml: "വിശാഖപട്ടണം", pa: "ਵਿਸ਼ਾਖਾਪਟਨਮ", as: "বিশাখাপত্তনম" },
  "Hyderabad": { te: "హైదరాబాద్", hi: "हैदराबाद", ta: "ஹைதராபாத்", kn: "ಹೈದರಾಬಾದ್", bn: "হায়দ্রাবাদ", mr: "हैदराबाद", gu: "હૈદરાબાદ", or: "ହାଇଦ୍ରାବାଦ", ml: "ഹൈദരാബാദ്", pa: "ਹੈਦਰਾਬਾਦ", as: "হাইদৰাবাদ" },
  "Rangareddy": { te: "రంగారెడ్డి", hi: "रंगारेड्डी", ta: "ரங்காரெட்டி", kn: "ರಂಗಾರೆಡ್ಡಿ", bn: "রঙ্গারেড্ডি", mr: "रंगारेड्डी", gu: "રંગારેડ્ડી", or: "ରଙ୍ଗାରେଡ୍ଡୀ", ml: "രംഗറെഡ്ഡി", pa: "ਰੰਗਾਰੇੱਡੀ", as: "ৰংগাৰেড্ডী" },
  "Warangal": { te: "వరంగల్", hi: "वरंगल", ta: "வரங்கல்", kn: "ವರಂಗಲ್", bn: "ওয়ারাঙ্গাল", mr: "वरंगळ", gu: "વરંગલ", or: "ୱାରଙ୍ଗାଲ", ml: "വാറങ്കൽ", pa: "ਵਰੰਗਲ", as: "ৱাৰাংগাল" },
  "Bengaluru Urban": { te: "బెంగళూరు అర్బన్", hi: "बेंगलुरु शहरी", ta: "பெங்களூரு", kn: "ಬೆಂಗಳೂರು ನಗರ", bn: "বেঙ্গালুরু", mr: "बंगळुरू", gu: "બેંગલુરુ", or: "ବେଙ୍ଗାଲୁରୁ", ml: "ബാംഗ്ലൂർ", pa: "ਬੈਂਗਲੁਰੂ", as: "বেংগালুৰু" },

  // Mandals
  "Penumur": { te: "పెనుమూరు", hi: "पेनुमूर", ta: "பெனுமூர்", kn: "ಪೆನುಮೂರು", bn: "পেনুমুর", mr: "पेनुमूर", gu: "પેનુમૂર", or: "ପେନୁମୁର", ml: "പെനുമൂർ", pa: "ਪੇਨੂਮੂਰ", as: "পেনুমুৰ" },
  "Kuppam": { te: "కుప్పం", hi: "कुप्पम", ta: "குப்பம்", kn: "ಕುಪ್ಪಂ", bn: "কুপ্পম", mr: "कुप्पम", gu: "કુપ્પમ", or: "କୁପମ୍", ml: "കുപ്പം", pa: "ਕੁੱਪਮ", as: "কুপ্পম" },
  "Palamaner": { te: "పలమనేరు", hi: "पलमनेर", ta: "பலமனேர்", kn: "ಪಲಮನೇರು", bn: "পলামানের", mr: "पलमनेर", gu: "પાલમાનેર", or: "ପାଲାମାନେର", ml: "പലമനേർ", pa: "ਪਲਾਮਨੇਰ", as: "পলামানের" },
  "Bangarupalem": { te: "బంగారుపాళెం", hi: "बंजारुपालेम", ta: "பங்கருபாலையம்", kn: "ಬಂಗಾರುಪಾಳ್ಯಂ", bn: "বাঙ্গারুপালেম", mr: "बंजारुपालेम", gu: "બંગારુપાલેમ", or: "ବଙ୍ଗାରୁପାଲେମ୍", ml: "ബംഗാരുപാളയം", pa: "ਬੰਗਾਰੂਪਾਲੇਮ", as: "বাংগাৰুপালেম" },
  "Chittoor Urban": { te: "చిత్తూరు అర్బన్", hi: "चित्तूर शहरी", ta: "சித்தூர் நகர்ப்புறம்", kn: "ಚಿತ್ತೂರು ನಗರ", bn: "চিত্তুর আরবান", mr: "चित्तूर अर्बन", gu: "ચિત્તૂર અર્બન" },
  "Chittoor Rural": { te: "చిత్తూరు రూరల్", hi: "चित्तूर ग्रामीण", ta: "சித்தூர் கிராமப்புறம்", kn: "ಚಿತ್ತೂರು ಗ್ರಾಮೀಣ", bn: "চিত্তুর রুরাল", mr: "चित्तूर रुरल", gu: "ચિત્તૂર રૂરલ" },
  "Gangadhara Nellore": { te: "గంగాధర నెల్లూరు", hi: "गंगाधर नेल्लोर", ta: "கங்காதர நெல்லூர்", kn: "ಗಂಗಾಧರ ನೆಲ್ಲೂರು", bn: "গঙ্গাধরা নেল্লোর" },
  "Nagari": { te: "నగరి", hi: "नगरी", ta: "நகரி", kn: "ನಗರಿ", bn: "নাগরি", mr: "नगरी", gu: "નગરી" },
  "Karvetinagar": { te: "కార్వేటినగరం", hi: "कार्वेटीनगर", ta: "கார்வேட்டிநகரம்", kn: "ಕಾರ್ವೇಟಿನಗರ", bn: "কারভেটিনগর" },
  "Tirupati Urban": { te: "తిరుపతి అర్బన్", hi: "तिरुपति शहरी", ta: "திருப்பதி நகர்ப்புறம்", kn: "ತಿರುಪತಿ ನಗರ", bn: "তিরুপতি আরবান" },
  "Tirupati Rural": { te: "తిరుపతి రూరల్", hi: "तिरुपति ग्रामीण", ta: "திருப்பதி கிராமப்புறம்", kn: "ತಿರುಪತಿ ಗ್ರಾಮೀಣ", bn: "তিরুপতি রুরাল" },
  "Chandragiri": { te: "చంద్రగిరి", hi: "चंद्रगिरि", ta: "சந்திரகிரி", kn: "ಚಂದ್ರಗಿರಿ", bn: "চন্দ্রগিরি", mr: "चंद्रगिरी", gu: "ચંદ્રગિરી" },
  "Renigunta": { te: "రేణిగుంట", hi: "रेणिगुंटा", ta: "ரேணிகுண்டா", kn: "ರೇಣಿಗುಂಟ", bn: "রেণিগুণ্টা", mr: "रेणिगुंटा", gu: "રેણિગુન્ટા" },
  "Sri Kalahasti": { te: "శ్రీకాళహస్తి", hi: "श्रीकालहस्ती", ta: "ஸ்ரீ காளஹஸ்தி", kn: "శ్రీకాళహస్తి", bn: "শ্রীকালহস্তী" },
  "Puttur": { te: "పుత్తూరు", hi: "पुत्तूर", ta: "புத்தூர்", kn: "ಪುತ್ತೂರು", bn: "পুত্তুর", mr: "पुत्तूर", gu: "પુત્તૂર" },
  "Madanapalle": { te: "మదనపల్లె", hi: "मदनपल्ले", ta: "மதனபல்லி", kn: "ಮದನಪಲ್ಲೆ", bn: " মদনাপল্লে", mr: "मदनपल्ले", gu: "મદનાપલ્લે" },

  // Villages
  "Sanjiviravanipalle": { te: "సంజీవిరాయనిపల్లె", hi: "संजीवरायानिपल्ले", bn: "সঞ্জীব রায়ানি পল্লে", ta: "சஞ்சீவிராயனிபள்ளி", kn: "ಸಂಜೀವರಾಯನಿಪಲ್ಲಿ" },
  "Virupakshapuram": { te: "విరూపాక్షపురం", hi: "विरुपाक्षापुरम", bn: "বিরূপাক্ষপুরম", ta: "விருபாக்ஷபுரம்", kn: "ವಿರೂಪಾಕ್ಷಪುರಂ" },
  "Kalavagunta": { te: "కలవగుంట", hi: "कलवगुंटा", bn: "কালবগুণ্টা", ta: "கலவகுண்டா", kn: "കലവഗുന്റ" },
  "Kondepalle": { te: "కొండెలపల్లె", hi: "कोंडेपल्ले", bn: "কোন্ডেপল্লে", ta: "கொண்டேபள்ளி", kn: "ಕೊಂಡೇಪಲ್ಲಿ" },
  "Gullapalle": { te: "గుల్లాపల్లె", hi: "गुल्लापल्ले", bn: "গুল্লাপল্লে", ta: "குல்லாபள்ளி", kn: "ಗುಲ್ಲಾಪಲ್ಲಿ" },
  "Nelavoy": { te: "నేలవోయ్", hi: "नेलवॉय", bn: "নেলভয়", ta: "நெலவோய்", kn: "ನೆಲವೋಯ್" },
  "Kangundi": { te: "కంగాంధి", hi: "कांगुंडी", bn: "কাঙ্গুন্ডি", ta: "காங்குண்டி", kn: "ಕಾಂಗುಂಡಿ" },
  "Rallabuduguru": { te: "రాళ్లబూదుగూరు", hi: "राल्लाबुदुगुरु", bn: "রাল্লাবুদুগুরু", ta: "ராள்ளபுதுகுரு", kn: "ರಾಳ್ಳಬುಡುಗುರು" }
};

function getLocalizedLocationName(name) {
  if (!name) return '';
  const bcp47 = localStorage.getItem('civic_user_bcp47') || currentSpeechLang || 'en-IN';
  const langCode = bcp47.split('-')[0].toLowerCase();
  
  if (langCode === 'en') return name;

  const item = locationTranslations[name];
  if (item && item[langCode]) {
    return `${item[langCode]} (${name})`;
  }
  return name;
}

function repopulateLocationDropdownsInSelectedLanguage() {
  const stateSel = document.getElementById('stateSelect');
  const distSel = document.getElementById('districtSelect');
  const mandalSel = document.getElementById('mandalSelect');
  const villSel = document.getElementById('villageSelect');

  if (stateSel) {
    Array.from(stateSel.options).forEach(opt => {
      if (opt.value) opt.textContent = getLocalizedLocationName(opt.value);
    });
  }
  if (distSel) {
    Array.from(distSel.options).forEach(opt => {
      if (opt.value) opt.textContent = getLocalizedLocationName(opt.value);
    });
  }
  if (mandalSel) {
    Array.from(mandalSel.options).forEach(opt => {
      if (opt.value) opt.textContent = getLocalizedLocationName(opt.value);
    });
  }
  if (villSel) {
    Array.from(villSel.options).forEach(opt => {
      if (opt.value) opt.textContent = getLocalizedLocationName(opt.value);
    });
  }
}

// Note: Cascading location handlers (initCascadingLocations, onStateChanged, onDistrictChanged, onMandalChanged, onVillageChanged) are authoritatively provided by /js/locations.js


async function geocodeLocationAndLocateMap() {
  const state = document.getElementById('stateSelect')?.value || '';
  const district = document.getElementById('districtSelect')?.value || '';
  const mandal = document.getElementById('mandalSelect')?.value || '';
  const village = document.getElementById('villageSelect')?.value || '';

  if (!state && !district && !mandal && !village) return;

  const parts = [village, mandal, district, state, 'India'].filter(Boolean);
  const queryStr = parts.join(', ');

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}`);
    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      document.getElementById('latInput').value = lat;
      document.getElementById('lonInput').value = lon;
      renderMapPreview(lat, lon);
      const statusText = document.getElementById('gpsStatusText');
      if (statusText) statusText.textContent = `Map Auto-Located: ${queryStr}`;
    }
  } catch (err) {
    console.warn('Map geocoding search failed:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  initCascadingLocations();
  initSplashScreen();
  initSpeechRecognition();
  detectGPSLocation();
  preloadVoices();
});

// 1. Splash Screen Auto-Advance to Full-Screen Language Selection Screen
function initSplashScreen() {
  const splash = document.getElementById('splashScreen');
  const langOverlay = document.getElementById('langScreenOverlay');
  const savedLang = localStorage.getItem('civic_user_language');
  const savedBcp47 = localStorage.getItem('civic_user_bcp47');

  if (savedBcp47) {
    currentSpeechLang = savedBcp47;
  }

  if (savedLang && typeof changeLanguage === 'function') {
    changeLanguage(savedLang);
  }

  if (splash) {
    if ('speechSynthesis' in window) {
      const welcomeUtterance = new SpeechSynthesisUtterance("Welcome to CivicAI - Smart Multilingual Public Grievance Resolution Platform");
      welcomeUtterance.rate = 1.0;
      welcomeUtterance.pitch = 1.1;
      const femaleVoice = getIndianFemaleVoice('en-IN');
      if (femaleVoice) welcomeUtterance.voice = femaleVoice;
      window.speechSynthesis.speak(welcomeUtterance);
    }

    setTimeout(() => {
      splash.style.opacity = '0';
      setTimeout(() => {
        splash.classList.add('hidden');
        // Show Full Screen Language Selection Overlay right after Splash Screen
        if (langOverlay) {
          langOverlay.classList.remove('hidden');
          langOverlay.style.opacity = '1';
        }
      }, 700);
    }, 2200);
  }
}

function selectPortalLanguage(langCode, bcp47, langName) {
  currentSpeechLang = bcp47 || 'te-IN';
  localStorage.setItem('civic_user_language', langCode);
  localStorage.setItem('civic_user_bcp47', currentSpeechLang);

  if (typeof changeLanguage === 'function') {
    changeLanguage(langCode);
  }

  repopulateLocationDropdownsInSelectedLanguage();

  const langOverlay = document.getElementById('langScreenOverlay');
  if (langOverlay) {
    langOverlay.style.opacity = '0';
    setTimeout(() => {
      langOverlay.classList.add('hidden');
    }, 600);
  }
}

// 2. Preload Browser Voices
function preloadVoices() {
  if ('speechSynthesis' in window) {
    cachedVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
    };
  }
}

function getIndianFemaleVoice(langCode) {
  if (!cachedVoices || cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  
  const searchLang = langCode ? langCode.toLowerCase() : 'te-in';
  const targetPrefix = searchLang.split('-')[0];

  let selected = cachedVoices.find(v => {
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();
    const isLangMatch = lang.includes(searchLang) || lang.includes(targetPrefix);
    const isFemaleKey = name.includes('female') || name.includes('heera') || name.includes('swara') || name.includes('sunita') || name.includes('shruti') || name.includes('zira') || name.includes('natural');
    return isLangMatch && isFemaleKey;
  });

  if (!selected) {
    selected = cachedVoices.find(v => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      return lang.includes('in') && (name.includes('female') || name.includes('heera') || name.includes('swara') || name.includes('google') || name.includes('microsoft'));
    });
  }

  if (!selected) {
    selected = cachedVoices.find(v => v.lang.toLowerCase().includes(targetPrefix));
  }

  if (!selected) {
    selected = cachedVoices.find(v => v.lang.toLowerCase().includes('in'));
  }

  return selected || null;
}

function speakTextWithFemaleVoice(speechText, bcp47Code) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(speechText);
  utterance.lang = bcp47Code || 'te-IN';
  utterance.rate = 1.0;
  utterance.pitch = 1.1;

  const femaleVoice = getIndianFemaleVoice(bcp47Code);
  if (femaleVoice) {
    utterance.voice = femaleVoice;
  }

  window.speechSynthesis.speak(utterance);
}

let accumulatedSpeechText = '';

function cleanDuplicateWords(text) {
  if (!text) return '';
  // Remove consecutive repeated words & repeated phrases
  let cleaned = text.replace(/(\b\w+\b)(?:\s+\1)+/gi, '$1');
  
  // Advanced multilingual token deduplication (for Hindi/Telugu/Tamil Unicode scripts)
  const words = cleaned.trim().split(/\s+/);
  const result = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].trim();
    if (!w) continue;
    if (i === 0 || w !== words[i - 1]) {
      result.push(w);
    }
  }
  return result.join(' ');
}

// 3. Continuous Web Speech API (Mobile Android & Desktop Optimized)
function initSpeechRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    document.getElementById('recordingStatus').textContent = 'Voice input not supported in this browser. Please type text below.';
    return;
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  recognition = new SpeechRec();
  recognition.lang = localStorage.getItem('civic_user_bcp47') || currentSpeechLang || 'te-IN';

  if (isMobile) {
    // Mobile Android Chrome speech engine fix: disable interim results to eliminate OS duplicate results
    recognition.continuous = false;
    recognition.interimResults = false;
  } else {
    recognition.continuous = true;
    recognition.interimResults = true;
  }

  recognition.onstart = () => {
    isRecording = true;
    document.getElementById('micBtn').classList.add('pulse-mic');
    document.getElementById('micIcon').className = 'fa-solid fa-square text-rose-600';
    document.getElementById('recordingStatus').textContent = 'Recording Active... Speak now. Tap mic to finish.';
    document.getElementById('recordingStatus').classList.add('text-rose-600');
  };

  recognition.onresult = (event) => {
    const textarea = document.getElementById('originalNote');

    if (isMobile) {
      // Mobile logic: Append only final clean speech chunks
      let newSpeech = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        newSpeech += event.results[i][0].transcript + ' ';
      }
      if (newSpeech.trim()) {
        const currentVal = textarea.value.trim();
        const combined = currentVal ? (currentVal + ' ' + newSpeech.trim()) : newSpeech.trim();
        textarea.value = cleanDuplicateWords(combined);
      }
    } else {
      // Desktop logic: Stream continuous results
      let currentSessionText = '';
      for (let i = 0; i < event.results.length; i++) {
        currentSessionText += event.results[i][0].transcript + ' ';
      }
      const fullRaw = (accumulatedSpeechText ? accumulatedSpeechText + ' ' : '') + currentSessionText;
      textarea.value = cleanDuplicateWords(fullRaw);
    }
  };

  recognition.onerror = (event) => {
    console.warn('Speech Recognition notice:', event.error);
    if (userWantsRecording && (event.error === 'no-speech' || event.error === 'network')) {
      setTimeout(() => {
        if (userWantsRecording) {
          try { recognition.start(); } catch (e) {}
        }
      }, 300);
    } else {
      stopRecordingUI();
    }
  };

  recognition.onend = () => {
    const textarea = document.getElementById('originalNote');
    if (textarea) accumulatedSpeechText = textarea.value.trim();

    if (userWantsRecording) {
      setTimeout(() => {
        if (userWantsRecording) {
          try { recognition.start(); } catch (e) {}
        }
      }, 200);
    } else {
      stopRecordingUI();
    }
  };
}

function toggleVoiceRecording() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    alert('Speech Recognition is not supported by your browser. Please type your grievance.');
    return;
  }

  if (isRecording || userWantsRecording) {
    userWantsRecording = false;
    isRecording = false;
    accumulatedSpeechText = '';
    if (recognition) {
      try { recognition.stop(); } catch(e){}
    }
    stopRecordingUI();
  } else {
    if (recognition) {
      try { recognition.stop(); } catch(e){}
    }
    accumulatedSpeechText = document.getElementById('originalNote').value.trim();
    initSpeechRecognition();
    userWantsRecording = true;
    try {
      recognition.lang = localStorage.getItem('civic_user_bcp47') || currentSpeechLang || 'te-IN';
      recognition.start();
    } catch (e) {
      console.warn('Recognition start exception, retrying:', e);
      setTimeout(() => {
        try { recognition.start(); } catch(err){}
      }, 200);
    }
  }
}

function stopRecordingUI() {
  isRecording = false;
  userWantsRecording = false;
  accumulatedSpeechText = '';
  const micBtn = document.getElementById('micBtn');
  if (micBtn) micBtn.classList.remove('pulse-mic');
  document.getElementById('micIcon').className = 'fa-solid fa-microphone text-teal-800';
  document.getElementById('recordingStatus').textContent = 'Tap Mic to Record Voice';
  document.getElementById('recordingStatus').classList.remove('text-rose-600');
}

// 4. Geolocation & Reverse Geocoding
function detectGPSLocation() {
  const statusText = document.getElementById('gpsStatusText');
  const spinner = document.getElementById('gpsSpinner');

  if (!navigator.geolocation) {
    statusText.textContent = 'Geolocation is not supported by your browser. Please enter village & mandal manually.';
    if (spinner) spinner.classList.add('hidden');
    return;
  }

  statusText.textContent = 'Fetching precise GPS coordinates...';
  if (spinner) spinner.classList.remove('hidden');

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      document.getElementById('latInput').value = lat;
      document.getElementById('lonInput').value = lon;

      statusText.textContent = `GPS Captured: ${lat.toFixed(4)}, ${lon.toFixed(4)}. Reverse geocoding village...`;

      renderMapPreview(lat, lon);

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const data = await res.json();
        
        if (data && data.address) {
          const addr = data.address;
          let rawVillage = addr.village || addr.suburb || addr.town || addr.hamlet || addr.county || 'Sanjiviravanipalle';
          let rawMandal = addr.state_district || addr.county || addr.city_district || addr.town || 'Chittoor';

          const village = cleanLocationString(rawVillage) || 'Sanjiviravanipalle';
          const mandal = cleanLocationString(rawMandal) || 'Chittoor';

          document.getElementById('villageInput').value = village;
          document.getElementById('mandalInput').value = mandal;
          statusText.textContent = `Location Resolved: ${village}, ${mandal}`;
        } else {
          statusText.textContent = 'Address resolved via default coordinates.';
        }
      } catch (err) {
        console.warn('Nominatim reverse geocoding fallback:', err);
        statusText.textContent = 'GPS captured. Check village & mandal details below.';
      } finally {
        if (spinner) spinner.classList.add('hidden');
      }
    },
    (err) => {
      console.warn('GPS denied or unavailable:', err.message);
      statusText.textContent = 'GPS permission denied. Using fallback coordinates (Kuppam). You can edit Village & Mandal below.';
      if (spinner) spinner.classList.add('hidden');
      renderMapPreview(12.7482, 78.3667);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function renderMapPreview(lat, lon) {
  const mapContainer = document.getElementById('mapPreview');
  if (!mapContainer) return;

  if (typeof L === 'undefined') {
    setTimeout(() => renderMapPreview(lat, lon), 500);
    return;
  }

  mapContainer.classList.remove('hidden');

  if (!leafletMap) {
    leafletMap = L.map('mapPreview').setView([lat, lon], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: 'Â© OpenStreetMap'
    }).addTo(leafletMap);
    currentMarker = L.marker([lat, lon]).addTo(leafletMap).bindPopup('Inciting Location').openPopup();
  } else {
    leafletMap.setView([lat, lon], 14);
    if (currentMarker) currentMarker.setLatLng([lat, lon]);
  }
}

function toggleRuralFallback() {
  const container = document.getElementById('ruralFallbackContainer');
  if (container) container.classList.toggle('hidden');
}

// 5. Initiate Confirmation (Fixes Map Z-Index Overlay)
async function initiateComplaintConfirmation() {
  const citizen_mobile = document.getElementById('citizenMobile').value.trim();
  const original_note = document.getElementById('originalNote').value.trim();
  const village = document.getElementById('villageInput').value.trim();
  const mandal = document.getElementById('mandalInput').value.trim();
  const state = document.getElementById('stateSelect').value;
  const district = document.getElementById('districtSelect').value;
  const latitude = document.getElementById('latInput').value;
  const longitude = document.getElementById('lonInput').value;

  if (!citizen_mobile || citizen_mobile.length !== 10) {
    alert('Please enter a valid 10-digit mobile number.');
    return;
  }
  if (!original_note) {
    alert('Please describe your problem or speak your grievance.');
    return;
  }
  if (!village || !mandal) {
    alert('Please specify Village and Mandal.');
    return;
  }

  const user_language = localStorage.getItem('civic_user_language') || currentSpeechLang || 'te-IN';
  pendingPayload = {
    citizen_mobile,
    original_note,
    village,
    mandal,
    state,
    district,
    latitude,
    longitude,
    user_language,
    state_code: window.selectedLocation?.stateCode || null,
    district_code: window.selectedLocation?.districtCode || null,
    mandal_code: window.selectedLocation?.mandalCode || null,
    village_code: window.selectedLocation?.villageCode || null
  };

  // Hide Leaflet Map while modal is active so it never overlaps the Green/Red buttons
  const mapPreviewContainer = document.getElementById('mapPreview');
  if (mapPreviewContainer) mapPreviewContainer.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/api/gemini/confirm-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_note, village, mandal, user_language })
    });
    const data = await res.json();

    if (data.success) {
      showAudioConfirmModal(data.confirmation_speech, data.detected_language, user_language || data.bcp47_code);
    } else {
      showAudioConfirmModal(
        `Meeru cheppina problem ${village}, ${mandal} lo ne na? Correct ayithe Green button, lekapothe Red button click cheyandi.`,
        'Telugu',
        'te-IN'
      );
    }
  } catch (err) {
    showAudioConfirmModal(
      `Is your reported problem located in ${village}, ${mandal}? Click Green button if correct, or Red button if not.`,
      'English',
      'en-IN'
    );
  }
}

function showAudioConfirmModal(speechText, langName, bcp47Code) {
  currentSpeechText = speechText;
  currentSpeechLang = bcp47Code || 'te-IN';

  document.getElementById('modalLangTag').textContent = `Detected Language: ${langName} (${bcp47Code})`;
  document.getElementById('ttsSpeechText').textContent = `"${speechText}"`;

  const modal = document.getElementById('audioConfirmModal');
  modal.classList.remove('hidden');

  speakTextWithFemaleVoice(speechText, bcp47Code);
}

function replayAudioConfirmation() {
  if (currentSpeechText) {
    speakTextWithFemaleVoice(currentSpeechText, currentSpeechLang);
  }
}

function rejectLocationConfirmation() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  document.getElementById('audioConfirmModal').classList.add('hidden');
  const mapPreviewContainer = document.getElementById('mapPreview');
  if (mapPreviewContainer) mapPreviewContainer.classList.remove('hidden');
  alert('Please update your Village or Mandal name in the location fields and try again.');
}

async function confirmAndSubmitComplaint() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();

  const confirmBtn = document.getElementById('confirmGreenBtn');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-lg"></i> Submitting...';

  try {
    const res = await fetch(`${API_BASE}/api/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendingPayload)
    });
    const data = await res.json();

    document.getElementById('audioConfirmModal').classList.add('hidden');
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '<i class="fa-solid fa-check text-lg"></i> <span>YES / ఒప్పు (Green)</span>';

    if (data.success) {
      showSuccessModal(data);
    } else {
      alert('Error submitting grievance: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    document.getElementById('audioConfirmModal').classList.add('hidden');
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '<i class="fa-solid fa-check text-lg"></i> <span>YES / ఒప్పు (Green)</span>';
    alert('Network error while submitting complaint.');
  }
}

let lastSubmittedComplaintData = null;

function showSuccessModal(data) {
  lastSubmittedComplaintData = data;
  const c = data.complaint;
  const trackingId = data.tracking_id || c.tracking_id || c.id;
  const catName = c.category_name || (c.departments ? c.departments.name : 'Public Works');
  let officerName = 'Assigned Officer';

  document.getElementById('resTrackingId').textContent = trackingId;
  document.getElementById('resCategory').textContent = catName;
  
  const offEl = document.getElementById('resOfficer');
  if (data.is_multi_department && data.assigned_officers && data.assigned_officers.length > 0) {
    const multiList = data.assigned_officers.map(o => `<div>👮 <b>${o.department_name}</b>: ${o.officer_name} ${o.officer_mobile ? '(' + o.officer_mobile + ')' : ''}</div>`).join('');
    offEl.innerHTML = `<div class="space-y-1 text-xs font-semibold text-emerald-800"><div class="text-amber-700 font-extrabold uppercase tracking-wide">🎯 MULTI-DEPARTMENT DISPATCH (${data.assigned_officers.length} OFFICERS ASSIGNED):</div>${multiList}</div>`;
  } else if (data.assigned_officer && data.assigned_officer.is_assigned) {
    officerName = data.assigned_officer.name;
    offEl.textContent = `${data.assigned_officer.name} (${data.assigned_officer.mobile})`;
    offEl.className = 'font-semibold text-emerald-700';
  } else {
    offEl.textContent = 'Officer Assigned (Dispatched)';
    offEl.className = 'font-bold text-teal-800';
  }
  
  const sevEl = document.getElementById('resSeverity');
  sevEl.textContent = c.severity;
  if (c.severity === 'EMERGENCY') sevEl.className = 'font-bold text-rose-600 animate-pulse';
  else if (c.severity === 'MODERATE') sevEl.className = 'font-bold text-amber-600';
  else sevEl.className = 'font-bold text-emerald-600';

  const lang = localStorage.getItem('civic_user_bcp47') || currentSpeechLang || 'te-IN';
  const briefText = generateBriefExplanation(lang, catName, officerName, trackingId, c.village, c.mandal);
  
  const briefEl = document.getElementById('resBriefText');
  if (briefEl) briefEl.textContent = briefText;

  document.getElementById('resWhatsappBtn').href = data.whatsapp_url;
  document.getElementById('resPdfBtn').href = `${API_BASE}/api/complaints/download-pdf/${c.tracking_id || c.id}`;

  document.getElementById('successModal').classList.remove('hidden');

  // Auto speak registration confirmation in citizen's selected native language
  playSuccessComplaintAudio();
}

function generateBriefExplanation(lang, catName, officerName, trackingId, vill, mand) {
  if (lang.includes('te')) {
    return `మీ ఫిర్యాదును AI విశ్లేషించి, [${catName}] విభాగానికి కేటాయించింది. బాధ్యత అధికారి ${officerName} గారికి సమాచారం పంపబడింది. ట్రాకింగ్ ID #${trackingId} ద్వారా ప్రగతిని తెలుసుకోవచ్చు.`;
  } else if (lang.includes('hi')) {
    return `आपकी शिकायत का AI द्वारा विश्लेषण किया गया है और इसे [${catName}] विभाग को सौंपा गया है। संबंधित अधिकारी ${officerName} को सूचित कर दिया गया है। ट्रैकिंग आईडी #${trackingId} द्वारा स्थिति देखें।`;
  } else if (lang.includes('bn')) {
    return `আপনার সমস্যাটি AI বিশ্লেষণ করে [${catName}] বিভাগে প্রেরণ করা হয়েছে। কর্মকর্তা ${officerName}-কে অবহিত করা হয়েছে। ট্র্যাকিং আইডি #${trackingId} দিয়ে স্থিতি দেখুন।`;
  } else if (lang.includes('mr')) {
    return `तुमच्या समस्येचे AI द्वारे विश्लेषण करून ते [${catName}] विभागाकडे सोपवले आहे. अधिकारी ${officerName} यांना सूचित केले आहे। ट्रॅकिंग आयडी #${trackingId} द्वारे प्रगती पहा.`;
  } else if (lang.includes('ta')) {
    return `உங்கள் பிரச்சனை AI மூலம் பகுப்பாய்வு செய்யப்பட்டு [${catName}] துறைக்கு ஒதுக்கப்பட்டுள்ளது. அதிகாரி ${officerName} அவர்களுக்கு தகவல் தெரிவிக்கப்பட்டுள்ளது. கண்காணிப்பு ஐடி #${trackingId} மூலம் நிலையை அறியலாம்.`;
  } else if (lang.includes('gu')) {
    return `તમારી સમસ્યાનું AI દ્વારા વિશ્લેષણ કરીને [${catName}] વિભાગને સોંપવામાં આવી છે. અધિકારી ${officerName} ને જાણ કરવામાં આવી છે. ટ્રેકિંગ આઈડી #${trackingId} થી સ્થિતિ જુઓ.`;
  } else if (lang.includes('kn')) {
    return `ನಿಮ್ಮ ಸಮಸ್ಯೆಯನ್ನು AI ನಿಂದ ವಿಶ್ಲೇಷಿಸಿ [${catName}] ಇಲಾಖೆಗೆ ನಿಯೋಜಿಸಲಾಗಿದೆ. ಅಧಿಕಾರಿ ${officerName} ಅವರಿಗೆ ಮಾಹಿತಿ ನೀಡಲಾಗಿದೆ. ಟ್ರ್ಯಾಕಿಂಗ್ ಐಡಿ #${trackingId} ಮೂಲಕ ಸ್ಥಿತಿ ವೀಕ್ಷಿಸಿ.`;
  } else if (lang.includes('or')) {
    return `ଆପଣଙ୍କ ସମସ୍ୟାକୁ AI ଦ୍ୱାରା ବିଶ୍ଳେଷଣ କରାଯାଇ [${catName}] ବିଭାଗକୁ ପଠାଯାଇଛି। ଅଧିକାରୀ ${officerName} ଙ୍କୁ ସୂଚନା ଦିଆଯାଇଛି। ଟ୍ରାକିଂ ଆଇଡି #${trackingId} ଦ୍ୱାରା ସ୍ଥିତି ଦେଖନ୍ତୁ।`;
  } else if (lang.includes('ml')) {
    return `നിങ്ങളുടെ പ്രശ്നം AI വിശകലനം ചെയ്ത് [${catName}] വകുപ്പിന് നൽകി. ഉദ്യോഗസ്ഥൻ ${officerName}-ന് വിവരം കൈമാറി. ട്രാക്കിംഗ് ഐഡി #${trackingId} വഴി പുരോഗതി കാണാം.`;
  } else if (lang.includes('pa')) {
    return `ਤੁਹਾਡੀ ਸਮੱਸਿਆ ਦਾ AI ਦੁਆਰਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰਕੇ [${catName}] ਵਿਭਾਗ ਨੂੰ ਸੌਂਪਿਆ ਗਿਆ ਹੈ। ਅਧਿਕਾਰੀ ${officerName} ਨੂੰ ਸੂਚਿਤ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ। ਟ੍ਰੈਕਿੰਗ ਆਈਡੀ #${trackingId} ਨਾਲ ਸਥਿਤੀ ਦੇਖੋ।`;
  } else if (lang.includes('as')) {
    return `আপোনাৰ সমস্যাটো AI দ্বাৰা বিশ্লেষণ কৰি [${catName}] বিভাগলৈ প্ৰেৰণ কৰা হৈছে। বিষয়া ${officerName}-ক জনোৱা হৈছে। ট্ৰ্যাকিং আইডি #${trackingId} ৰে স্থিতি চাওক।`;
  }
  return `Your grievance has been analyzed by AI and assigned to [${catName}] department under Field Officer ${officerName}. You can track resolution using Tracking ID #${trackingId}.`;
}

function playSuccessComplaintAudio() {
  if (!lastSubmittedComplaintData) return;
  const c = lastSubmittedComplaintData.complaint;
  const trackingId = lastSubmittedComplaintData.tracking_id || c.tracking_id || c.id;
  const catName = c.category_name || (c.departments ? c.departments.name : 'Public Infrastructure');
  const officerName = lastSubmittedComplaintData.assigned_officer?.name || 'Assigned Officer';
  const lang = localStorage.getItem('civic_user_bcp47') || currentSpeechLang || 'te-IN';

  const speechText = generateBriefExplanation(lang, catName, officerName, trackingId, c.village, c.mandal);
  speakTextWithFemaleVoice(speechText, lang);
}

function closeSuccessModal() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  document.getElementById('successModal').classList.add('hidden');
  document.getElementById('grievanceForm').reset();
  
  userWantsRecording = false;
  isRecording = false;
  if (recognition) {
    try { recognition.stop(); } catch(e){}
  }
  stopRecordingUI();
  document.getElementById('originalNote').value = '';
  pendingPayload = null;

  const mapPreviewContainer = document.getElementById('mapPreview');
  if (mapPreviewContainer) mapPreviewContainer.classList.remove('hidden');

  detectGPSLocation();
}

function switchCitizenTab(tab) {
  const raiseView = document.getElementById('viewRaiseIssue');
  const trackView = document.getElementById('viewTrackIssue');

  const btnRaise = document.getElementById('btnTabRaise');
  const btnTrack = document.getElementById('btnTabTrack');

  if (tab === 'raise') {
    raiseView.classList.remove('hidden');
    trackView.classList.add('hidden');

    btnRaise.className = 'bg-teal-900 text-white p-5 rounded-2xl shadow-md border-2 border-teal-800 text-left transition transform active:scale-95 flex items-center justify-between';
    btnTrack.className = 'bg-white text-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 text-left hover:border-teal-600 transition transform active:scale-95 flex items-center justify-between';
  } else {
    trackView.classList.remove('hidden');
    raiseView.classList.add('hidden');

    btnTrack.className = 'bg-teal-900 text-white p-5 rounded-2xl shadow-md border-2 border-teal-800 text-left transition transform active:scale-95 flex items-center justify-between';
    btnRaise.className = 'bg-white text-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 text-left hover:border-teal-600 transition transform active:scale-95 flex items-center justify-between';
  }
}

// 7. Track Complaint Lookup & Timeline Rendering
async function handleTrackComplaint(e) {
  e.preventDefault();
  const trackingId = document.getElementById('trackInput').value.trim();

  if (!trackingId) {
    alert('Please enter a valid 8-digit numeric Tracking ID.');
    return;
  }

  const container = document.getElementById('trackResultContainer');
  container.classList.remove('hidden');
  container.innerHTML = '<div class="text-center p-6 text-slate-500 font-bold text-xs"><i class="fa-solid fa-circle-notch fa-spin text-teal-800 text-lg mr-2"></i>Fetching complaint status...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/complaints/track/${trackingId}`);
    const data = await res.json();

    if (data.success && data.complaint) {
      renderTrackingTimeline(data.complaint);
    } else {
      container.innerHTML = `
        <div class="bg-rose-50 border border-rose-200 p-5 rounded-xl text-center text-rose-700 text-xs font-bold">
          <i class="fa-solid fa-circle-xmark text-lg block mb-1"></i>
          Tracking ID #${trackingId} not found. Please verify your 8-digit number and try again.
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = '<div class="bg-rose-50 p-4 text-xs font-bold text-rose-700 rounded-xl text-center">Network error while tracking complaint.</div>';
  }
}

function renderTrackingTimeline(complaint) {
  const container = document.getElementById('trackResultContainer');

  // Determine user's active portal language
  const userLang = (localStorage.getItem('civic_user_bcp47') || currentSpeechLang || 'te-IN').toLowerCase();
  const isTelugu = userLang.includes('te');
  const isHindi = userLang.includes('hi');
  const isTamil = userLang.includes('ta');
  const isKannada = userLang.includes('kn');
  const isBengali = userLang.includes('bn');
  const isMarathi = userLang.includes('mr');
  const isGujarati = userLang.includes('gu');
  const isOdia = userLang.includes('or');
  const isMalayalam = userLang.includes('ml');

  // Multilingual UI Labels
  let trackingIdLbl = 'Tracking ID / ట్రాకింగ్ ID';
  let locationLbl = 'Location / ప్రాంతం:';
  let deadlineLbl = 'Target Deadline / లక్ష్య గడువు:';
  let severityLbl = 'Severity / తీవ్రత:';
  let languageLbl = 'Language / భాష:';
  let timelineHeaderLbl = 'ఫిర్యాదు పరిష్కార పురోగతి కాలక్రమం (Complaint Resolution Timeline)';

  if (isTelugu) {
    trackingIdLbl = 'ట్రాకింగ్ ID (Tracking ID)';
    locationLbl = 'ప్రాంతం (Location):';
    deadlineLbl = 'లక్ష్య గడువు (Deadline):';
    severityLbl = 'తీవ్రత (Severity):';
    languageLbl = 'నమోదు భాష (Language):';
    timelineHeaderLbl = 'ఫిర్యాదు పరిస్కార లైవ్ కాలక్రమం (Complaint Resolution Timeline)';
  } else if (isHindi) {
    trackingIdLbl = 'ट्रैकिंग आईडी (Tracking ID)';
    locationLbl = 'स्थान (Location):';
    deadlineLbl = 'लक्ष्य सीमा (Deadline):';
    severityLbl = 'गंभीरता (Severity):';
    languageLbl = 'भाषा (Language):';
    timelineHeaderLbl = 'शिकायत निवारण समय-रेखा (Complaint Resolution Timeline)';
  } else if (isTamil) {
    trackingIdLbl = 'கண்காணிப்பு ஐடி (Tracking ID)';
    locationLbl = 'இருப்பிடம் (Location):';
    deadlineLbl = 'காலக்கெடு (Deadline):';
    severityLbl = 'தீவிரம் (Severity):';
    languageLbl = 'மொழி (Language):';
    timelineHeaderLbl = 'புகார் முன்னேற்ற காலக்கோடு (Complaint Timeline)';
  } else if (isKannada) {
    trackingIdLbl = 'ಟ್ರ್ಯಾಕಿಂಗ್ ಐಡಿ (Tracking ID)';
    locationLbl = 'ಸ್ಥಳ (Location):';
    deadlineLbl = 'ಗಡುವು (Deadline):';
    severityLbl = 'ತೀವ್ರತೆ (Severity):';
    languageLbl = 'ಭಾಷೆ (Language):';
    timelineHeaderLbl = 'ದೂರು ಪರಿಹಾರ ಕಾಲಮಿತಿ (Complaint Timeline)';
  }

  // Multilingual Dept Name Translation
  let deptName = complaint.category_name || complaint.departments?.name || 'Public Infrastructure';
  if (deptName.includes('Water')) {
    if (isTelugu) deptName = 'మంచినీటి సరఫరా శాఖ (Water Supply)';
    else if (isHindi) deptName = 'जल आपूर्ति विभाग (Water Supply)';
    else if (isTamil) deptName = 'குடிநீர் வழங்கல் துறை (Water Supply)';
  } else if (deptName.includes('Electric')) {
    if (isTelugu) deptName = 'విద్యుత్ శాఖ (Electricity Board)';
    else if (isHindi) deptName = 'बिजली बोर्ड (Electricity Board)';
    else if (isTamil) deptName = 'மின்சார வாரியம் (Electricity Board)';
  } else if (deptName.includes('Drain')) {
    if (isTelugu) deptName = 'డ్రైనేజీ & మురుగునీటి యాజమాన్యం (Drainage)';
    else if (isHindi) deptName = 'ड्रेनेज प्रबंधन (Drainage Management)';
    else if (isTamil) deptName = 'கழிவுநீர் மேலாண்மை (Drainage)';
  } else if (deptName.includes('Road')) {
    if (isTelugu) deptName = 'రోడ్లు & మౌలిక వసతుల శాఖ (Roads & Infra)';
    else if (isHindi) deptName = 'सड़क और बुनियादी ढांचा (Roads & Infra)';
    else if (isTamil) deptName = 'சாலைகள் மற்றும் உள்கட்டமைப்பு (Roads)';
  } else if (deptName.includes('Sanitat')) {
    if (isTelugu) deptName = 'పారిశుధ్యం & వ్యర్థాల యాజమాన్యం (Sanitation)';
    else if (isHindi) deptName = 'स्वच्छता और कचरा प्रबंधन (Sanitation)';
  }

  // Multilingual Status Translation
  let statusDisplay = complaint.status;
  let statusColor = 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold';

  if (complaint.status === 'PENDING') {
    if (isTelugu) statusDisplay = 'పరిశీలనలో ఉంది (PENDING)';
    else if (isHindi) statusDisplay = 'लंबित (PENDING)';
  } else if (complaint.status === 'ONGOING' || complaint.status === 'DISPATCHED') {
    statusColor = 'bg-blue-100 text-blue-900 border-blue-300 font-extrabold';
    if (isTelugu) statusDisplay = 'చర్యలు కొనసాగుతున్నాయి (ONGOING)';
    else if (isHindi) statusDisplay = 'प्रगति पर (ONGOING)';
    else if (isTamil) statusDisplay = 'நடவடிக்கையில் உள்ளது (ONGOING)';
  } else if (complaint.status === 'RESOLVED') {
    statusColor = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold';
    if (isTelugu) statusDisplay = 'పరిష్కరించబడింది (RESOLVED)';
    else if (isHindi) statusDisplay = 'हल किया गया (RESOLVED)';
    else if (isTamil) statusDisplay = 'தீர்க்கப்பட்டது (RESOLVED)';
  } else if (complaint.status === 'OVERDUE') {
    statusColor = 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold';
    if (isTelugu) statusDisplay = 'గడువు మీరింది (OVERDUE)';
    else if (isHindi) statusDisplay = 'समय सीमा समाप्त (OVERDUE)';
  }

  // Multilingual Severity Translation
  let severityDisplay = complaint.severity;
  if (complaint.severity === 'EMERGENCY') {
    if (isTelugu) severityDisplay = 'అత్యవసరం (EMERGENCY)';
    else if (isHindi) severityDisplay = 'आपातकालीन (EMERGENCY)';
  } else if (complaint.severity === 'MODERATE') {
    if (isTelugu) severityDisplay = 'సాధారణం (MODERATE)';
    else if (isHindi) severityDisplay = 'मध्यम (MODERATE)';
  } else if (complaint.severity === 'MILD') {
    if (isTelugu) severityDisplay = 'తక్కువ (MILD)';
    else if (isHindi) severityDisplay = 'हल्का (MILD)';
  }

  let deadlineText = complaint.deadline_at ? new Date(complaint.deadline_at).toLocaleString('en-IN') : (isTelugu ? 'అధికారి గడువు ఇంకా నిర్ణయించలేదు' : 'Awaiting Officer Deadline');

  // Timeline Events Translation
  let regTitle = 'Complaint Registered Successfully';
  let aiTitle = `AI Analyzed (${complaint.detected_language || 'Telugu'})`;
  let deptTitle = `Department Assigned: ${deptName}`;
  let accTitle = 'Officer Accepted Complaint & Dispatched Team';
  let resTitle = 'Issue Resolved & Incident Closed';

  if (isTelugu) {
    regTitle = 'ఫిర్యాదు విజయవంతంగా నమోదైంది (Complaint Registered)';
    aiTitle = `AI రంగాన్ని & తీవ్రతను విశ్లేషించింది (${complaint.detected_language || 'తెలుగు'})`;
    deptTitle = `కేటాయించిన ప్రభుత్వ శాఖ: ${deptName}`;
    accTitle = 'క్షేత్రస్థాయి అధికారి ఫిర్యాదును స్వీకరించారు (Officer Accepted)';
    resTitle = 'సమస్య పరిష్కరించబడింది (Issue Resolved & Closed)';
  } else if (isHindi) {
    regTitle = 'शिकायत दर्ज की गई (Complaint Registered)';
    aiTitle = `AI द्वारा विश्लेषण पूरा हुआ (${complaint.detected_language || 'हिंदी'})`;
    deptTitle = `आवंटित सरकारी विभाग: ${deptName}`;
    accTitle = 'अधिकारी ने शिकायत स्वीकार की (Officer Accepted)';
    resTitle = 'समस्या का समाधान किया गया (Issue Resolved & Closed)';
  } else if (isTamil) {
    regTitle = 'புகார் பதிவு செய்யப்பட்டது (Complaint Registered)';
    aiTitle = `AI பகுப்பாய்வு முடிந்தது (${complaint.detected_language || 'தமிழ்'})`;
    deptTitle = `ஒதுக்கப்பட்ட அரசுத் துறை: ${deptName}`;
    accTitle = 'அதிகாரி புகாரை ஏற்றுக்கொண்டார் (Officer Accepted)';
    resTitle = 'பிரச்சனை தீர்க்கப்பட்டது (Issue Resolved)';
  }

  const events = [
    { title: regTitle, time: new Date(complaint.created_at).toLocaleString('en-IN'), status: 'Completed', icon: 'fa-file-circle-check' },
    { title: aiTitle, time: new Date(complaint.created_at).toLocaleString('en-IN'), status: 'Completed', icon: 'fa-brain' },
    { title: deptTitle, time: new Date(complaint.created_at).toLocaleString('en-IN'), status: 'Completed', icon: 'fa-building-flag' }
  ];

  if (complaint.accepted_at) {
    events.push({ title: accTitle, time: new Date(complaint.accepted_at).toLocaleString('en-IN'), status: 'Completed', icon: 'fa-user-check' });
  }

  if (complaint.updates && complaint.updates.length > 0) {
    complaint.updates.forEach((upd, idx) => {
      let updTitle = `Officer Update #${idx + 1}: ${upd.translated_update || upd.original_update}`;
      if (isTelugu) {
        updTitle = `అధికారి అప్‌డేట్ #${idx + 1}: "${upd.original_update}" (మీ ఫిర్యాదుపై క్షేత్రస్థాయి చర్యలు కొనసాగుతున్నాయి)`;
      } else if (isHindi) {
        updTitle = `अधिकारी अपडेट #${idx + 1}: "${upd.original_update}" (आपकी शिकायत पर कार्रवाई जारी है)`;
      } else if (isTamil) {
        updTitle = `அதிகாரி புதுப்பிப்பு #${idx + 1}: "${upd.original_update}" (நடவடிக்கை எடுக்கப்படுகிறது)`;
      }

      events.push({
        title: updTitle,
        time: new Date(upd.created_at).toLocaleString('en-IN'),
        status: 'In Progress',
        icon: 'fa-comment-dots'
      });
    });
  }

  if (complaint.status === 'RESOLVED') {
    events.push({ title: resTitle, time: complaint.resolved_at ? new Date(complaint.resolved_at).toLocaleString('en-IN') : 'Recent', status: 'Resolved', icon: 'fa-circle-check' });
  }

  let timelineHtml = events.map(e => `
    <div class="flex items-start space-x-3 text-xs">
      <div class="w-7 h-7 rounded-full bg-teal-100 text-teal-900 flex items-center justify-center font-bold text-xs mt-0.5 border border-teal-300 shrink-0 shadow-xs">
        <i class="fa-solid ${e.icon}"></i>
      </div>
      <div class="bg-slate-50 border border-slate-200 p-3 rounded-xl flex-grow">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-900 text-xs">${e.title}</span>
          <span class="text-[10px] text-slate-500 font-mono">${e.time}</span>
        </div>
      </div>
    </div>
  `).join('');

  // AI Summary or Original Note display in Citizen Language
  let summaryText = complaint.ai_summary || complaint.original_note;
  if (isTelugu && complaint.original_note) {
    summaryText = `సమస్య సారాంశం: "${complaint.original_note}" (విభాగం: ${deptName}, స్థలం: ${complaint.village}, ${complaint.mandal})`;
  }

  let multiIssuesTimelineHtml = '';
  if (complaint.detected_issues && Array.isArray(complaint.detected_issues) && complaint.detected_issues.length > 0) {
    const listHtml = complaint.detected_issues.map((iss, i) => `
      <div class="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs shadow-xs">
        <div>
          <div class="font-extrabold text-slate-900">Issue #${i+1}: ${iss.category_name}</div>
          <div class="text-slate-600 font-medium text-[11px]">${iss.problem}</div>
        </div>
        <span class="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${iss.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : (iss.status === 'ONGOING' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-amber-100 text-amber-900 border border-amber-300')}">
          ${iss.status}
        </span>
      </div>
    `).join('');

    multiIssuesTimelineHtml = `
      <div class="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 p-3.5 rounded-xl space-y-2 text-xs">
        <div class="font-extrabold text-teal-950 uppercase tracking-wider text-[11px] flex items-center justify-between">
          <span><i class="fa-solid fa-list-check text-teal-700 mr-1"></i> Detected Civic Issues (${complaint.detected_issues.length} Department Assignments)</span>
        </div>
        <div class="space-y-1.5">${listHtml}</div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 shadow-xs">
      <div class="flex items-center justify-between">
        <div>
          <span class="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">${trackingIdLbl}</span>
          <h4 class="text-xl font-black font-mono text-teal-950">#${complaint.tracking_id}</h4>
        </div>
        <span class="px-3 py-1 text-xs rounded-full border shadow-xs ${statusColor}">${statusDisplay}</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-slate-200 pt-3">
        <div><span class="font-bold text-slate-600">${locationLbl}</span> <span class="font-semibold text-slate-900">${complaint.village}, ${complaint.mandal}</span></div>
        <div><span class="font-bold text-slate-600">${deadlineLbl}</span> <span class="font-semibold text-slate-900">${deadlineText}</span></div>
        <div><span class="font-bold text-slate-600">${severityLbl}</span> <span class="font-extrabold text-slate-900">${severityDisplay}</span></div>
        <div><span class="font-bold text-slate-600">${languageLbl}</span> <span class="font-semibold text-slate-900">${complaint.detected_language || 'Telugu'}</span></div>
      </div>

      ${multiIssuesTimelineHtml}

      <div class="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-slate-800 font-semibold leading-relaxed">
        <i class="fa-solid fa-sparkles text-amber-600 mr-1.5"></i>
        ${summaryText}
      </div>
    </div>

    <div>
      <h4 class="text-xs font-extrabold uppercase tracking-wider text-teal-950 mb-3 flex items-center space-x-1.5">
        <i class="fa-solid fa-list-check text-teal-700"></i>
        <span>${timelineHeaderLbl}</span>
      </h4>
      <div class="space-y-3">
        ${timelineHtml}
      </div>
    </div>
  `;
}


