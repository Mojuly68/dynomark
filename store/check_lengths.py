"""Check the store listing fields in listing.md against each store's character limits."""
import re
from pathlib import Path

text = Path(__file__).with_name('listing.md').read_text(encoding='utf-8')

def field(label):
    m = re.search(r'\*\*' + re.escape(label) + r'\*\*[^\n]*?\n?`([^`]+)`', text)
    return m.group(1) if m else None

checks = [
    ('App name', 30), ('Subtitle', 30), ('Promotional text', 170), ('Keywords', 100), ('Short description', 80),
]
ok = True
for label, limit in checks:
    v = field(label)
    if v is None:
        print(f'{label}: not found'); ok = False; continue
    n = len(v)
    print(f'{label}: {n}/{limit} {"OK" if n <= limit else "TOO LONG"}')
    ok &= n <= limit
desc = re.search(r'## Shared description\s+```\n(.*?)```', text, re.S).group(1).strip()
print(f'Description: {len(desc)}/4000 {"OK" if len(desc) <= 4000 else "TOO LONG"}')
ok &= len(desc) <= 4000
print('ALL OK' if ok else 'FIX NEEDED')
