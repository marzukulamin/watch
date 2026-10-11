"""Local video postproduction: remove hallucinated micro-lettering beside six.

The original cloud render stays untouched. No network or generative service is used.
"""
from pathlib import Path
import subprocess
import cv2
import numpy as np

root = Path(__file__).resolve().parent.parent
source = root / 'docs/reference/verse-assembly-omni.watch-v3.mp4'
target = root / 'docs/reference/verse-assembly-omni.watch-v3-clean.mp4'
capture = cv2.VideoCapture(str(source))
encoder = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '1920x1080', '-r', '24',
    '-i', '-', '-an', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(target)], stdin=subprocess.PIPE)
index = 0
while True:
    ok, frame = capture.read()
    if not ok:
        break
    time = index / 24
    if 5.5 <= time <= 7.7:
        expected = np.interp(time, [5.5, 5.75, 6, 6.25, 6.5, 6.75, 7, 7.25, 7.5, 7.7],
                             [715, 720, 729, 735, 765, 812, 875, 949, 1033, 1120])
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        marker = (int(np.interp(time, [5.5, 6, 6.5, 7, 7.25, 7.7], [938, 937, 948, 950, 948, 945])),
                  int(expected - 60), int(np.interp(time, [5.5, 6, 6.5, 7, 7.25, 7.7], [13, 13, 15, 20, 24, 30])), 60)
        if marker:
            x, y, width, height = marker
            center, bottom = x + width / 2, y + height
            scale = max(1, width / 13)
            mask = np.zeros(gray.shape, dtype='uint8')
            for side in [-1, 1]:
                start = int(center + side * 10 * scale)
                end = int(center + side * 74 * scale)
                left, right = sorted([start, end])
                top = max(0, int(bottom - 12 * scale))
                lower = min(1080, int(bottom + 12 * scale))
                mask[top:lower, left:right] = 255
            # A narrow tracked region leaves the six marker and surrounding face intact.
            frame = cv2.inpaint(frame, mask, 4, cv2.INPAINT_TELEA)
    encoder.stdin.write(frame.tobytes())
    index += 1
capture.release()
encoder.stdin.close()
if encoder.wait() != 0:
    raise RuntimeError('Video encoding failed')
print(f'Cleaned {index} frames; original Cloud render retained.')
