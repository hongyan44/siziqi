import sqlite3, json, sys

path = r'd:\4ASECND复刻项目\4ascend-online\build\linux\x86_64\release\db\contest.db'
c = sqlite3.connect(path)
tables = [r[0] for r in c.execute("select name from sqlite_master where type='table'")]
print('tables:', tables)
for t in tables:
    try:
        rows = list(c.execute('select * from %s' % t))
    except Exception as e:
        print(t, 'err', e)
        continue
    print('==', t, 'rows:', len(rows))
    for r in rows:
        out = []
        for v in r:
            s = str(v)
            out.append(s if len(s) < 4000 else s[:4000] + '...TRUNC')
        print(out)
