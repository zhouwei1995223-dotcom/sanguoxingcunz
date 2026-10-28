import numpy as np
def h(s): return [int(s[i:i + 2], 16) for i in (0, 2, 4)]
PAL = {
 'k': '15121c',
 'W': 'fbfbfd', 'w': 'e2e5ec', 'v': 'c1c7d4', 'g': '969fb2', 'G': '666e82',
 'L': '86b6f2', 'B': '2f7fd0', 'b': '2856a6', 'n': '1d3676', 'N': '142650',
 'H': 'a87656', 'h': '7a4e36', 'd': '52342a', 'u': '8a5a34', 'U': '5c3a22',
 's': 'f7d6c4', 'S': 'e0a896', 'y': 'e8c25a', 'r': 'cf8f8f', 'm': '4a4a56',
}
KEYS = list(PAL); ARR = np.array([h(PAL[k]) for k in KEYS])
def snap(c):
    return KEYS[((ARR - np.array(c[:3], int)) ** 2).sum(1).argmin()]
