/**
 * काव्यकलश (KavyaVault) — Navigation Data Model
 * Single source of truth for routing, primary, secondary, and mobile navigation items.
 */

export const ROUTES = {
  HOME: '/',
  POEMS: '/poems',
  FAVORITES: '/favorites',
  COLLECTIONS: '/collections',
  SEARCH: '/search',
  ARCHIVE: '/archive',
  SETTINGS: '/settings',
  NEW_POEM: '/poems/new',
  TYPOGRAPHY_TEST: '/typography-test',
  PERSISTENCE_TEST: '/persistence-test'
};

export const NAVIGATION_ITEMS = [
  {
    id: 'home',
    path: ROUTES.HOME,
    label: 'होम',
    mobileLabel: 'होम',
    enLabel: 'Home',
    icon: 'home',
    description: 'मुख्य द्वार एवं आज की रचना'
  },
  {
    id: 'poems',
    path: ROUTES.POEMS,
    label: 'मेरी कविताएँ',
    mobileLabel: 'कविताएँ',
    enLabel: 'My Poems',
    icon: 'book',
    description: 'काव्य पुस्तकालय एवं संपूर्ण रचनाएँ'
  },
  {
    id: 'favorites',
    path: ROUTES.FAVORITES,
    label: 'पसंदीदा',
    mobileLabel: 'पसंदीदा',
    enLabel: 'Favorites',
    icon: 'heart',
    description: 'संजोई हुई प्रिय रचनाएँ'
  },
  {
    id: 'collections',
    path: ROUTES.COLLECTIONS,
    label: 'संग्रह',
    mobileLabel: 'संग्रह',
    enLabel: 'Collections',
    icon: 'collection',
    description: 'रस, भाव एवं विधा अनुसार वर्गीकरण'
  },
  {
    id: 'search',
    path: ROUTES.SEARCH,
    label: 'खोज',
    mobileLabel: 'खोज',
    enLabel: 'Search',
    icon: 'search',
    description: 'पंक्तियों एवं रचनाकारों का अन्वेषण'
  },
  {
    id: 'archive',
    path: ROUTES.ARCHIVE,
    label: 'अभिलेख',
    mobileLabel: 'अभिलेख',
    enLabel: 'Archive',
    icon: 'archive',
    description: 'सुरक्षित सहेजा गया साहित्यिक संदूक'
  },
  {
    id: 'settings',
    path: ROUTES.SETTINGS,
    label: 'सेटिंग्स',
    mobileLabel: 'सेटिंग्स',
    enLabel: 'Settings',
    icon: 'settings',
    description: 'सज्जा, विषय-रंग एवं मुद्रण प्राथमिकताएँ'
  },
  {
    id: 'new-poem',
    path: ROUTES.NEW_POEM,
    label: 'नई कविता',
    mobileLabel: 'लिखें',
    enLabel: 'New Poem',
    icon: 'quill',
    isAction: true,
    description: 'एकांत लेखन कक्ष में नई रचना लिखें'
  }
];

// Desktop navigation groupings derived from single source of truth
export const DESKTOP_PRIMARY_ITEMS = NAVIGATION_ITEMS.filter(item => 
  ['home', 'poems', 'favorites', 'collections', 'search'].includes(item.id)
);

export const DESKTOP_SECONDARY_ITEMS = NAVIGATION_ITEMS.filter(item => 
  ['archive', 'settings'].includes(item.id)
);

export const DESKTOP_ACTION_ITEM = NAVIGATION_ITEMS.find(item => item.id === 'new-poem');

// Mobile bottom navigation bar items (5 primary touch points including center quill action)
export const MOBILE_NAV_ITEMS = [
  NAVIGATION_ITEMS.find(item => item.id === 'home'),
  NAVIGATION_ITEMS.find(item => item.id === 'poems'),
  NAVIGATION_ITEMS.find(item => item.id === 'new-poem'), // Prominent center action
  NAVIGATION_ITEMS.find(item => item.id === 'favorites'),
  NAVIGATION_ITEMS.find(item => item.id === 'search')
];

// Mobile secondary menu items (accessible via mobile header drawer)
export const MOBILE_DRAWER_ITEMS = NAVIGATION_ITEMS.filter(item => 
  ['collections', 'archive', 'settings'].includes(item.id)
);

// Route metadata for page titles and accessible descriptions
export const ROUTE_METADATA = {
  [ROUTES.HOME]: {
    title: 'होम',
    tagline: 'आज की रचना एवं एकांत काव्य-संसार',
    placeholder: 'जल्द ही आपका काव्य-संसार यहाँ दिखाई देगा।'
  },
  [ROUTES.POEMS]: {
    title: 'मेरी कविताएँ',
    tagline: 'समस्त रचनाओं का निजी पुस्तकालय',
    placeholder: 'आपका निजी काव्य-संग्रह यहाँ प्रस्तुत होगा।'
  },
  [ROUTES.FAVORITES]: {
    title: 'पसंदीदा रचनाएँ',
    tagline: 'संजोए गए प्रिय दोहे, ग़ज़लें एवं छंद',
    placeholder: 'आपके द्वारा संजोई गई प्रिय रचनाएँ यहाँ मिलेंगी।'
  },
  [ROUTES.COLLECTIONS]: {
    title: 'काव्य संग्रह व भाव',
    tagline: 'नवरस, ग़ज़ल, दोहा, मुक्तक एवं छंद',
    placeholder: 'रस, भाव एवं विधा अनुसार काव्य वर्गीकरण यहाँ दिखाई देगा।'
  },
  [ROUTES.SEARCH]: {
    title: 'काव्य अन्वेषण',
    tagline: 'शब्दों, भावों एवं पंक्तियों की खोज',
    placeholder: 'पंक्तियों, शीर्षकों एवं कवियों का अन्वेषण यहाँ उपलब्ध होगा।'
  },
  [ROUTES.ARCHIVE]: {
    title: 'साहित्यिक अभिलेख',
    tagline: 'सुरक्षित सहेजी गई पुरानी रचनाएँ',
    placeholder: 'सहेजी गई रचनाओं का संदूक यहाँ उपलब्ध होगा।'
  },
  [ROUTES.SETTINGS]: {
    title: 'सज्जा व व्यवस्था',
    tagline: 'काव्य पठन मुद्रणकला व विषय-रंग',
    placeholder: 'सज्जा, फॉन्ट एवं व्यक्तिगत प्राथमिकताएं यहाँ प्रबंधित होंगी।'
  },
  [ROUTES.NEW_POEM]: {
    title: 'नई रचना',
    tagline: 'एकांत, ध्यानमग्न लेखन कक्ष',
    placeholder: 'एकांत लेखन कक्ष एवं देवनागरी अक्षर सहायिका जल्द ही उपलब्ध होगी।'
  },
  [ROUTES.TYPOGRAPHY_TEST]: {
    title: 'मुद्रणकला परीक्षण',
    tagline: 'Devanagari Typography & Reading Validation',
    placeholder: 'देवनागरी मुद्रणकला, मात्रा, संयुक्ताक्षर एवं ऊर्ध्वाधर लय की जाँच।'
  },
  [ROUTES.PERSISTENCE_TEST]: {
    title: 'भंडारण परीक्षण',
    tagline: 'Persistence & Repository Diagnostic',
    placeholder: 'स्थानीय भंडारण, रिपॉजिटरी चक्र एवं स्वतः डेटा निष्कासन की जाँच।'
  }
};
