"""
Generate a 1024x1024 source-icon.png for Loom desktop.
Pure Python stdlib — no PIL/Pillow needed.
Design: dark #171717 background with white "L" letterform.
"""
import struct
import zlib
import os

WIDTH = 1024
HEIGHT = 1024

# Background: #171717 (23, 23, 23)
BG = (23, 23, 23)
FG = (255, 255, 255)

def make_pixel_row(y, width, height, bg, fg):
    """Generate RGB row data for a given y position."""
    # "L" letterform parameters (proportional to 1024px canvas)
    # Vertical stem: left portion of the letter
    stem_x0 = 320  # left edge of stem
    stem_x1 = 420  # right edge of stem
    # Horizontal base bar
    base_y0 = 740  # top of base bar
    base_y1 = 840  # bottom of base bar
    base_x0 = 320  # left edge of base
    base_x1 = 720  # right edge of base
    # Full height of letter
    letter_y0 = 180  # top of letter
    letter_y1 = 840  # bottom of letter (same as base_y1)

    row = bytearray(width * 3)
    for x in range(width):
        # Determine if this pixel is part of the "L"
        in_stem = (stem_x0 <= x < stem_x1) and (letter_y0 <= y < letter_y1)
        in_base = (base_x0 <= x < base_x1) and (base_y0 <= y < base_y1)
        in_letter = in_stem or in_base
        r, g, b = fg if in_letter else bg
        idx = x * 3
        row[idx] = r
        row[idx + 1] = g
        row[idx + 2] = b
    return bytes(row)

def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    length = struct.pack('>I', len(data))
    crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
    return length + chunk_type + data + crc

def write_png(path: str, width: int, height: int, bg, fg):
    # PNG signature
    sig = b'\x89PNG\r\n\x1a\n'

    # IHDR: width, height, bit depth=8, color type=2 (RGB), compression=0, filter=0, interlace=0
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr = png_chunk(b'IHDR', ihdr_data)

    # IDAT: compressed scanlines, each prefixed with filter byte 0
    raw_rows = bytearray()
    for y in range(height):
        raw_rows += b'\x00'  # filter type None
        raw_rows += make_pixel_row(y, width, height, bg, fg)

    compressed = zlib.compress(bytes(raw_rows), level=6)
    idat = png_chunk(b'IDAT', compressed)

    # IEND
    iend = png_chunk(b'IEND', b'')

    with open(path, 'wb') as f:
        f.write(sig + ihdr + idat + iend)

    size = os.path.getsize(path)
    print(f"Wrote {path} ({size:,} bytes, {width}x{height} RGB PNG)")

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(__file__), 'source-icon.png')
    write_png(out, WIDTH, HEIGHT, BG, FG)
