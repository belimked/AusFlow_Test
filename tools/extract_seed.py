import csv, json, os, random
SRC = os.path.join(os.path.dirname(__file__), '../../Device Export - 2026-10-06_1451.csv')
OUT = os.path.join(os.path.dirname(__file__), '../src/seed/devices.json')
COMPANIES = ['Cleanaway Waste Management Ltd  Crestmead', 'JJ Richards Underwood', 'Pump-It Environmental Services',
             'REMONDIS Australia Pty Ltd', 'Evoro', "Lee's Environmental"]
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
json.dump(picked, open(OUT, 'w'), ensure_ascii=False)
print(len(picked), 'devices,', len({loc_key(r) for r in picked}), 'locations')
