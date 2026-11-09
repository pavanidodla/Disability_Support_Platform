// Names of the 80 objects COCO-SSD can detect, in each language (keys are the English class names)
const hi = {
  person: "व्यक्ति", bicycle: "साइकिल", car: "कार", motorcycle: "मोटरसाइकिल", airplane: "हवाई जहाज़", bus: "बस", train: "ट्रेन", truck: "ट्रक", boat: "नाव",
  "traffic light": "ट्रैफ़िक लाइट", "fire hydrant": "फ़ायर हाइड्रेंट", "stop sign": "स्टॉप साइन", "parking meter": "पार्किंग मीटर", bench: "बेंच", bird: "पक्षी", cat: "बिल्ली", dog: "कुत्ता", horse: "घोड़ा", sheep: "भेड़", cow: "गाय", elephant: "हाथी", bear: "भालू", zebra: "ज़ेबरा", giraffe: "जिराफ़",
  backpack: "बैकपैक", umbrella: "छाता", handbag: "हैंडबैग", tie: "टाई", suitcase: "सूटकेस", frisbee: "फ्रिसबी", skis: "स्की", snowboard: "स्नोबोर्ड", "sports ball": "गेंद", kite: "पतंग",
  "baseball bat": "बेसबॉल बैट", "baseball glove": "बेसबॉल दस्ताना", skateboard: "स्केटबोर्ड", surfboard: "सर्फ़बोर्ड", "tennis racket": "टेनिस रैकेट", bottle: "बोतल", "wine glass": "वाइन ग्लास", cup: "कप", fork: "कांटा", knife: "चाकू", spoon: "चम्मच", bowl: "कटोरा",
  banana: "केला", apple: "सेब", sandwich: "सैंडविच", orange: "संतरा", broccoli: "ब्रोकोली", carrot: "गाजर", "hot dog": "हॉट डॉग", pizza: "पिज़्ज़ा", donut: "डोनट", cake: "केक",
  chair: "कुर्सी", couch: "सोफ़ा", "potted plant": "गमले का पौधा", bed: "बिस्तर", "dining table": "खाने की मेज़", toilet: "शौचालय", tv: "टीवी", laptop: "लैपटॉप", mouse: "माउस", remote: "रिमोट", keyboard: "कीबोर्ड", "cell phone": "मोबाइल फ़ोन",
  microwave: "माइक्रोवेव", oven: "ओवन", toaster: "टोस्टर", sink: "सिंक", refrigerator: "फ्रिज", book: "किताब", clock: "घड़ी", vase: "फूलदान", scissors: "कैंची", "teddy bear": "टेडी बियर", "hair drier": "हेयर ड्रायर", toothbrush: "टूथब्रश",
};

const te = {
  person: "వ్యక్తి", bicycle: "సైకిల్", car: "కారు", motorcycle: "మోటార్ సైకిల్", airplane: "విమానం", bus: "బస్సు", train: "రైలు", truck: "ట్రక్కు", boat: "పడవ",
  "traffic light": "ట్రాఫిక్ లైట్", "fire hydrant": "ఫైర్ హైడ్రాంట్", "stop sign": "స్టాప్ సైన్", "parking meter": "పార్కింగ్ మీటర్", bench: "బెంచి", bird: "పక్షి", cat: "పిల్లి", dog: "కుక్క", horse: "గుర్రం", sheep: "గొర్రె", cow: "ఆవు", elephant: "ఏనుగు", bear: "ఎలుగుబంటి", zebra: "జీబ్రా", giraffe: "జిరాఫీ",
  backpack: "బ్యాక్‌ప్యాక్", umbrella: "గొడుగు", handbag: "హ్యాండ్‌బ్యాగ్", tie: "టై", suitcase: "సూట్‌కేస్", frisbee: "ఫ్రిస్బీ", skis: "స్కీస్", snowboard: "స్నోబోర్డ్", "sports ball": "బంతి", kite: "గాలిపటం",
  "baseball bat": "బేస్‌బాల్ బ్యాట్", "baseball glove": "బేస్‌బాల్ గ్లోవ్", skateboard: "స్కేట్‌బోర్డ్", surfboard: "సర్ఫ్‌బోర్డ్", "tennis racket": "టెన్నిస్ రాకెట్", bottle: "సీసా", "wine glass": "వైన్ గ్లాస్", cup: "కప్పు", fork: "ఫోర్క్", knife: "కత్తి", spoon: "చెంచా", bowl: "గిన్నె",
  banana: "అరటిపండు", apple: "ఆపిల్", sandwich: "శాండ్‌విచ్", orange: "నారింజ", broccoli: "బ్రోకలీ", carrot: "క్యారెట్", "hot dog": "హాట్ డాగ్", pizza: "పిజ్జా", donut: "డోనట్", cake: "కేక్",
  chair: "కుర్చీ", couch: "సోఫా", "potted plant": "కుండీలో మొక్క", bed: "మంచం", "dining table": "భోజనం బల్ల", toilet: "టాయిలెట్", tv: "టీవీ", laptop: "ల్యాప్‌టాప్", mouse: "మౌస్", remote: "రిమోట్", keyboard: "కీబోర్డ్", "cell phone": "మొబైల్ ఫోన్",
  microwave: "మైక్రోవేవ్", oven: "ఓవెన్", toaster: "టోస్టర్", sink: "సింక్", refrigerator: "ఫ్రిజ్", book: "పుస్తకం", clock: "గడియారం", vase: "పూలకుండీ", scissors: "కత్తెర", "teddy bear": "టెడ్డీ బేర్", "hair drier": "హెయిర్ డ్రైయర్", toothbrush: "టూత్‌బ్రష్",
};

const ta = {
  person: "நபர்", bicycle: "மிதிவண்டி", car: "கார்", motorcycle: "மோட்டார் சைக்கிள்", airplane: "விமானம்", bus: "பேருந்து", train: "ரயில்", truck: "லாரி", boat: "படகு",
  "traffic light": "போக்குவரத்து விளக்கு", "fire hydrant": "தீ ஹைட்ரன்ட்", "stop sign": "நிறுத்த அடையாளம்", "parking meter": "பார்க்கிங் மீட்டர்", bench: "பெஞ்ச்", bird: "பறவை", cat: "பூனை", dog: "நாய்", horse: "குதிரை", sheep: "ஆடு", cow: "பசு", elephant: "யானை", bear: "கரடி", zebra: "வரிக்குதிரை", giraffe: "ஒட்டகச்சிவிங்கி",
  backpack: "முதுகுப்பை", umbrella: "குடை", handbag: "கைப்பை", tie: "டை", suitcase: "சூட்கேஸ்", frisbee: "ஃப்ரிஸ்பீ", skis: "ஸ்கீஸ்", snowboard: "ஸ்னோபோர்டு", "sports ball": "பந்து", kite: "பட்டம்",
  "baseball bat": "பேஸ்பால் மட்டை", "baseball glove": "பேஸ்பால் கையுறை", skateboard: "ஸ்கேட்போர்டு", surfboard: "சர்ஃப்போர்டு", "tennis racket": "டென்னிஸ் மட்டை", bottle: "பாட்டில்", "wine glass": "ஒயின் கிளாஸ்", cup: "கோப்பை", fork: "முள்கரண்டி", knife: "கத்தி", spoon: "கரண்டி", bowl: "கிண்ணம்",
  banana: "வாழைப்பழம்", apple: "ஆப்பிள்", sandwich: "சாண்ட்விச்", orange: "ஆரஞ்சு", broccoli: "ப்ரோக்கோலி", carrot: "கேரட்", "hot dog": "ஹாட் டாக்", pizza: "பீட்சா", donut: "டோனட்", cake: "கேக்",
  chair: "நாற்காலி", couch: "சோபா", "potted plant": "தொட்டிச் செடி", bed: "படுக்கை", "dining table": "உணவு மேஜை", toilet: "கழிப்பறை", tv: "தொலைக்காட்சி", laptop: "மடிக்கணினி", mouse: "மவுஸ்", remote: "ரிமோட்", keyboard: "விசைப்பலகை", "cell phone": "கைபேசி",
  microwave: "மைக்ரோவேவ்", oven: "ஓவன்", toaster: "டோஸ்டர்", sink: "சிங்க்", refrigerator: "குளிர்சாதனப் பெட்டி", book: "புத்தகம்", clock: "கடிகாரம்", vase: "பூச்சாடி", scissors: "கத்தரிக்கோல்", "teddy bear": "டெடி பியர்", "hair drier": "ஹேர் டிரையர்", toothbrush: "பல் துலக்கி",
};

const LABELS = { hi, te, ta };

// objectLabel("Cell phone", "hi") -> "मोबाइल फ़ोन"; unknown labels stay as they are
export function objectLabel(label, lang) {
  const map = LABELS[lang];
  if (!map) return label;
  return map[String(label).toLowerCase()] ?? label;
}
