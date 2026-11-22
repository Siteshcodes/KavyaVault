"""Optional reader extraction diagnostic; requires pypdf and PyMuPDF.

Unlike the structural checks, this compares all extracted characters, including
duplicates. A nonzero exit is an open compatibility finding, not a rendering
failure. Pass a directory of locally installed QA libraries as the first argument.
"""
import json
from pathlib import Path
import sys
if len(sys.argv) > 1:
    sys.path.insert(0, sys.argv[1])
import pymupdf
from pypdf import PdfReader
from pypdf.generic import ContentStream

root = Path(__file__).resolve().parents[1] / 'artifacts/verification'
normalize = lambda text: ''.join(text.split())
reports = []
for filename in sorted(root.glob('verification-*.pdf')):
    expected_pages = []
    for page in PdfReader(filename, strict=True).pages:
        lines = [str(operands[1]['/ActualText'])
                 for operands, operator in ContentStream(page.get_contents(), page.pdf).operations
                 if operator == b'BDC' and len(operands) == 2 and '/ActualText' in operands[1]]
        expected_pages.append(normalize(''.join(lines)))
    with pymupdf.open(filename) as document:
        actual_pages = [normalize(page.get_text()) for page in document]
    assert len(actual_pages) == len(expected_pages)
    reports.append({'file': filename.name, 'pages': len(actual_pages),
                    'exactPages': sum(a == b for a, b in zip(actual_pages, expected_pages)),
                    'mismatchedPages': [i + 1 for i, (a, b) in enumerate(zip(actual_pages, expected_pages)) if a != b]})
report = {'reader': 'PyMuPDF', 'version': pymupdf.VersionBind, 'results': reports,
          'passed': all(not result['mismatchedPages'] for result in reports)}
(root / 'pdf-text-diagnostic.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
sys.exit(0 if report['passed'] else 1)
