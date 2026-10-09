"""Export this image-based PowerPoint in presentation order for the web viewer.

Usage: python tools/export_workshop_deck.py path/to/deck.pptx
Requires Pillow. Fails on unsupported slide content instead of silently dropping it.
"""
import hashlib
import json
import posixpath
import shutil
import sys
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'presentation'
NS = {
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}
TITLES = [
    'Becoming an AI-Native Business',
    'Nicolas Boitout, PhD',
    'Put AI at the center of how you work',
    'Make AI part of your meetings',
    'AI Etiquette Matrix',
    'Add a personal touch when it matters',
    'Refuse AI Slop',
    'Use AI to express your opinion',
    'Data privacy',
    'Be humble. Acknowledge AI’s contribution.',
    'Run an uncomfortably high AI bill',
    'Visualize everything',
    'Use AI to challenge AI',
    'Loop everything',
    'Your turn: AI on your own business data',
    'Build your AI-native advantage',
]


def relationships(archive, part):
    path = posixpath.dirname(part) + '/_rels/' + posixpath.basename(part) + '.rels'
    return {r.get('Id'): r for r in ET.fromstring(archive.read(path))}


def export(source):
    assets = ROOT / 'slides'
    assets.mkdir(parents=True, exist_ok=True)
    slides = []
    with ZipFile(source) as archive:
        presentation = ET.fromstring(archive.read('ppt/presentation.xml'))
        size = presentation.find('p:sldSz', NS)
        width, height = int(size.get('cx')), int(size.get('cy'))
        rels = relationships(archive, 'ppt/presentation.xml')
        order = presentation.findall('p:sldIdLst/p:sldId', NS)
        if len(order) != len(TITLES):
            raise ValueError('Update the slide titles before exporting a different deck.')
        for index, slide_id in enumerate(order, 1):
            target = rels[slide_id.get(f'{{{NS["r"]}}}id')].get('Target')
            part = posixpath.normpath('ppt/' + target)
            slide = ET.fromstring(archive.read(part))
            pics = slide.findall('.//p:pic', NS)
            if len(pics) != 1 or slide.findall('.//p:graphicFrame', NS):
                raise ValueError(f'Slide {index} needs a full PowerPoint renderer.')
            if pics[0].find('.//a:srcRect', NS) is not None:
                raise ValueError(f'Slide {index} has an image crop; render it first.')
            slide_rels = relationships(archive, part)
            blip = pics[0].find('p:blipFill/a:blip', NS)
            image_target = slide_rels[blip.get(f'{{{NS["r"]}}}embed')].get('Target')
            image_part = posixpath.normpath(posixpath.dirname(part) + '/' + image_target)
            original = archive.read(image_part)
            digest = hashlib.sha256(original).hexdigest()[:10]
            stem = f'slide-{index:02}-{digest}'
            image = Image.open(BytesIO(original)).convert('RGB')
            image.save(assets / f'{stem}.webp', quality=94, method=6)
            thumbnail = image.copy()
            thumbnail.thumbnail((320, 180))
            thumbnail.save(assets / f'{stem}-thumb.webp', quality=85, method=6)
            links = []
            for shape in slide.findall('.//p:sp', NS):
                text = ''.join(t.text or '' for t in shape.findall('.//a:t', NS))
                hyperlink = shape.find('.//a:hlinkClick', NS)
                if not text or hyperlink is None:
                    raise ValueError(f'Slide {index} has unsupported overlaid content.')
                url = slide_rels[hyperlink.get(f'{{{NS["r"]}}}id')].get('Target')
                if not url.startswith('https://'):
                    raise ValueError('Only HTTPS slide links are supported.')
                transform = shape.find('p:spPr/a:xfrm', NS)
                offset = transform.find('a:off', NS)
                extent = transform.find('a:ext', NS)
                links.append({'text': text, 'url': url,
                              'left': 100 * int(offset.get('x')) / width,
                              'top': 100 * int(offset.get('y')) / height,
                              'width': 100 * int(extent.get('cx')) / width,
                              'height': 100 * int(extent.get('cy')) / height})
            slides.append({'title': TITLES[index - 1],
                           'src': f'/presentation/slides/{stem}.webp',
                           'thumbnail': f'/presentation/slides/{stem}-thumb.webp',
                           'width': image.width, 'height': image.height, 'links': links})
    (ROOT / 'slides.json').write_text(json.dumps(slides, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    shutil.copyfile(source, ROOT / 'business-forward-workshop.pptx')
    total = sum(p.stat().st_size for p in assets.glob('*.webp'))
    print(f'Exported {len(slides)} slides and thumbnails ({total / 1024 / 1024:.1f} MB), plus the original PowerPoint.')


if __name__ == '__main__':
    export(Path(sys.argv[1]))
