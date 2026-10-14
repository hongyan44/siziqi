import sys
from pypdf import PdfReader

for path in sys.argv[1:]:
    print("=" * 20, path, "=" * 20)
    reader = PdfReader(path)
    print("pages:", len(reader.pages))
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        imgs = 0
        try:
            imgs = len(page.images)
        except Exception:
            imgs = -1
        print(f"----- page {i + 1} (images={imgs}) -----")
        print(text)
