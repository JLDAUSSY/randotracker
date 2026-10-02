import re

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

js_ids = set(re.findall(r"getElementById\(['\"]([^'\"]+)['\"]", js))
html_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html))

missing = js_ids - html_ids
print("Missing in HTML:", missing)
