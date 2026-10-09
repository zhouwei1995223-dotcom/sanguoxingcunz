import sys
from PIL import Image
names=sys.argv[2:]
ims=[Image.open(f'dist/shots/{n}.png') for n in names]
w=sum(i.width//2 for i in ims); h=max(i.height//2 for i in ims)
out=Image.new('RGB',(w,h))
x=0
for i in ims:
  out.paste(i.resize((i.width//2,i.height//2)),(x,0)); x+=i.width//2
out.save(sys.argv[1])
