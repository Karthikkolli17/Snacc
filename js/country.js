const COUNTRIES = [
  {code:'US',name:'United States'},{code:'KR',name:'South Korea'},{code:'JP',name:'Japan'},
  {code:'GB',name:'United Kingdom'},{code:'CA',name:'Canada'},{code:'MX',name:'Mexico'},
  {code:'AU',name:'Australia'},{code:'DE',name:'Germany'},{code:'FR',name:'France'},
  {code:'IT',name:'Italy'},{code:'ES',name:'Spain'},{code:'BR',name:'Brazil'},
  {code:'IN',name:'India'},{code:'CN',name:'China'},{code:'TW',name:'Taiwan'},
  {code:'TH',name:'Thailand'},{code:'VN',name:'Vietnam'},{code:'PH',name:'Philippines'},
  {code:'ID',name:'Indonesia'},{code:'MY',name:'Malaysia'},{code:'SG',name:'Singapore'},
  {code:'NZ',name:'New Zealand'},{code:'SE',name:'Sweden'},{code:'NO',name:'Norway'},
  {code:'DK',name:'Denmark'},{code:'FI',name:'Finland'},{code:'NL',name:'Netherlands'},
  {code:'BE',name:'Belgium'},{code:'CH',name:'Switzerland'},{code:'AT',name:'Austria'},
  {code:'PT',name:'Portugal'},{code:'IE',name:'Ireland'},{code:'PL',name:'Poland'},
  {code:'CZ',name:'Czech Republic'},{code:'HU',name:'Hungary'},{code:'GR',name:'Greece'},
  {code:'TR',name:'Turkey'},{code:'IL',name:'Israel'},{code:'AE',name:'UAE'},
  {code:'SA',name:'Saudi Arabia'},{code:'EG',name:'Egypt'},{code:'ZA',name:'South Africa'},
  {code:'NG',name:'Nigeria'},{code:'KE',name:'Kenya'},{code:'CO',name:'Colombia'},
  {code:'AR',name:'Argentina'},{code:'CL',name:'Chile'},{code:'PE',name:'Peru'},
  {code:'RU',name:'Russia'},{code:'UA',name:'Ukraine'},{code:'RO',name:'Romania'},
  {code:'HK',name:'Hong Kong'},{code:'PK',name:'Pakistan'},{code:'BD',name:'Bangladesh'},
  {code:'LK',name:'Sri Lanka'},{code:'NP',name:'Nepal'},{code:'MM',name:'Myanmar'},
  {code:'KH',name:'Cambodia'},{code:'LA',name:'Laos'},
];

const _countryMap = {};
COUNTRIES.forEach(c => _countryMap[c.code] = c.name);

const _tzToCountry = {
  'America/New_York':'US','America/Chicago':'US','America/Denver':'US','America/Los_Angeles':'US',
  'America/Anchorage':'US','America/Phoenix':'US','America/Adak':'US','America/Boise':'US',
  'America/Detroit':'US','America/Indiana/Indianapolis':'US','America/Indiana/Knox':'US',
  'America/Indiana/Marengo':'US','America/Indiana/Petersburg':'US','America/Indiana/Tell_City':'US',
  'America/Indiana/Vevay':'US','America/Indiana/Vincennes':'US','America/Indiana/Winamac':'US',
  'America/Juneau':'US','America/Kentucky/Louisville':'US','America/Kentucky/Monticello':'US',
  'America/Menominee':'US','America/Metlakatla':'US','America/Nome':'US',
  'America/North_Dakota/Beulah':'US','America/North_Dakota/Center':'US',
  'America/North_Dakota/New_Salem':'US','America/Sitka':'US','America/Yakutat':'US',
  'Pacific/Honolulu':'US',
  'America/Toronto':'CA','America/Vancouver':'CA','America/Winnipeg':'CA','America/Edmonton':'CA',
  'America/Halifax':'CA','America/St_Johns':'CA','America/Regina':'CA',
  'America/Mexico_City':'MX','America/Cancun':'MX','America/Monterrey':'MX','America/Tijuana':'MX',
  'Europe/London':'GB','Europe/Dublin':'IE','Europe/Paris':'FR','Europe/Berlin':'DE',
  'Europe/Rome':'IT','Europe/Madrid':'ES','Europe/Lisbon':'PT','Europe/Amsterdam':'NL',
  'Europe/Brussels':'BE','Europe/Zurich':'CH','Europe/Vienna':'AT','Europe/Stockholm':'SE',
  'Europe/Oslo':'NO','Europe/Copenhagen':'DK','Europe/Helsinki':'FI','Europe/Warsaw':'PL',
  'Europe/Prague':'CZ','Europe/Budapest':'HU','Europe/Athens':'GR','Europe/Bucharest':'RO',
  'Europe/Istanbul':'TR','Europe/Kiev':'UA','Europe/Moscow':'RU',
  'Asia/Tokyo':'JP','Asia/Seoul':'KR','Asia/Shanghai':'CN','Asia/Hong_Kong':'HK',
  'Asia/Taipei':'TW','Asia/Singapore':'SG','Asia/Kuala_Lumpur':'MY','Asia/Bangkok':'TH',
  'Asia/Ho_Chi_Minh':'VN','Asia/Manila':'PH','Asia/Jakarta':'ID','Asia/Kolkata':'IN',
  'Asia/Colombo':'LK','Asia/Karachi':'PK','Asia/Dhaka':'BD','Asia/Kathmandu':'NP',
  'Asia/Yangon':'MM','Asia/Phnom_Penh':'KH','Asia/Vientiane':'LA',
  'Asia/Dubai':'AE','Asia/Riyadh':'SA','Asia/Jerusalem':'IL',
  'Australia/Sydney':'AU','Australia/Melbourne':'AU','Australia/Brisbane':'AU',
  'Australia/Perth':'AU','Australia/Adelaide':'AU','Australia/Hobart':'AU',
  'Pacific/Auckland':'NZ',
  'America/Sao_Paulo':'BR','America/Argentina/Buenos_Aires':'AR','America/Santiago':'CL',
  'America/Lima':'PE','America/Bogota':'CO',
  'Africa/Cairo':'EG','Africa/Johannesburg':'ZA','Africa/Lagos':'NG','Africa/Nairobi':'KE',
};

function detectCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return _tzToCountry[tz] || null;
  } catch { return null; }
}

function countryName(code) {
  return _countryMap[code] || code;
}

function countryFlag(code) {
  return code ? code.toUpperCase() : '';
}
