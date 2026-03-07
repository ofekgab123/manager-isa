import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const COUNTRIES = [
  // Most common first
  { code: '+972', flag: '🇮🇱', name: 'Israel' },
  { code: '+1',   flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+44',  flag: '🇬🇧', name: 'UK' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  // Europe
  { code: '+49',  flag: '🇩🇪', name: 'Germany' },
  { code: '+33',  flag: '🇫🇷', name: 'France' },
  { code: '+39',  flag: '🇮🇹', name: 'Italy' },
  { code: '+34',  flag: '🇪🇸', name: 'Spain' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+31',  flag: '🇳🇱', name: 'Netherlands' },
  { code: '+32',  flag: '🇧🇪', name: 'Belgium' },
  { code: '+41',  flag: '🇨🇭', name: 'Switzerland' },
  { code: '+43',  flag: '🇦🇹', name: 'Austria' },
  { code: '+46',  flag: '🇸🇪', name: 'Sweden' },
  { code: '+47',  flag: '🇳🇴', name: 'Norway' },
  { code: '+45',  flag: '🇩🇰', name: 'Denmark' },
  { code: '+358', flag: '🇫🇮', name: 'Finland' },
  { code: '+48',  flag: '🇵🇱', name: 'Poland' },
  { code: '+7',   flag: '🇷🇺', name: 'Russia' },
  { code: '+380', flag: '🇺🇦', name: 'Ukraine' },
  { code: '+30',  flag: '🇬🇷', name: 'Greece' },
  { code: '+420', flag: '🇨🇿', name: 'Czech Republic' },
  { code: '+36',  flag: '🇭🇺', name: 'Hungary' },
  { code: '+40',  flag: '🇷🇴', name: 'Romania' },
  { code: '+359', flag: '🇧🇬', name: 'Bulgaria' },
  { code: '+385', flag: '🇭🇷', name: 'Croatia' },
  { code: '+381', flag: '🇷🇸', name: 'Serbia' },
  { code: '+421', flag: '🇸🇰', name: 'Slovakia' },
  { code: '+386', flag: '🇸🇮', name: 'Slovenia' },
  { code: '+372', flag: '🇪🇪', name: 'Estonia' },
  { code: '+371', flag: '🇱🇻', name: 'Latvia' },
  { code: '+370', flag: '🇱🇹', name: 'Lithuania' },
  { code: '+354', flag: '🇮🇸', name: 'Iceland' },
  { code: '+353', flag: '🇮🇪', name: 'Ireland' },
  { code: '+352', flag: '🇱🇺', name: 'Luxembourg' },
  { code: '+356', flag: '🇲🇹', name: 'Malta' },
  { code: '+357', flag: '🇨🇾', name: 'Cyprus' },
  // Middle East
  { code: '+90',  flag: '🇹🇷', name: 'Turkey' },
  { code: '+962', flag: '🇯🇴', name: 'Jordan' },
  { code: '+20',  flag: '🇪🇬', name: 'Egypt' },
  { code: '+961', flag: '🇱🇧', name: 'Lebanon' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: '+964', flag: '🇮🇶', name: 'Iraq' },
  { code: '+98',  flag: '🇮🇷', name: 'Iran' },
  { code: '+967', flag: '🇾🇪', name: 'Yemen' },
  // Asia
  { code: '+91',  flag: '🇮🇳', name: 'India' },
  { code: '+86',  flag: '🇨🇳', name: 'China' },
  { code: '+81',  flag: '🇯🇵', name: 'Japan' },
  { code: '+82',  flag: '🇰🇷', name: 'South Korea' },
  { code: '+66',  flag: '🇹🇭', name: 'Thailand' },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore' },
  { code: '+60',  flag: '🇲🇾', name: 'Malaysia' },
  { code: '+62',  flag: '🇮🇩', name: 'Indonesia' },
  { code: '+63',  flag: '🇵🇭', name: 'Philippines' },
  { code: '+84',  flag: '🇻🇳', name: 'Vietnam' },
  { code: '+852', flag: '🇭🇰', name: 'Hong Kong' },
  { code: '+886', flag: '🇹🇼', name: 'Taiwan' },
  { code: '+92',  flag: '🇵🇰', name: 'Pakistan' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+94',  flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: '+95',  flag: '🇲🇲', name: 'Myanmar' },
  { code: '+855', flag: '🇰🇭', name: 'Cambodia' },
  { code: '+856', flag: '🇱🇦', name: 'Laos' },
  { code: '+976', flag: '🇲🇳', name: 'Mongolia' },
  { code: '+998', flag: '🇺🇿', name: 'Uzbekistan' },
  { code: '+993', flag: '🇹🇲', name: 'Turkmenistan' },
  { code: '+992', flag: '🇹🇯', name: 'Tajikistan' },
  { code: '+996', flag: '🇰🇬', name: 'Kyrgyzstan' },
  { code: '+374', flag: '🇦🇲', name: 'Armenia' },
  { code: '+994', flag: '🇦🇿', name: 'Azerbaijan' },
  { code: '+995', flag: '🇬🇪', name: 'Georgia' },
  // Oceania
  { code: '+61',  flag: '🇦🇺', name: 'Australia' },
  { code: '+64',  flag: '🇳🇿', name: 'New Zealand' },
  // Africa
  { code: '+27',  flag: '🇿🇦', name: 'South Africa' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+251', flag: '🇪🇹', name: 'Ethiopia' },
  { code: '+212', flag: '🇲🇦', name: 'Morocco' },
  { code: '+213', flag: '🇩🇿', name: 'Algeria' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisia' },
  { code: '+218', flag: '🇱🇾', name: 'Libya' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+255', flag: '🇹🇿', name: 'Tanzania' },
  { code: '+256', flag: '🇺🇬', name: 'Uganda' },
  { code: '+250', flag: '🇷🇼', name: 'Rwanda' },
  { code: '+237', flag: '🇨🇲', name: 'Cameroon' },
  { code: '+243', flag: '🇨🇩', name: 'DR Congo' },
  { code: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: '+221', flag: '🇸🇳', name: 'Senegal' },
  // Latin America
  { code: '+55',  flag: '🇧🇷', name: 'Brazil' },
  { code: '+54',  flag: '🇦🇷', name: 'Argentina' },
  { code: '+52',  flag: '🇲🇽', name: 'Mexico' },
  { code: '+56',  flag: '🇨🇱', name: 'Chile' },
  { code: '+57',  flag: '🇨🇴', name: 'Colombia' },
  { code: '+51',  flag: '🇵🇪', name: 'Peru' },
  { code: '+58',  flag: '🇻🇪', name: 'Venezuela' },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+595', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+598', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+507', flag: '🇵🇦', name: 'Panama' },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+503', flag: '🇸🇻', name: 'El Salvador' },
  { code: '+504', flag: '🇭🇳', name: 'Honduras' },
  { code: '+505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+53',  flag: '🇨🇺', name: 'Cuba' },
  { code: '+509', flag: '🇭🇹', name: 'Haiti' },
];

// Sort by code length descending so longer codes match first (e.g. +972 before +97)
const SORTED_COUNTRIES = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);

function parsePhone(value) {
  if (!value) return { code: '+972', local: '' };
  const str = String(value);
  if (str.startsWith('+')) {
    const match = SORTED_COUNTRIES.find((c) => str.startsWith(c.code));
    if (match) return { code: match.code, local: str.slice(match.code.length) };
  }
  return { code: '+972', local: str };
}

export default function PhoneInput({
  value,
  onChange,
  onFocus,
  placeholder = '501234567',
  readOnly = false,
  className = '',
  autoComplete = 'off',
}) {
  const parsed = parsePhone(value);
  const [code, setCode] = useState(parsed.code);
  const [local, setLocal] = useState(parsed.local);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  // Sync from parent when value changes externally
  useEffect(() => {
    const p = parsePhone(value);
    setCode(p.code);
    setLocal(p.local);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  const emit = (newCode, newLocal) => onChange?.(`${newCode}${newLocal}`);

  const filtered = COUNTRIES.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search),
  );

  const selected = COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];

  return (
    <div ref={wrapRef} className={`relative flex ${className}`}>
      {/* Country selector button */}
      <button
        type="button"
        onClick={() => { if (!readOnly) setOpen((o) => !o); }}
        className={`flex items-center gap-1 px-2.5 py-2 border border-r-0 border-slate-200 rounded-l-lg bg-slate-50 shrink-0 transition-colors ${
          readOnly ? 'cursor-default' : 'hover:bg-slate-100 cursor-pointer'
        }`}
      >
        <span className="text-lg leading-none">{selected.flag}</span>
        <span className="text-xs font-mono text-slate-600 tabular-nums">{selected.code}</span>
        {!readOnly && <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {/* Number input */}
      <input
        type="tel"
        value={local}
        onChange={(e) => { setLocal(e.target.value); emit(code, e.target.value); }}
        onFocus={onFocus}
        placeholder={placeholder}
        readOnly={readOnly}
        autoComplete={autoComplete}
        className={`flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:z-10 transition ${
          readOnly ? 'bg-slate-100 text-slate-500 cursor-default' : 'bg-white text-slate-800'
        }`}
      />

      {/* Country dropdown */}
      {open && (
        <div className="absolute top-full left-0 z-[60] mt-1 w-68 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country…"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>
          {/* List */}
          <ul className="max-h-52 overflow-y-auto">
            {filtered.map((c, i) => (
              <li key={`${c.code}-${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCode(c.code);
                    setOpen(false);
                    setSearch('');
                    emit(c.code, local);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-indigo-50 transition-colors text-left ${
                    c.code === code ? 'bg-indigo-50 font-semibold' : ''
                  }`}
                >
                  <span className="text-xl leading-none shrink-0">{c.flag}</span>
                  <span className="flex-1 truncate text-slate-700 text-xs">{c.name}</span>
                  <span className="text-xs font-mono text-slate-400 shrink-0 tabular-nums">{c.code}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-5 text-xs text-slate-400 text-center">No results</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
