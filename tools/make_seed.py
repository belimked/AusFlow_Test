"""Builds src/seed/devices.json: 100 made-up devices at real Brisbane locations.

Location names, addresses, agreement numbers and coordinates come from the WasteID export; every device field
(number, ref, QR, name, type, capacity, service data, responsible company) is generated, so nothing matches
the export's devices. The five transport company names must match COMPANIES in src/store/seed.js.
"""
import csv, json, os, random, datetime
here = os.path.dirname(__file__)
SRC = os.path.join(here, '../../Device Export - 2026-10-06_1451.csv')
OUT = os.path.join(here, '../src/seed/devices.json')
COMPANIES = ['Metro Liquid Waste Services', 'Riverside Environmental Pty Ltd', 'Apex Trade Waste Group',
             'Summit Liquid Services', 'Clearflow Waste Solutions']
N_DEVICES = 100
TYPES = [('Grease Arrestor', 'Grease Trap Waste', [1000, 1500, 2000, 2000, 3000, 4000, 5000], 'GA')] * 17 + [
    ('Oil/Water Separator', 'Oily Water', [2000, 3000, 5000], 'OWS'),
    ('Holding Tank', 'Grease Trap Waste', [5000, 10000], 'HT'),
    ('Coalescing Plate Separator', 'Oily Water', [3000, 5000], 'CPS')]
WHERE = ['Kitchen', 'Loading dock', 'Rear lane', 'Basement car park', 'Service yard', 'Behind cool room', 'Car park level B1', 'Side access']
DESC = ['Lid in the rear lane next to the bins', 'In the basement plant room, key from reception', 'Under the loading dock grate',
        'Two lids in the service yard, access via roller door', 'Near the grease trap room on level B1', 'Beside the kitchen back door',
        'In the car park, bollards must be removed', 'Access through the side gate (code at office)']
COMMENTS = ['', '', '', 'Tag on wall next to the lid', 'Park on the street; driveway too narrow for large trucks', 'Site closed on Mondays',
            'Call site manager 30 min before arrival', 'Water tap available in the yard']

rows = list(csv.DictReader(open(SRC, encoding='utf-8-sig')))
old_refs = {r['Device Ref'] for r in rows}
old_numbers = {r['Device Number'] for r in rows}
old_qr = {q for r in rows for q in r['QR2id / Barcodes'].split()}
locs = {}
for r in rows:
    try:
        lat, lng = float(r['Latitude']), float(r['Longitude'])
    except ValueError:
        continue
    if not (r['Location Names'] and r['Address Line 1'] and r['Suburb'] and -27.75 < lat < -27.25 and 152.85 < lng < 153.25):
        continue
    key = (r['Location Names'], r['Address Line 1'].upper(), r['Suburb'].upper())
    locs.setdefault(key, r)

rng = random.Random(20261023)
keys = list(locs)
rng.shuffle(keys)
# Spread across suburbs: at most 3 locations per suburb.
per_suburb, picked = {}, []
for k in keys:
    if per_suburb.get(k[2], 0) >= 3:
        continue
    per_suburb[k[2]] = per_suburb.get(k[2], 0) + 1
    picked.append(locs[k])
    if len(picked) == N_DEVICES:
        break
assert len(picked) == N_DEVICES

def uniq(gen, used):
    while True:
        v = gen()
        if v not in used:
            used.add(v)
            return v

def wasteid_date(dt):
    d = dt.day
    suffix = 'th' if 11 <= d <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(d % 10, 'th')
    return dt.strftime(f'%a {d}{suffix} %b %Y %H:%M:%S AEST')

fields = list(rows[0].keys())
today = datetime.datetime(2026, 10, 23, 6, 0, 0)
out = []
for i, src in enumerate(picked):
    r = {f: '' for f in fields}
    dtype, waste, caps, prefix = rng.choice(TYPES)
    cap = rng.choice(caps)
    freq = rng.choice([13, 13, 13, 13, 8, 26, 4]) if dtype == 'Grease Arrestor' else rng.choice([13, 26, 52])
    last = today - datetime.timedelta(days=rng.randint(3, 200), hours=rng.randint(0, 9), minutes=rng.randint(0, 59))
    nxt = last + datetime.timedelta(weeks=freq)
    r['Device Number'] = uniq(lambda: str(rng.randint(60000, 69999)), old_numbers)
    r['Device Ref'] = uniq(lambda: 'DV8' + ''.join(rng.choice('0123456789') for _ in range(6)), old_refs)
    r['Device AKA'] = f'{prefix}#{rng.randint(1, 3)} - {rng.choice(WHERE)}'
    r['Status'] = 'Inactive' if i % 20 == 19 else 'Active'
    r['Device Type'] = dtype
    r['Device Waste'] = waste
    r['QR2id / Barcodes'] = uniq(lambda: ''.join(rng.choice('ABCDEFGHJKLMNPRSTUVWXYZ23456789') for _ in range(12)), old_qr)
    r['Capacity'] = f'{cap:.1f}'
    r['Latitude'] = f"{float(src['Latitude']) + rng.uniform(-0.00015, 0.00015):.15f}"
    r['Longitude'] = f"{float(src['Longitude']) + rng.uniform(-0.00015, 0.00015):.15f}"
    r['Service Frequency'] = str(freq)
    r['Device Service Info'] = rng.choice(DESC)
    r['Last Service'] = wasteid_date(last)
    r['Serviced By'] = COMPANIES[i % len(COMPANIES)] if i % 25 != 24 else ''
    r['Next Service'] = wasteid_date(nxt)
    overdue = (today - nxt).days // 7
    r['Overdue'] = f'{overdue} weeks' if overdue > 0 else ''
    r['Approval Category'] = rng.choice(['E', 'E', 'D', 'C'])
    r['Approval Risk'] = str(rng.randint(1, 9))
    r['Device Comments'] = rng.choice(COMMENTS)
    r['Device Location Description'] = r['Device Service Info']
    for f in ['Location Names', 'Agreement Numbers', 'Address Line 1', 'Address Line 2', 'Suburb', 'State', 'Postcode', 'Country']:
        r[f] = src[f]
    r['Country'] = r['Country'] or 'Australia'
    r['State'] = r['State'] or 'QLD'
    out.append(r)

json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=0)
print(len(out), 'devices at', len({(r['Location Names'], r['Address Line 1']) for r in out}), 'locations;',
      sum(r['Status'] == 'Active' for r in out), 'active;', len(per_suburb), 'suburbs')
