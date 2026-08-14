const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('🤖 Gemini API Client initialized successfully.');
  } catch (err) {
    console.warn('⚠️ Could not initialize Gemini API Client:', err.message);
  }
}

/**
 * Main Grievance Analysis Entry Point (Multilingual 12 Indian Languages)
 */
async function analyzeGrievance(originalNote, villageName, mandalName, availableDepartments = [], preferredLang = 'te-IN') {
  const cleanVill = cleanLocationName(villageName);
  const cleanMand = cleanLocationName(mandalName);

  const localRes = localGrievanceAnalysis(originalNote, cleanVill, cleanMand, availableDepartments, preferredLang);

  const systemPrompt = `
You are CivicAI - India's premier Multilingual AI Public Grievance Classifier.
Analyze the following citizen complaint note reported in village "${cleanVill}", mandal "${cleanMand}".

Complaint Note: "${originalNote}"
Available Departments: ${JSON.stringify(availableDepartments)}

Your task:
1. Identify the detected language (Telugu, Hindi, Tamil, Kannada, Bengali, Marathi, Gujarati, Odia, Malayalam, Punjabi, Assamese, English).
2. Classify if this complaint involves MULTIPLE departments (e.g. both Electricity Board AND Drainage Management).
3. If multiple departments are involved, return all matched departments in "matched_departments" array.
4. Assign severity: "EMERGENCY", "MODERATE", or "MILD".
5. Write a concise English summary.

Return JSON in this format ONLY:
{
  "detected_language": "Telugu",
  "bcp47_code": "te-IN",
  "confirmation_speech": "Speech string",
  "category_id": 2, 
  "category_name": "Selected Department Name",
  "is_multi_department": true/false,
  "multi_department_names": "Electricity Board & Drainage Management",
  "matched_departments": [{"id": 2, "name": "Electricity Board"}, {"id": 5, "name": "Drainage Management"}],
  "severity": "EMERGENCY",
  "ai_summary": "Short English summary of issue and risk level"
}
`;

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const response = await model.generateContent(systemPrompt);
      const text = response.response.text();
      
      const cleanJsonStr = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonStr);
      
      return {
        ...localRes,
        ...parsed,
        is_multi_department: parsed.is_multi_department || localRes.is_multi_department,
        matched_departments: (parsed.matched_departments && parsed.matched_departments.length > 0) ? parsed.matched_departments : localRes.matched_departments,
        multi_department_names: parsed.multi_department_names || localRes.multi_department_names
      };
    } catch (err) {
      console.warn('⚠️ Gemini API call failed or timed out. Falling back to local NLP engine.', err.message);
    }
  }

  return localRes;
}

/**
 * Translates Officer's English update into Citizen's Native Language
 */
async function translateOfficerUpdate(originalUpdate, targetLanguage = 'Telugu') {
  if (!originalUpdate) return '';

  if (genAI) {
    try {
      const prompt = `Translate the following official grievance status update into clear, polite ${targetLanguage}: "${originalUpdate}". Return ONLY the translated string without quotes or extra text.`;
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const response = await model.generateContent(prompt);
      return response.response.text().trim();
    } catch (err) {
      console.warn('⚠️ Gemini translation fallback triggered:', err.message);
    }
  }

  if (targetLanguage.toLowerCase().includes('telugu')) {
    return `అధికారి అప్‌డేట్: "${originalUpdate}" (మీ ఫిర్యాదుపై చర్యలు కొనసాగుతున్నాయి)`;
  } else if (targetLanguage.toLowerCase().includes('hindi')) {
    return `अधिकारी अपडेट: "${originalUpdate}" (आपकी शिकायत पर कार्रवाई जारी है)`;
  }
  return `Officer Update: "${originalUpdate}"`;
}

function cleanLocationName(str) {
  if (!str) return 'Chittoor';
  let s = String(str);
  if (/[\u0900-\u097F]/.test(s) || s.includes('चित्तूर') || s.includes('??')) {
    return 'Chittoor';
  }
  const cleaned = s.replace(/[^\x00-\x7F]/g, '').trim();
  return cleaned || 'Chittoor';
}

/**
 * Intelligent Local Fallback Classifier (Multi-Department Supported)
 */
function localGrievanceAnalysis(note, village, mandal, availableDepts = [], preferredLang = 'te-IN') {
  const lowerNote = (note || '').toLowerCase();
  const rawNote = note || '';
  const cleanVill = cleanLocationName(village);
  const cleanMand = cleanLocationName(mandal);

  let pLang = (preferredLang || '').toLowerCase();

  let detected_language = 'English';
  let bcp47_code = 'en-IN';
  let confirmation_speech = `Is your reported problem located in ${cleanVill}, ${cleanMand}? Click Green button if correct, or Red button if not.`;

  // Language Detection & Speech Phrasing (12 Indian Languages)
  if (pLang.includes('te') || pLang.includes('telugu') || /[\u0C00-\u0C7F]/.test(rawNote)) {
    detected_language = 'Telugu';
    bcp47_code = 'te-IN';
    confirmation_speech = `మీరు చెప్పిన సమస్య ${cleanVill}, ${cleanMand} లోనే నా? సరియైనదైతే పచ్చ రంగు బటన్ (Green), కాకపోతే ఎర్ర రంగు బటన్ (Red) క్లిక్ చేయండి.`;
  } else if (pLang.includes('hi') || pLang.includes('hindi') || /[\u0900-\u097F]/.test(rawNote)) {
    detected_language = 'Hindi';
    bcp47_code = 'hi-IN';
    confirmation_speech = `क्या आपकी समस्या ${cleanVill}, ${cleanMand} में ही है? सही है तो हरा बटन (Green), नहीं तो लाल बटन (Red) दबाएं।`;
  } else if (pLang.includes('bn') || pLang.includes('bengali') || /[\u0980-\u09FF]/.test(rawNote)) {
    detected_language = 'Bengali';
    bcp47_code = 'bn-IN';
    confirmation_speech = `আপনার অভিযোগটি কি ${cleanVill}, ${cleanMand}-এ অবস্থিত? সঠিক হলে সবুজ বোতাম (Green) এবং না হলে লাল বোতাম (Red) ক্লিক করুন।`;
  } else if (pLang.includes('mr') || pLang.includes('marathi')) {
    detected_language = 'Marathi';
    bcp47_code = 'mr-IN';
    confirmation_speech = `तुमची समस्या ${cleanVill}, ${cleanMand} मधील आहे का? बरोबर असल्यास हिरवे बटण (Green), नसल्यास लाल बटण (Red) दाबा.`;
  } else if (pLang.includes('ta') || pLang.includes('tamil') || /[\u0B80-\u0BFF]/.test(rawNote)) {
    detected_language = 'Tamil';
    bcp47_code = 'ta-IN';
    confirmation_speech = `நீங்கள் கூறிய பிரச்சனை ${cleanVill}, ${cleanMand} இல் உள்ளதா? சரியென்றால் பச்சை பொத்தான் (Green), இல்லையென்றால் சிவப்பு பொத்தான் (Red) அழுத்தவும்.`;
  } else if (pLang.includes('gu') || pLang.includes('gujarati') || /[\u0A80-\u0AFF]/.test(rawNote)) {
    detected_language = 'Gujarati';
    bcp47_code = 'gu-IN';
    confirmation_speech = `શું તમારી સમસ્યા ${cleanVill}, ${cleanMand} માં છે? જો સાચું હોય તો લીલું બટન (Green) અને ખોટું હોય તો લાલ બટન (Red) દબાવો।`;
  } else if (pLang.includes('kn') || pLang.includes('kannada') || /[\u0C80-\u0CFF]/.test(rawNote)) {
    detected_language = 'Kannada';
    bcp47_code = 'kn-IN';
    confirmation_speech = `ನಿಮ್ಮ ಸಮಸ್ಯೆ ${cleanVill}, ${cleanMand} ನಲ್ಲಿದೆಯೇ? ಸರಿಯಾಗಿದ್ದರೆ ಹಸಿರು ಬಟನ್ (Green), ಇಲ್ಲದಿದ್ದರೆ ಕೆಂಪು ಬಟನ್ (Red) ಒತ್ತಿ.`;
  } else if (pLang.includes('or') || pLang.includes('odia') || /[\u0B00-\u0B7F]/.test(rawNote)) {
    detected_language = 'Odia';
    bcp47_code = 'or-IN';
    confirmation_speech = `ଆପଣଙ୍କ ସମସ୍ୟା ${cleanVill}, ${cleanMand} ରେ ଅଛି କି? ସଠିକ୍ ହେଲେ ସବୁଜ ବଟନ୍ (Green) ଏବଂ ଭୁଲ୍ ହେଲେ ଲାଲ୍ ବଟନ୍ (Red) କ୍ଲିକ୍ କରନ୍ତୁ।`;
  } else if (pLang.includes('ml') || pLang.includes('malayalam') || /[\u0D00-\u0D7F]/.test(rawNote)) {
    detected_language = 'Malayalam';
    bcp47_code = 'ml-IN';
    confirmation_speech = `നിങ്ങളുടെ പ്രശ്നം ${cleanVill}, ${cleanMand} ൽ തന്നെയാണോ? ശരിയാണെങ്കിൽ പച്ച ബട്ടൺ (Green), അല്ലെങ്കിൽ ചുവപ്പ് ബട്ടൺ (Red) അമർത്തുക.`;
  } else if (pLang.includes('pa') || pLang.includes('punjabi') || /[\u0A00-\u0A7F]/.test(rawNote)) {
    detected_language = 'Punjabi';
    bcp47_code = 'pa-IN';
    confirmation_speech = `ਕੀ ਤੁਹਾਡੀ ਸਮੱਸਿਆ ${cleanVill}, ${cleanMand} ਵਿੱਚ ਹੀ ਹੈ? ਜੇਕਰ ਸਹੀ ਹੈ ਤਾਂ ਹਰਾ ਬਟਨ (Green), ਨਹੀਂ ਤਾਂ ਲਾਲ ਬਟਨ (Red) ਦਬਓ।`;
  } else if (pLang.includes('as') || pLang.includes('assamese')) {
    detected_language = 'Assamese';
    bcp47_code = 'as-IN';
    confirmation_speech = `আপোনাৰ समस्याটো ${cleanVill}, ${cleanMand} ত আছেনে? শুদ্ধ হ’લે সেউজীয়া বুটাম (Green) আৰু ভুল হ’લે ৰঙা বুটাম (Red) টিপক।`;
  }

  // Multilingual Regex Engine
  const drainageRegex = /\b(rainwater|flooded)\b|ಚರಂಡಿ|ಚರಂಡಿಯ|\b(drainage|sewer|sewerage|waterlogging|waterlog|overflow|overflowing|kanal|gutter|mori|scum|kaluva|clogged|stagnant|drain|drains|manhole|open drain|desilting|sludge|nala|sewage|rainwater blockage)\b|డ్రైనేజీ|డ్రైనేజి|కాల్వ|కాలువ|మోరీ|మురికినీరు|చెత్తనీరు|మురుగు|నాలీ|మ్యాన్ హోల్|మ్యాన్‌హోల్ మూత|మురుగు నీరు ఇళ్లలోకి|కాలువ పూడిక|డ్రైనేజీ పొంగిపారడం|नालियां|गटर|ड्रेनेज|सीवर|गंदा पानी|सांडपाणी|मैनहोल|ढक्कन|சாக்கடை|வடிகால்|கழிவுநீர்|சாக்கடை நீர்|மேன்ஹோல்|மூடி|நর্দমা|ড্রেনেজ|পয়ঃনিষ্কাশন|ড্রেনের|গটার|ગટર|ગંદુ પાણી|નાળુ|નાલી|ନଳା|ଡ୍ରେନେଜ୍|ଗଟର|ନଳାର|ഓട|ഡ്രെയിനേജ്|അഴുക്കുചാൽ|ഓടയിലെ|ਨਾਲ਼ਾ|ਨਲਾ|ਸੀਵਰ|ਚਰಂಡਿ|ਚਰಂಡੀ/i;
  const electricityRegex = /\b(street light|dark lane)\b|\b(current|electric|electricity|wire|wires|light|lights|power|transformer|bijli|mains|deepalu|dipamu|karanthu|spark|sparking|pole|poles|voltage|outage|shock|fire|flue|meter|feeder|voltage drop|cable|live wire|short circuit|current wire|power cut|street light)\b|కరెంట్|కరెంటు|విద్యుత్|విధ్యుత్|దీపాలు|స్తంభం|లైట్|లైట్లు|వైర్|ట్రాన్స్‌ఫార్మర్|షాక్|మంటలు|స్పార్క్|కరెంట్ వైర్|ఒరిగిన స్తంభం|కరెంట్ పోయింది|వోల్టేజ్ తక్కువ|కరెంట్ షాక్|స్ట్రీట్ లైట్|बिजली|करंत|पावर|तार|खंभा|ट्रांसफार्मर|चिंगारी|वीज|वीजळी|सबस्टेशन|ट्रान्सफॉर्मर|ठिणग्या|अग्ग|மின்சார|மின்சாரம்|கரண்ட்|லைட்|தெரு விளக்கு|மின் கம்பம்|மின்சார ஒயர்|மின்மாற்றி|தீப்பொறி|বিদ্যুৎ|বিদ্যুতের|কারেন্ট|আলো|তাঁৰ|খুঁটা|વિજળી|બિજલી|વાયર|થાંભલો|બિજુଳિ|ଲାଇଟ୍|\bତାର\b|ଖୁଣ୍ଟ|ବିଜୁଳି|ਕਰੰਟ|ਤਾਰ|ਖੰਭਾ|ਟ੍ਰਾਂਸਫਾਰਮਰ|ਅੱਗ|വൈദ്യുതി|കറന്റ്|ലൈറ്റ്|പോസ്റ്റ്|ವಿದ್ಯುತ್|ದೀಪ|ತಂತಿ|ಕಂಬ/i;
  const waterRegex = /\b(underwater|pipeline|borewell|drinking|tank|tanker|neeru|paani|thanneer|water|leak|leakage|nillu|neellu|tap|pipe|pipes|ro plant|submersible|pump|motor|contamination|dirty water|muddy water|chlorine|water cut|low pressure|reservoir|valve|sump|tap water|river pipeline|underwater pipe|water supply)\b|నీళ్ళు|నీళ్లు|మంచి నీళ్ళు|మంచినీరు|పైపు|పైప్‌లైన్|టాప్|బోరు|ట్యాంకర్|వాటర్|పానీ|కలుషిత నీరు|నీటి లీకేజ్|పైపు పగిలింది|బోరు మోటార్|తాగునీరు|సబ్‌మర్సిబుల్|ట్యాంకర్ రావడం లేదు|నీటి సరఫరా|पानी|जल|नल|पाइप|पाणी|पिण्याचे पाणी|जल आपूर्ति|தண்ணீர்|குடிநீர்|குழாய்|நீர்|জল|পানি|পানীয় জল|পাইভ|પાણી|જળ|પાઇપ|પીવાનું પાણી|ପାଣି|ଜଳ|ପାଇପ୍|ପିଇବା ପାଣି|വെള്ളം|കുടിവെള്ളം|പൈപ്പ്|ਪਾਣੀ|ਜਲ|ਨਲਕਾ|ਪੀਣ ਵਾਲਾ ਪਾਣੀ|খোৱਾ ਪানী|পাইਪ|ನೀರು|ಕುಡಿಯುವ ನೀರು|ನಳ|ಪೈಪ್/i;
  const sanitationRegex = /\b(garbage|waste|clean|cleaning|smell|dump|dumping|dustbin|kachra|dirty|chetta|chethha|durgandham|litter|trash|stink|unclean|dead animal|carcass|sweeper|sweeping|hygiene|plastic waste|public toilet|foul smell|waste heap)\b|చెత్త|చెత్తా|దుర్గంధం|పరిశుభ్రత|డస్ట్ బిన్|వ్యర్థాలు|చచ్చిన జంతువు|కచరా|చెత్త కుప్పలు|చెత్త వాసన|చెత్త బండి రావడం లేదు|పరిశుభ్రత లేదు|कचरा|गंदगी|सफाई|डस्टबिन|कूड़ा|घाण|दुर्गंधी|குப்பை|கழிவு|சுகாதாரம்|துர்நாற்றம்|ময়লা|আবর্জனா|পরিষ্কার|জাবৰ|કચરો|ગંદકી|સફાઈ|અળિઆ|ଆବર્ଜନା|ସଫେଇ|ਕੂੜਾ|ਗੰਦਗੀ|ਅਹੁੱਕ|മാലിന്യം|ശുചിത്വം|കസ|ತ್ಯಾಜ್ಯ|ನೈರ್ಮಲ್ಯ/i;
  const roadsRegex = /\b(ଖାଲ|ରାସ୍ତାରେ)\b|ବଡ ଖାଲ|ରାସ୍ତାରେ|ଖାଲ|ରାସ୍ତାରେ|\b(road|roads|pothole|potholes|bridge|street|highway|construction|roddulu|gundalu|bata|dhaari|tar road|asphalt|cave-in|culvert|speed breaker|footpath|pavement|median|divider|pothole hazard)\b|రోడ్డు|రోడ్లు|గుంతలు|గోతులు|బాట|దారి|వంతెన|రోడ్డు గుంతలు|రోడ్డు పగిలిపోయింది|స్పీడ్ బ్రేకర్|కల్వర్టు|బాట దారి|సड़क|सडक|गड्ढा|गड्ढे|पुल|रास्ता|मार्ग|रस्ता|टूटी सड़क|बारिश से सड़क|சாலை|பள்ளம்|பாலம்|தெரு|பாதை|பாலத்தில்|சாலையில்|ராસ્તા|ગર્વ|બ્રીજ|સડક|રાસ્તાય|સડક|રસ્તો|ખાડા|પુલ|ରାସ୍ତା|ଖାଲ|ପୋଲ|ସੜକ|ਟੋਏ|ਪੁል|റോഡ്|കുഴികൾ|പാലം|റോഡിൽ|ರಸ್ತೆ|ಗುಂಡಿ|ಸೇತುವೆ|ರಸ್ತೆಯಲ್ಲಿ|ରାସ୍තାରେ/i;
  const unmappedOtherRegex = /\b(hospital|doctor|school|teacher|stray dog|monkey|snake|bus stop|bus delay|forest|tree cutting|land boundary|encroachment|police|fire station|revenue)\b|ఆసుపత్రి|డాక్టర్|బడి|స్కూలు|పిచ్చి కుక్కలు|పాము|అడవి|చెట్లు నరకడం|స్థలం ఆక్రమణ|అగ్ని ప్రమాదం|अस्पताल|स्कूल|कुत्ते|सांप|सरकारी बस|மருத்துவமனை|பள்ளி|நாய்கள்|হাসপাতাল|স্কুল|હોસ્પિટલ|શાળા|ଡାକ୍ତରଖାନା|ସ୍କୁଲ୍|ଆଶുപത്രി|സ്കൂൾ|ਸਰਕਾਰੀ ഹസപതാല|ਸਕੂਲ|ଆಸ್ಪತ್ರೆ|ಶಾಲೆ/i;

  let matchedDepts = [];

  if (roadsRegex.test(lowerNote) || roadsRegex.test(rawNote)) {
    const dept = availableDepts.find(d => d.name.toLowerCase().includes('road')) || { id: 3, name: 'Roads & Infrastructure' };
    matchedDepts.push({ id: dept.id, name: dept.name });
  }
  if (drainageRegex.test(lowerNote) || drainageRegex.test(rawNote)) {
    const dept = availableDepts.find(d => d.name.toLowerCase().includes('drain')) || { id: 5, name: 'Drainage Management' };
    matchedDepts.push({ id: dept.id, name: dept.name });
  }
  if (electricityRegex.test(lowerNote) || electricityRegex.test(rawNote)) {
    const dept = availableDepts.find(d => d.name.toLowerCase().includes('electric') || d.name.toLowerCase().includes('light') || d.name.toLowerCase().includes('power')) || { id: 2, name: 'Electricity Board' };
    matchedDepts.push({ id: dept.id, name: dept.name });
  }
  if (sanitationRegex.test(lowerNote) || sanitationRegex.test(rawNote)) {
    const dept = availableDepts.find(d => d.name.toLowerCase().includes('sanitation')) || { id: 4, name: 'Sanitation & Waste Management' };
    matchedDepts.push({ id: dept.id, name: dept.name });
  }
  if (waterRegex.test(lowerNote) || waterRegex.test(rawNote)) {
    const isOnlySewageWater = /sewage water|drainage water|dirty water from drain|మురుగు నీరు|మురుగునీరు|చెత్తనీరు|సాక్కటై నీర్|சாக்கடை நீர்|ড্রে নের পানি|ગટરનું પાણી/i.test(rawNote) && !/drinking|drinking water|pipeline|borewell|tanker|tap|మంచి నీళ్ళు|తాగునీరు|కుടിവെള്ളം|પીવાનું પાણી|ପିଇବା ପାଣି/i.test(rawNote);
    if (!isOnlySewageWater) {
      const dept = availableDepts.find(d => d.name.toLowerCase().includes('water')) || { id: 1, name: 'Water Supply' };
      matchedDepts.push({ id: dept.id, name: dept.name });
    }
  }

  // Deduplicate matchedDepts
  const uniqueMatchedDepts = [];
  const seenIds = new Set();
  matchedDepts.forEach(d => {
    if (!seenIds.has(d.id)) {
      seenIds.add(d.id);
      uniqueMatchedDepts.push(d);
    }
  });

  let primaryCategory = uniqueMatchedDepts[0] || { id: 1, name: 'Water Supply' };
  if (uniqueMatchedDepts.length === 0) {
    if (unmappedOtherRegex.test(lowerNote) || unmappedOtherRegex.test(rawNote)) {
      primaryCategory = { id: 99, name: 'General Civic & Public Health Cell' };
    }
    uniqueMatchedDepts.push(primaryCategory);
  }

  const category_id = primaryCategory.id;
  const category_name = primaryCategory.name;
  const isMultiDepartment = uniqueMatchedDepts.length > 1;
  const multiDepartmentNames = uniqueMatchedDepts.map(d => d.name).join(' & ');

  let summary = `Grievance reported for ${cleanVill}, ${cleanMand}.`;
  if (isMultiDepartment) {
    summary = `MULTI-DEPARTMENT INCIDENT (${multiDepartmentNames}): Combined grievance reported in ${cleanVill}, ${cleanMand}. Parallel field dispatch initiated for ${uniqueMatchedDepts.length} officers.`;
  } else {
    summary = `${category_name} grievance reported in ${cleanVill}, ${cleanMand}. Inspection and field action requested.`;
  }

  let severity = 'MODERATE';
  const emergencyPattern = /live wire|current wire|shock|fire|blast|explosion|gas leak|danger|accident|pipe burst|breaking|flood|house|home|hospital|school|fatal|death|collapsed|3 days|4 days|5 days|four days|three days|several days|కరెంట్ వైర్|షాక్|మంటలు|స్పార్క్|అపాయం|ప్రమాదం|అత్యవసరం|ఇళ్లలోకి|ఇంట్లోకి|చనిపోయిన|కూలిపోయింది|నాలుగు రోజు|మూడు రోజు|రోజుల నుండి|సమస్య తీవ్రంగా|షాక్ కొడుతోంది|సమీపంలో ఉంటే/i;
  const mildPattern = /dim|flicker|small|minor|routine|grass|bushes|inquiry|request|single light|ఒక్క లైటు|చిన్న|సాధారణ|మెయింటెనెన్స్|సలహా/i;

  if (emergencyPattern.test(lowerNote) || emergencyPattern.test(rawNote)) {
    severity = 'EMERGENCY';
    summary = `CRITICAL EMERGENCY: ${summary} Priority risk score assigned.`;
  } else if (mildPattern.test(lowerNote) || mildPattern.test(rawNote)) {
    severity = 'MILD';
    summary = `ROUTINE MAINTENANCE: ${summary} Standard risk score assigned.`;
  } else {
    severity = 'MODERATE';
  }

  return {
    detected_language,
    bcp47_code,
    confirmation_speech,
    category_id,
    category_name,
    is_multi_department: isMultiDepartment,
    matched_departments: uniqueMatchedDepts,
    multi_department_names: multiDepartmentNames,
    severity,
    ai_summary: summary
  };
}

module.exports = {
  analyzeGrievance,
  translateOfficerUpdate,
  localGrievanceAnalysis
};
