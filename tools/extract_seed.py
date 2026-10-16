import csv, json, os, random, re
SRC = os.path.join(os.path.dirname(__file__), '../../Device Export - 2026-10-06_1451.csv')
OUT = os.path.join(os.path.dirname(__file__), '../src/seed/devices.json')
COMPANIES = ['Cleanaway Waste Management Ltd  Crestmead', 'JJ Richards Underwood', 'Pump-It Environmental Services',
             'REMONDIS Australia Pty Ltd', 'Evoro', "Lee's Environmental"]
# Fake transport company names, mapped 1:1 from the 6 real companies above (same order).
# These must match the COMPANIES list in src/store/seed.js.
FAKE_COMPANIES = ['Metro Liquid Waste Services', 'Riverside Environmental Pty Ltd', 'Apex Trade Waste Group',
                  'Summit Liquid Services', 'Clearflow Waste Solutions', 'Peninsula Pumping Co']
OTHER_FAKE = ['Allpoints Waste Co', 'Brightline Environmental', 'Trident Trade Waste', 'Horizon Pumping Services',
              'Beacon Liquid Haulers', 'Delta Waste Contractors']

PRE = ['Golden', 'Harbourview', 'Northside', 'Southside', 'Riverside', 'Sunnybank', 'Bluegum', 'Royal', 'Grand',
       'Emerald', 'Coastal', 'Hillside', 'Garden', 'Central', 'Corner', 'Lakeside', 'Parkside', 'Bayside',
       'Kookaburra', 'Jacaranda', 'Banksia', 'Waratah', 'Acacia', 'Magpie', 'Rosewood', 'Fig Tree', 'Willow',
       'Silver', 'Darling', 'Federal', 'Paddington', 'Montague']
TYPE = ['Café', 'Thai Kitchen', 'Aged Care', 'Bakery', 'Bistro', 'Restaurant', 'Diner', 'Grill', 'Deli',
        'Patisserie', 'Seafood', 'Pizzeria', 'Tavern', 'Hotel', 'Kitchen', 'Eatery', 'Canteen', 'Brasserie',
        'Steakhouse', 'Noodle House', 'Coffee House', 'Butchery', 'Food Court', 'Lane Bakery']

rows = list(csv.DictReader(open(SRC, encoding='utf-8-sig')))
loc_key = lambda r: (r['Agreement Numbers'], r['Address Line 1'], r['Location Names'])
locs = {}
for r in rows:
    locs.setdefault(loc_key(r), []).append(r)
random.seed(7)
keys = [k for k, ds in locs.items() if any(d['Serviced By'] in COMPANIES and d['Status'] == 'Active' and d['Latitude'] for d in ds)]
random.shuffle(keys)
picked = []
for k in keys:
    if len(picked) >= 400:
        break
    picked += locs[k][:6]

# ---- deterministic anonymisation ----
rng = random.Random(42)
combos = [f'{p} {t}' for p in PRE for t in TYPE]
rng.shuffle(combos)
others = sorted({r['Serviced By'] for r in picked if r['Serviced By'] and r['Serviced By'] not in COMPANIES})
company_map = {c: FAKE_COMPANIES[i] for i, c in enumerate(COMPANIES)}
company_map.update({c: OTHER_FAKE[i % len(OTHER_FAKE)] for i, c in enumerate(others)})
# Real retail chains mentioned in free-text device notes.
BRANDS = [(r'\bwoolworths\b', 'Freshway'), (r'\bcoles\b', 'Greengate'), (r'\baldi\b', 'Valumart'), (r'\bIGA\b', 'Corner Grocer'),
          (r"\bmcdonald'?s\b", 'Burger Barn'), (r"\bdomino'?s\b", 'Slice House'), (r'\bwestfield\b', 'Parkview Plaza'), (r'\btarget\b', 'Homestead Store')]

fake_name, fake_agree = {}, {}
used_refs, used_qr = set(), set()
def uniq(gen, used):
    while True:
        v = gen()
        if v not in used:
            used.add(v)
            return v
def scrub(text, pairs):
    for orig, repl in pairs:
        if orig:
            text = re.sub(re.escape(orig), repl, text, flags=re.IGNORECASE)
    for pattern, repl in BRANDS:
        text = re.sub(pattern, repl, text, flags=re.IGNORECASE)
    return text

for r in picked:
    k = loc_key(r)
    if k not in fake_name:
        fake_name[k] = combos.pop()
        fake_agree[k] = str(rng.randint(10000, 999999)) if r['Agreement Numbers'] else ''
    name = fake_name[k]
    orig_name, orig_aka = r['Location Names'], r['Device AKA']
    pairs = [(orig_name, name), (orig_aka, name)]
    r['Device Number'] = str(rng.randint(10000, 99999))
    r['Device Ref'] = uniq(lambda: 'DV' + ''.join(rng.choice('0123456789') for _ in range(7)), used_refs)
    if r['QR2id / Barcodes']:
        r['QR2id / Barcodes'] = uniq(lambda: ''.join(rng.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') for _ in range(12)), used_qr)
    r['Location Names'] = name
    r['Device AKA'] = name
    r['Agreement Numbers'] = fake_agree[k]
    if r['Serviced By']:
        r['Serviced By'] = company_map[r['Serviced By']]
    for f in ['Device Comments', 'Device Service Info', 'Device Location Description', 'Device Info']:
        r[f] = scrub(r[f], pairs)

json.dump(picked, open(OUT, 'w'), ensure_ascii=False)
print(len(picked), 'devices,', len({loc_key(r) for r in picked}), 'locations')
