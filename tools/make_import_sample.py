import csv, json, os, random
here = os.path.dirname(__file__)
SRC = os.path.join(here, '../../Device Export - 2026-10-06_1451.csv')
seed = json.load(open(os.path.join(here, '../src/seed/devices.json')))
rows = list(csv.DictReader(open(SRC, encoding='utf-8-sig')))
fields = list(rows[0].keys())
random.seed(3)
seed_refs = {r['Device Ref'] for r in seed}
upd = [dict(r) for r in random.sample(seed, 40)]
for r in upd[:25]:
    r['Capacity'] = str(float(r['Capacity'] or 0) + 500)
for r in upd[25:]:
    r['Service Frequency'] = '8'
new = [r for r in rows if r['Device Ref'] not in seed_refs and r['Status'] == 'Active'][:60]
bad = [dict(r) for r in rows[-5:]]
bad[0]['Device Ref'] = ''
bad[1]['Status'] = 'Broken'
bad[2]['Capacity'] = 'abc'
bad[3]['Latitude'] = '999'
bad[4]['Device Ref'] = new[0]['Device Ref']
out = os.path.join(here, '../public/samples/device-export-sample.csv')
with open(out, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_ALL)
    w.writeheader()
    w.writerows(upd + new + bad)
print('sample rows', len(upd) + len(new) + len(bad))
