"""Optional independent export QA: Python with pypdf/Pillow and Poppler on PATH."""
import json
import math
import subprocess
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from PIL import Image, ImageDraw
from pypdf import PdfReader
from pypdf.generic import ContentStream

root = Path(__file__).resolve().parents[1] / 'artifacts' / 'verification'
fixture = json.loads((root / 'fixture.json').read_text(encoding='utf-8'))
source_lines = [line for poem in fixture['poems'] for line in poem['body'].splitlines() if line.strip()]
reports = []
render_dir = root / 'renders'
render_dir.mkdir(exist_ok=True)
for filename in sorted(root.glob('verification-*.pdf')):
    reader = PdfReader(filename, strict=True)
    assert reader.metadata.title == 'काव्य परीक्षण'
    assert reader.metadata.author == 'परीक्षण कवि'
    actual_text = []
    for page in reader.pages:
        fonts = page['/Resources']['/Font']
        for reference in fonts.values():
            font = reference.get_object()
            descendant = font['/DescendantFonts'][0].get_object()
            assert len(descendant['/FontDescriptor']['/FontFile2'].get_data()) > 200000
            assert '/ToUnicode' in font
        for operands, operator in ContentStream(page.get_contents(), reader).operations:
            if operator == b'BDC' and len(operands) == 2 and '/ActualText' in operands[1]:
                actual_text.append(str(operands[1]['/ActualText']))
    assert all(actual_text.count(line) == source_lines.count(line) for line in set(source_lines)), filename.name
    prefix = render_dir / filename.stem
    result = subprocess.run(['pdftoppm', '-r', '70', '-png', str(filename), str(prefix)], capture_output=True, text=True, check=True)
    assert not result.stderr.strip(), result.stderr
    images = sorted(render_dir.glob(filename.stem + '-*.png'))
    cols, cellw, cellh = 4, 280, 400
    sheet = Image.new('RGB', (cols * cellw, math.ceil(len(images) / cols) * cellh), '#dedede')
    draw = ImageDraw.Draw(sheet)
    for index, image_path in enumerate(images):
        im = Image.open(image_path).convert('RGB')
        im.thumbnail((cellw - 16, cellh - 30))
        x, y = (index % cols) * cellw, (index // cols) * cellh
        sheet.paste(im, (x + (cellw - im.width) // 2, y + 24))
        draw.text((x + 8, y + 6), f'{filename.stem}: {index + 1}', fill='black')
    sheet.save(root / (filename.stem + '-contact.png'))
    reports.append({'file': filename.name, 'pages': len(reader.pages), 'logicalPoemLines': len(source_lines), 'embeddedFonts': True, 'popplerWarnings': result.stderr.strip()})

for filename in sorted(root.glob('cover-*.pdf')):
    subprocess.run(['pdftoppm', '-f', '1', '-singlefile', '-r', '100', '-png', str(filename), str(root / filename.stem)], check=True)

with zipfile.ZipFile(root / 'verification.epub') as archive:
    assert archive.testzip() is None
    assert archive.infolist()[0].filename == 'mimetype'
    assert archive.infolist()[0].compress_type == zipfile.ZIP_STORED
    assert archive.read('mimetype') == b'application/epub+zip'
    for name in archive.namelist():
        if name.endswith(('.xml', '.xhtml', '.opf', '.ncx')):
            ET.fromstring(archive.read(name))
    opf = ET.fromstring(archive.read('OEBPS/package.opf'))
    ns = {'opf': 'http://www.idpf.org/2007/opf', 'dc': 'http://purl.org/dc/elements/1.1/'}
    items = {i.attrib['id']: i.attrib['href'] for i in opf.findall('opf:manifest/opf:item', ns)}
    for item in opf.findall('opf:spine/opf:itemref', ns):
        assert 'OEBPS/' + items[item.attrib['idref']] in archive.namelist()
    poem_text = []
    for name in archive.namelist():
        if '/poem-' in name and name.endswith('.xhtml'):
            tree = ET.fromstring(archive.read(name))
            poem_text.extend(''.join(e.itertext()) for e in tree.iter() if e.attrib.get('class') == 'epub-poem-line')
    assert poem_text == source_lines

(root / 'independent-validation.json').write_text(json.dumps({'pdf': reports, 'epub': {'zipCrc': True, 'xml': True, 'spine': True, 'exactPoemLines': True}}, indent=2), encoding='utf-8')
print(f'Validated {len(reports)} PDFs and EPUB; preserved {len(source_lines)} poem lines in every export.')
