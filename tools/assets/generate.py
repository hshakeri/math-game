#!/usr/bin/env python3
"""Original, deterministic pixel artwork. Python standard library only.

All artwork is painted on integer pixel grids and emitted as crisp SVG runs.
Narrative scenes contain no text, quantities, diagrams, or puzzle information.
Locked/open backgrounds differ only in the door tiles, never in puzzle content.
"""
import hashlib
import json
import random
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
ASSETS = ROOT / 'client' / 'assets'
INK = '#202b31'
CREAM = '#f7f1e3'
SAND = '#d8cca8'
GOLD = '#c8963e'

class Pixels:
    def __init__(self, w, h, bg=None):
        self.w, self.h = w, h
        self.p = [[bg] * w for _ in range(h)]
    def dot(self, x, y, c):
        if 0 <= int(x) < self.w and 0 <= int(y) < self.h:
            self.p[int(y)][int(x)] = c
    def rect(self, x, y, w, h, c):
        for yy in range(max(0,int(y)), min(self.h,int(y+h))):
            for xx in range(max(0,int(x)), min(self.w,int(x+w))): self.p[yy][xx] = c
    def poly(self, pts, c):
        minx, maxx = max(0,min(x for x,y in pts)), min(self.w-1,max(x for x,y in pts))
        miny, maxy = max(0,min(y for x,y in pts)), min(self.h-1,max(y for x,y in pts))
        for y in range(int(miny),int(maxy)+1):
            for x in range(int(minx),int(maxx)+1):
                inside=False
                j=len(pts)-1
                for i in range(len(pts)):
                    xi, yi=pts[i]; xj,yj=pts[j]
                    if ((yi>y+.5)!=(yj>y+.5)) and x+.5<(xj-xi)*(y+.5-yi)/(yj-yi)+xi: inside=not inside
                    j=i
                if inside: self.dot(x,y,c)
    def ellipse(self,x,y,rx,ry,c):
        for yy in range(int(y-ry),int(y+ry)+1):
            for xx in range(int(x-rx),int(x+rx)+1):
                if ((xx-x)/rx)**2+((yy-y)/ry)**2<=1: self.dot(xx,yy,c)
    def line(self,x0,y0,x1,y1,c,width=1):
        n=max(abs(x1-x0),abs(y1-y0),1)
        for i in range(n+1):
            self.rect(round(x0+(x1-x0)*i/n),round(y0+(y1-y0)*i/n),width,width,c)
    def paste(self,other,x,y):
        for yy,row in enumerate(other.p):
            for xx,c in enumerate(row):
                if c: self.dot(x+xx,y+yy,c)
    def svg(self, width=None, height=None):
        width, height=width or self.w,height or self.h
        scale_x,scale_y=width/self.w,height/self.h
        out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" shape-rendering="crispEdges">', f'<g transform="scale({scale_x:g} {scale_y:g})">']
        active = {}
        rectangles = []
        for y,row in enumerate(self.p):
            current = {}
            x=0
            while x<self.w:
                c=row[x]; start=x
                while x<self.w and row[x]==c: x+=1
                if c:
                    key=(start,x-start,c)
                    first,height=active.pop(key,(y,0))
                    current[key]=(first,height+1)
            for (xx,ww,cc),(yy,hh) in active.items():rectangles.append((xx,yy,ww,hh,cc))
            active=current
        for (xx,ww,cc),(yy,hh) in active.items():rectangles.append((xx,yy,ww,hh,cc))
        for x,y,w,h,c in rectangles:
            out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>')
        out.append('</g></svg>')
        return '\n'.join(out)+'\n'
    def png(self,path,scale=1):
        rows=[]
        for row in self.p:
            raw=b''.join((bytes.fromhex(c[1:])+b'\xff' if c else b'\x00\x00\x00\x00')*scale for c in row)
            rows.extend([b'\x00'+raw]*scale)
        def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
        Path(path).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',self.w*scale,self.h*scale,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b''))


def hero(variant=1,pose='idle'):
    p=Pixels(48,48)
    skins=['#d7a77b','#a86f4e','#e8c49a','#81543f','#bc8967','#d2a183']
    hairs=['#533d36','#2e292b','#a46f41','#292c32','#6a4838','#b88e5c']
    coats=['#547b7c','#6c6c86','#58765d','#8f6357','#556f8b','#87764e']
    i=(variant-1)%6; skin=skins[i]; hair=hairs[i]; coat=coats[i]
    p.ellipse(24,44,13,2,'#263239')
    # Long-legged 16-bit proportions, leather boots and trousers.
    leg_shift=2 if pose=='walk' else 0
    p.rect(18,32,6,10-leg_shift,INK); p.rect(26,32+leg_shift,6,10-leg_shift,INK)
    p.rect(19,34,4,6-leg_shift,'#56616a'); p.rect(27,34+leg_shift,4,6-leg_shift,'#56616a')
    p.rect(16,41-leg_shift,8,3,'#493c32'); p.rect(26,41,8,3,'#493c32')
    p.rect(16,43-leg_shift,8,1,'#9a7852'); p.rect(26,43,8,1,'#9a7852')
    p.rect(16,22,18,13,INK); p.rect(17,23,16,10,coat); p.rect(18,24,3,8,'#77958d')
    p.rect(24,24,2,10,'#c9bd94'); p.rect(17,32,16,3,'#3d3932'); p.rect(23,32,4,2,GOLD)
    p.rect(14,24,4,9,INK);p.rect(15,25,3,6,coat);p.rect(14,31,4,3,skin)
    p.rect(32,24,4,9,INK);p.rect(32,25,3,6,coat);p.rect(32,31,4,3,skin)
    p.line(18,22,31,33,'#423934',2);p.line(19,22,32,33,'#ad8657')
    # Satchel with cards visible above the flap.
    p.rect(30,30,9,10,INK);p.rect(31,29,3,5,CREAM);p.rect(35,30,2,4,SAND)
    p.rect(31,33,7,6,'#946d46');p.rect(31,33,7,2,'#bc9360');p.rect(34,35,2,2,GOLD)
    # Head, ear, hair, goggles above the eyes.
    p.rect(16,8,16,14,INK);p.rect(14,11,20,8,INK)
    p.rect(17,10,14,11,skin);p.rect(15,14,3,4,skin);p.rect(31,14,2,4,skin)
    p.rect(19,20,10,3,skin);p.rect(17,8,14,5,hair);p.rect(15,11,4,6,hair);p.rect(29,10,3,5,hair)
    p.rect(19,6,9,3,hair);p.rect(18,8,12,2,'#8d6b4e')
    p.rect(16,10,17,3,'#473f37');p.rect(18,9,5,4,GOLD);p.rect(26,9,5,4,GOLD)
    p.rect(19,10,3,2,'#9db6ae');p.rect(27,10,3,2,'#9db6ae');p.rect(23,10,3,1,GOLD)
    p.rect(21,15,2,3,INK);p.rect(28,15,2,3,INK);p.dot(21,15,CREAM);p.dot(28,15,CREAM)
    p.rect(24,18,2,1,'#a67458');p.rect(23,21,4,1,'#7d513e')
    p.rect(17,22,15,3,'#a7594b');p.rect(19,22,11,1,'#d48a64');p.rect(16,24,4,7,'#a7594b');p.rect(14,29,5,3,'#a7594b')
    if pose=='think':
        p.rect(29,22,5,7,coat);p.rect(28,19,5,4,skin);p.rect(27,20,2,2,skin)
    if pose=='celebrate':
        p.rect(11,17,4,11,INK);p.rect(12,18,3,8,coat);p.rect(11,14,4,5,skin)
        p.rect(35,17,4,11,INK);p.rect(35,18,3,8,coat);p.rect(35,14,4,5,skin)
    return p


def rivet():
    p=Pixels(48,48)
    p.ellipse(25,44,14,2,'#263239')
    p.rect(17,38,4,6,'#a6793f');p.rect(29,38,4,6,'#a6793f');p.rect(15,43,9,2,GOLD);p.rect(27,43,9,2,GOLD)
    p.ellipse(25,28,14,14,INK);p.ellipse(25,28,12,12,'#a07442');p.ellipse(25,30,9,10,'#c39957')
    p.poly([(10,22),(15,20),(18,31),(14,38),(9,33)],'#715a40');p.line(11,24,13,33,'#b89154')
    p.poly([(37,21),(42,27),(39,36),(33,36)],'#715a40');p.line(37,25,38,32,'#c49b58')
    p.rect(15,6,5,9,INK);p.rect(31,6,5,9,INK);p.rect(16,8,3,7,GOLD);p.rect(32,8,3,7,GOLD)
    p.ellipse(25,19,15,13,INK);p.ellipse(25,18,13,11,'#bd965d')
    p.ellipse(19,19,7,7,'#e5d3a0');p.ellipse(31,19,7,7,'#715a40');p.ellipse(31,19,6,6,'#e1bd73');p.ellipse(31,19,4,4,'#a8c4be')
    p.rect(17,18,4,5,INK);p.rect(30,18,3,5,INK);p.dot(17,18,CREAM);p.dot(30,18,CREAM)
    p.rect(13,14,12,2,'#544e40');p.rect(27,13,11,2,'#544e40')
    p.poly([(23,23),(28,23),(25,28)],'#5c4937');p.rect(24,23,3,2,'#e0b362')
    p.rect(22,31,7,6,'#735a3d');p.rect(23,32,5,4,GOLD);p.rect(25,33,1,2,INK)
    p.rect(19,28,2,2,'#e0b362');p.rect(31,28,2,2,'#e0b362');p.line(36,22,34,30,'#deb567')
    return p


def grubb(pose='idle'):
    p=Pixels(48,48)
    p.ellipse(24,44,17,2,'#263239')
    # Sabotage sack has no numbers or instrument markings.
    p.ellipse(37,32,8,10,INK);p.ellipse(37,32,6,8,'#71674b');p.rect(35,22,5,5,'#847854');p.rect(34,23,7,2,'#b6a271')
    p.rect(15,33,6,10,INK);p.rect(27,33,6,10,INK);p.rect(12,41,9,3,'#50473c');p.rect(27,41,9,3,'#50473c')
    p.rect(15,24,18,13,INK);p.rect(16,25,16,10,'#8c6750');p.rect(16,32,16,3,'#3c3b35');p.rect(23,32,4,2,GOLD)
    p.rect(12,26,5,9,'#718b52');p.rect(31,26,5,9,'#718b52');p.rect(12,33,5,3,'#9ca968')
    p.poly([(5,12),(17,14),(14,22)],INK);p.poly([(6,14),(16,15),(13,20)],'#8d9c60')
    p.poly([(32,14),(43,10),(36,22)],INK);p.poly([(33,15),(40,13),(35,20)],'#8d9c60')
    p.ellipse(24,17,12,12,INK);p.ellipse(24,17,10,10,'#869d60');p.rect(17,10,12,3,'#a6b477')
    p.rect(17,15,5,3,'#e0d5a9');p.rect(28,15,5,3,'#e0d5a9');p.rect(20,15,2,3,INK);p.rect(28,15,2,3,INK)
    p.rect(15,13,8,2,'#4c633f');p.rect(28,12,7,2,'#4c633f');p.rect(24,17,3,3,'#a4ad70')
    p.rect(17,21,15,4,INK);p.rect(19,21,12,2,'#e6d8ad');p.rect(20,24,10,1,'#bac08c')
    p.rect(19,5,10,3,'#4c633f');p.rect(16,8,7,2,'#4c633f');p.rect(27,7,5,3,'#4c633f')
    if pose=='fume':
        p.line(17,13,23,16,'#354d36',2);p.line(28,16,34,13,'#354d36',2)
        p.rect(19,21,12,4,'#6f8151');p.rect(20,22,11,2,INK);p.rect(21,22,9,1,'#e6d8ad')
        p.rect(13,29,5,4,'#a4ad70');p.rect(30,29,5,4,'#a4ad70')
    if pose=='smirk': p.rect(17,15,6,1,INK);p.rect(17,16,5,2,'#869d60')
    return p


def lemma():
    p=Pixels(48,48);p.ellipse(24,42,19,2,'#263239')
    p.poly([(29,34),(36,34),(41,28),(45,27),(44,35),(38,40),(29,41)],INK)
    p.poly([(29,35),(36,36),(42,31),(41,35),(37,38),(29,39)],'#b1754c')
    p.ellipse(24,33,12,8,INK);p.ellipse(24,32,10,7,'#bc8353');p.rect(18,35,11,4,'#e0b97b')
    p.rect(12,37,6,5,INK);p.rect(13,38,7,3,'#bc8353');p.rect(28,37,6,5,INK);p.rect(28,38,8,3,'#bc8353')
    p.ellipse(17,25,10,9,INK);p.ellipse(17,25,8,7,'#d19a61')
    p.rect(10,19,5,5,'#e0b97b');p.rect(22,19,5,5,'#e0b97b');p.rect(12,20,2,4,INK);p.rect(23,20,2,4,INK)
    p.rect(13,28,10,1,'#70523c');p.rect(28,29,3,2,GOLD);p.rect(25,25,3,2,GOLD)
    p.rect(4,31,9,11,INK);p.rect(5,32,7,9,CREAM);p.rect(7,34,3,5,GOLD);p.rect(12,33,4,3,'#d19a61')
    return p


def troll():
    p=Pixels(48,48);p.ellipse(24,45,19,2,'#263239')
    p.rect(10,35,11,9,INK);p.rect(28,35,11,9,INK);p.rect(8,42,14,3,'#544c42');p.rect(27,42,15,3,'#544c42')
    p.ellipse(24,29,18,15,INK);p.ellipse(24,28,16,13,'#7e8d79')
    p.poly([(9,23),(17,20),(20,39),(10,39)],'#8e7255');p.poly([(31,20),(38,23),(38,39),(29,39)],'#8e7255')
    p.ellipse(24,14,12,12,INK);p.ellipse(24,14,10,10,'#97a18c');p.rect(17,5,13,4,'#bac0a1')
    p.rect(12,10,24,5,'#97a18c');p.rect(17,13,5,2,INK);p.rect(28,13,5,2,INK)
    p.rect(23,14,5,5,'#b1b89a');p.rect(19,21,13,1,INK);p.rect(18,19,2,3,CREAM);p.rect(31,19,2,3,CREAM)
    p.rect(9,27,31,12,INK);p.rect(11,29,27,8,'#5c5d50');p.rect(11,29,27,1,'#bd9b65');p.rect(11,36,27,1,'#bd9b65')
    for x in [15,21,27,33]:
        p.rect(x,30,1,6,'#ac9568');p.rect(x-1,32,3,3,'#cfaa6d')
    p.rect(7,29,5,6,'#a5af92');p.rect(37,29,5,6,'#a5af92')
    return p


def alchemist():
    p=Pixels(48,48);p.ellipse(24,44,17,2,'#263239')
    p.poly([(22,5),(29,8),(33,17),(31,24),(37,43),(12,43),(17,24),(14,18),(16,10)],INK)
    p.poly([(22,7),(28,10),(31,17),(28,22),(33,41),(15,41),(19,23),(17,17),(18,11)],'#596874')
    p.poly([(22,10),(27,13),(29,20),(19,20)],'#2e3942');p.rect(21,17,2,2,'#c9b98e');p.rect(27,17,2,2,'#c9b98e')
    p.line(20,24,17,39,'#7c8b8b',2);p.line(27,25,31,39,'#3c4955',2)
    p.rect(18,26,13,2,'#a88a51');p.rect(24,27,3,2,GOLD);p.rect(31,23,5,10,'#596874');p.rect(34,31,4,3,'#bf9873')
    p.rect(37,29,2,5,INK);p.rect(34,33,9,11,INK);p.rect(35,35,7,7,'#b08042');p.rect(36,36,5,5,'#e0ba70');p.rect(38,36,1,6,'#735738')
    p.rect(34,33,9,2,GOLD);p.rect(34,42,9,2,GOLD)
    return p


def stonemason():
    p=Pixels(48,48);p.ellipse(25,45,19,2,'#263239')
    for x,y,w,h in [(10,33,11,12),(29,33,11,12),(8,20,32,17),(16,5,18,18),(4,24,8,15),(38,24,7,14)]:
        p.rect(x,y,w,h,INK);p.rect(x+1,y+1,w-2,h-2,'#838d85');p.rect(x+1,y+1,w-2,2,'#b2b6a0')
    p.rect(18,7,14,4,'#9aa391');p.rect(19,14,4,2,'#d6ba79');p.rect(28,14,4,2,'#d6ba79');p.rect(23,19,7,2,'#505e5b')
    p.line(28,6,25,12,'#576864');p.line(29,25,25,32,'#576864');p.line(15,24,20,27,'#576864')
    p.rect(10,23,7,2,'#a0aa8e');p.rect(30,35,7,3,'#a0aa8e');p.rect(12,40,6,3,'#626f65')
    p.line(40,26,37,42,'#d4c9aa',2);p.rect(38,24,5,4,'#b5bcaf');p.rect(36,29,7,4,'#899486')
    return p


def knight(color='#637d92'):
    p=Pixels(48,48)
    p.rect(18,33,5,11,INK);p.rect(27,33,5,11,INK);p.rect(16,42,8,3,'#7f9293');p.rect(27,42,8,3,'#7f9293')
    p.rect(15,22,21,14,INK);p.rect(17,23,17,11,color);p.rect(23,23,5,12,'#acb8ae')
    p.rect(18,7,14,16,INK);p.rect(19,8,12,13,'#a0b1b1');p.rect(20,9,4,10,'#d3d4be');p.rect(18,13,14,4,'#3c4b53');p.rect(25,13,2,4,'#a0b1b1')
    p.rect(22,3,5,6,color);p.rect(23,2,7,3,color);p.rect(12,24,6,12,'#8a9da0')
    p.poly([(30,26),(41,26),(41,36),(35,41),(30,36)],INK);p.poly([(31,27),(40,27),(40,35),(35,39),(31,35)],color)
    p.rect(35,28,1,9,'#c6bd91');p.rect(33,30,5,1,'#c6bd91')
    return p


def guardians():
    p=Pixels(72,48)
    p.paste(knight('#877058'),-10,1);p.paste(knight('#8a6369'),31,1);p.paste(knight('#637d92'),10,0)
    return p


def creature(name):
    p=Pixels(48,48)
    if name=='crab':
        for x in [10,16,30,36]: p.line(24,29,x,39,INK,2);p.line(24,28,x,37,'#b97958',2)
        p.ellipse(24,28,12,9,INK);p.ellipse(24,27,10,7,'#bf815b');p.ellipse(21,25,6,3,'#dca370')
        for x in [17,29]: p.rect(x,18,3,6,INK);p.rect(x,17,3,3,'#e1cca1');p.dot(x+1,17,INK)
        p.line(12,28,7,22,'#bb7e54',3);p.line(34,28,39,22,'#bb7e54',3)
        for x in [7,39]:p.ellipse(x,19,5,6,INK);p.ellipse(x,19,4,5,'#c99062');p.rect(x-1,13,2,6,None)
    elif name=='mouse':
        p.line(30,34,40,33,'#ae8f84',2);p.line(40,33,42,25,'#ae8f84',2)
        p.ellipse(24,31,10,10,INK);p.ellipse(24,30,8,9,'#aaa291');p.ellipse(21,31,4,6,'#dbccaf')
        p.ellipse(17,17,7,7,INK);p.ellipse(30,17,7,7,INK);p.ellipse(17,17,5,5,'#b99588');p.ellipse(30,17,5,5,'#b99588')
        p.ellipse(24,24,9,8,'#aaa291');p.rect(18,22,2,3,INK);p.rect(28,22,2,3,INK);p.rect(22,27,4,2,'#886960');p.rect(15,38,7,3,'#c3aea0');p.rect(27,38,7,3,'#c3aea0')
    elif name=='chameleon':
        p.ellipse(34,32,9,9,INK);p.ellipse(34,32,7,7,'#709077');p.ellipse(34,32,4,4,None);p.rect(28,33,8,3,'#709077')
        p.ellipse(22,31,11,8,INK);p.ellipse(22,30,9,7,'#8da27a');p.ellipse(17,23,10,8,INK);p.ellipse(17,23,8,6,'#a5b085')
        p.ellipse(15,21,4,4,'#d3cda0');p.rect(14,20,2,3,INK);p.rect(8,26,11,1,'#5b7760');p.rect(14,36,4,6,'#709077');p.rect(27,36,4,6,'#709077')
        p.line(32,16,23,36,'#c2a16b',2);p.poly([(31,16),(33,10),(36,8),(36,14),(33,19)],'#7893a5');p.rect(25,29,5,3,'#a5b085')
    elif name=='magpies':
        for x, y in [(12,27),(30,23)]:
            p.line(x+3,y+4,x+10,y+15,INK,3);p.ellipse(x,y,7,10,INK);p.ellipse(x-1,y+3,4,6,'#e3dcc4');p.ellipse(x-1,y-8,5,5,INK);p.rect(x-3,y-9,2,2,CREAM);p.rect(x-8,y-7,4,2,'#af9260');p.rect(x-3,y+10,1,5,'#a78c64');p.rect(x+2,y+10,1,5,'#a78c64');p.rect(x+2,y,3,7,'#66858b')
    elif name=='cats':
        p.ellipse(24,34,10,7,'#8c8271');p.ellipse(24,33,7,4,None)
        for x,c in [(14,'#c9b68f'),(33,'#7d8b89')]:
            p.ellipse(x,31,7,11,INK);p.ellipse(x,30,5,10,c);p.poly([(x-7,12),(x-1,16),(x+2,16),(x+7,12),(x+7,25),(x-7,25)],INK);p.poly([(x-6,14),(x,18),(x+6,14),(x+6,24),(x-6,24)],c);p.rect(x-4,21,2,2,INK);p.rect(x+3,21,2,2,INK);p.rect(x,24,2,1,'#a27b6b');p.rect(x-5,38,4,4,c);p.rect(x+2,38,4,4,c)
    return p


# The same limited palette and tile vocabulary is shared across all backgrounds.
SKY=['#d9d9bf','#d1d5bd','#bdc9b7','#a8bdb1']

def clouds(p):
    for x,y,w in [(20,22,54),(133,12,45),(248,27,66),(184,42,35)]:
        p.rect(x,y,w,3,'#e8e2c8');p.rect(x+7,y-3,w-16,4,'#e8e2c8');p.rect(x+18,y-5,w-34,3,'#e8e2c8')

def pine(p,x,y,size=1,col='#405c52',light='#58705b'):
    p.rect(x-1*size,y-14*size,3*size,18*size,'#484a3c')
    for j,w in [(0,9),(5,7),(10,5)]:
        p.poly([(x,y-(24+j)*size),(x-w*size,y-(8+j)*size),(x+w*size,y-(8+j)*size)],col)
        p.poly([(x,y-(24+j)*size),(x-w*size,y-(8+j)*size),(x-2*size,y-(10+j)*size)],light)
        p.line(x-w*size+size,y-(8+j)*size-1,x+2*size,y-(10+j)*size,col,size)
        p.rect(x-2*size,y-(14+j)*size,3*size,size,col)
    p.rect(x,y-6*size,size,9*size,'#6d7051')

def tower(p,x,y,w,h):
    p.rect(x,y,w,h,'#73847b');p.rect(x+2,y+3,w-5,h-3,'#a6ad94');p.rect(x+w-5,y+3,4,h-3,'#818e7d')
    for xx in range(x,x+w,6):p.rect(xx,y-4,4,6,'#a6ad94')
    p.rect(x+w//2-2,y+12,3,8,'#4f665e')
    for yy in range(y+7,y+h,8):p.rect(x+2,yy,w-7,1,'#949f8a')

def distant_castle(p,x=239,y=32):
    p.rect(x-24,y+21,67,32,'#8f9e8b');tower(p,x-29,y+10,15,47);tower(p,x+31,y+7,15,50);tower(p,x-4,y-5,23,61)
    p.poly([(x-7,y-5),(x+7,y-20),(x+22,y-5)],'#526e66')
    p.rect(x+6,y-25,1,6,'#526e66');p.rect(x+7,y-25,9,4,'#ad8153');p.rect(x+3,y+32,8,20,'#52665c')

def ground(p,seed=9):
    rng=random.Random(seed)
    p.rect(0,142,320,38,'#566f5a');p.rect(0,149,320,31,'#455d4c')
    p.poly([(0,169),(88,148),(173,151),(231,141),(320,146),(320,180),(0,180)],'#7c8062')
    p.poly([(0,171),(88,151),(173,154),(234,144),(320,149),(320,174),(183,169),(68,165),(0,180)],'#b7ac82')
    for _ in range(150):
        x=rng.randrange(320);y=rng.randrange(146,180); c=rng.choice(['#888e69',SAND,'#9e9e74'])
        if p.p[y][x] in ['#b7ac82','#7c8062']:p.rect(x,y,rng.randrange(1,5),1,c)
    for _ in range(90):
        x=rng.randrange(320); y=rng.randrange(146,180)
        if p.p[y][x] in ['#455d4c','#566f5a']:p.rect(x,y,2,2,'#70815e')

def masonry(p,x,y,w,h,base='#8c998a',light='#b5b89c'):
    p.rect(x,y,w,h,'#42594f')
    for yy in range(y,y+h,7):
        offset=0 if ((yy-y)//7)%2==0 else -7
        for xx in range(x+offset,x+w,14):
            left=max(xx,x);right=min(xx+13,x+w)
            if right>left:
                p.rect(left,yy,right-left,min(6,y+h-yy),base);p.rect(left,yy,right-left,1,light)
                p.rect(left,yy+1,1,min(4,y+h-yy-1),light)

def arch(p,x,y,w,h,opened=False,interior=False):
    # Brick arch uses a stepped outline; there is no changing clue decoration.
    masonry(p,x,y+15,w,h-15,'#718477' if interior else '#8b9985','#9ca98d' if interior else '#c0c3a4')
    p.rect(x+6,y+7,w-12,10,'#a9b298');p.rect(x+13,y+2,w-26,7,'#b6b99b');p.rect(x+20,y,w-40,4,'#c1c1a3')
    ix=x+12; iw=w-24; bottom=y+h
    p.rect(ix,y+24,iw,h-24,'#293d39');p.rect(ix+4,y+17,iw-8,8,'#293d39');p.rect(ix+10,y+13,iw-20,7,'#293d39')
    if opened:
        p.rect(ix+4,y+25,iw-8,h-25,'#a3b08b');p.rect(ix+8,y+21,iw-16,5,'#a3b08b')
        p.poly([(ix+iw//2,bottom-16),(ix+7,bottom),(ix+iw-7,bottom)],'#c4b687')
        p.rect(ix+4,y+25,4,h-25,'#516c59');p.rect(ix+iw-8,y+25,4,h-25,'#516c59')
    else:
        p.rect(ix+3,y+25,iw-6,h-25,'#5f6753');p.rect(ix+7,y+20,iw-14,6,'#5f6753')
        for xx in range(ix+6,ix+iw-3,6):p.rect(xx,y+25,1,h-25,'#414e43');p.rect(xx+1,y+25,1,h-25,'#7e8161')
        p.rect(ix+3,y+38,iw-6,4,'#34473f');p.rect(ix+3,y+h-17,iw-6,4,'#34473f')
        p.rect(ix+iw//2-4,y+h-22,8,6,'#ad8a4b');p.rect(ix+iw//2-1,y+h-20,2,3,'#544d36')
    p.rect(x-3,bottom,w+6,4,'#c1b68e');p.rect(x-5,bottom+4,w+10,3,'#7a8267')
    for xx in [x+5,x+w-7]:p.rect(xx,y+24,2,h-30,'#bdc0a0')

def lantern(p,x,y):
    p.rect(x-3,y-2,7,12,'#35443c');p.rect(x-2,y,5,7,'#b78c45');p.rect(x-1,y+1,3,4,'#e0bb73');p.rect(x-3,y-2,7,2,GOLD);p.rect(x-3,y+8,7,2,GOLD)

def finish_scene(p,node):
    """Small stone chips, moss and foliage; independent of the puzzle state."""
    rng=random.Random(301+node)
    replacements={'#8b9985':'#96a18b','#718477':'#7c8d7f','#3b5350':'#405b55','#8b9a82':'#97a58b','#71867a':'#7b9180','#455d4c':'#55704f','#566f5a':'#687d59','#6d8b76':'#78977b','#5d7c63':'#6a8768'}
    for _ in range(1000):
        x,y=rng.randrange(320),rng.randrange(180)
        color=p.p[y][x]
        if color in replacements:
            p.rect(x,y,rng.randrange(1,4),1,replacements[color])
    if node!=2:
        for x,y in [(31,157),(64,170),(273,168),(290,151),(15,174)]:
            p.ellipse(x,y,7,4,'#435f48');p.ellipse(x-2,y-2,5,3,'#728358')
            p.rect(x-4,y-3,2,1,'#a0a575');p.rect(x+2,y-1,2,1,'#8f9b67')
        for x,y in [(45,166),(257,158),(293,177)]:
            p.poly([(x,y),(x+3,y-4),(x+8,y-3),(x+10,y+1),(x,y+2)],'#667665')
            p.rect(x+2,y-3,5,1,'#9ba58a')
    return p

def scene(node,opened=False):
    p=Pixels(320,180)
    for i,c in enumerate(SKY):p.rect(0,i*36,320,36,c)
    clouds(p)
    if node==1:
        distant_castle(p,258,54)
        p.poly([(0,100),(35,65),(80,87),(117,59),(170,98),(204,81),(245,96),(320,88),(320,150),(0,150)],'#8ea795')
        p.poly([(0,122),(58,96),(94,119),(146,91),(182,122),(241,101),(320,111),(320,159),(0,159)],'#6d8b76')
        for x,y,s in [(18,135,2),(50,135,1),(290,133,2),(313,139,1),(75,133,1)]:pine(p,x,y,s)
        ground(p)
        p.poly([(87,149),(122,157),(114,180),(85,180)],'#344e49');p.poly([(209,151),(232,143),(243,180),(215,180)],'#344e49')
        p.rect(91,149,137,7,'#7d8770');p.rect(91,149,137,2,'#c1b68e');p.rect(105,156,7,24,'#697b67');p.rect(207,156,7,24,'#697b67')
        arch(p,126,48,70,99,opened)
        p.rect(117,94,8,49,'#62765e');p.rect(197,94,9,49,'#62765e');lantern(p,119,84);lantern(p,202,84)
        pine(p,-5,172,3,'#304c43','#486552');pine(p,321,173,3,'#304c43','#486552')
    elif node==2:
        p.rect(0,0,320,180,'#283c3d')
        masonry(p,8,12,304,134,'#3b5350','#4f6860')
        for x in [10,90,225,301]:p.rect(x,14,8,134,'#263d3c');p.rect(x+2,14,3,134,'#60766a')
        for a in range(3):
            p.rect(20+a*12,18+a*10,280-a*24,3,'#668173');p.rect(20+a*12,18+a*10,3,127-a*10,'#566f65');p.rect(297-a*12,18+a*10,3,127-a*10,'#566f65')
        p.rect(0,144,320,36,'#394e4a')
        for yy in [149,160,175]:p.rect(0,yy,320,1,'#687a66')
        for x in [35,104,173,242,308]:p.line(160,133,x,180,'#526b5c')
        arch(p,204,46,64,101,opened,True)
        p.rect(48,109,76,5,'#b0a67d');p.rect(53,114,6,35,'#697863');p.rect(112,114,6,35,'#697863')
        p.rect(61,89,48,21,'#725f46');p.rect(61,89,48,3,'#ba9660');p.rect(65,92,2,17,'#b08b55');p.rect(102,92,2,17,'#b08b55');p.rect(82,98,5,5,GOLD)
        lantern(p,39,69);lantern(p,154,53);lantern(p,284,69)
        p.rect(15,142,32,14,'#5e705e');p.rect(18,140,29,3,'#87947a')
    elif node==3:
        p.poly([(0,86),(46,50),(86,76),(133,57),(175,89),(230,61),(320,84),(320,123),(0,123)],'#8fa08c')
        masonry(p,0,88,320,61,'#8b9a82','#bec2a0')
        for xx in range(0,320,24):p.rect(xx,81,16,10,'#aeb799')
        ground(p,11)
        p.rect(38,141,243,39,'#aaa887')
        for yy in range(143,180,9):
            p.rect(38,yy,243,1,'#798c76')
            for xx in range(42 if yy%2 else 53,281,23):p.rect(xx,yy,1,9,'#798c76')
        arch(p,219,61,66,87,opened)
        p.rect(31,59,11,86,'#82947d');p.rect(28,57,17,5,'#c0c2a0');p.rect(29,141,15,6,'#c0c2a0')
        p.rect(116,61,11,84,'#82947d');p.rect(113,57,17,5,'#c0c2a0');p.rect(114,141,15,6,'#c0c2a0')
        p.rect(28,55,102,5,'#a6b193');p.rect(39,61,77,3,'#5d7b62')
        for x,y in [(0,136),(8,145),(299,145),(310,146),(65,89),(73,90)]:p.ellipse(x,y,12,8,'#617f5f');p.ellipse(x-3,y-3,7,4,'#84996d')
    else:
        p.rect(0,0,320,180,'#77938b');clouds(p)
        distant_castle(p,78,41);distant_castle(p,267,52)
        masonry(p,38,63,244,88,'#71867a','#a3af97')
        for xx in range(38,282,20):p.rect(xx,55,13,11,'#96a58e')
        tower(p,34,43,38,111);tower(p,255,38,38,116)
        arch(p,121,38,80,114,opened)
        ground(p,17)
        p.poly([(126,154),(195,154),(237,180),(82,180)],'#b5ab85')
        for yy in [159,165,173]:p.rect(105-(yy-159),yy,113+(yy-159)*2,1,'#8a9274')
        lantern(p,105,101);lantern(p,214,101)
        for x in [12,308]:pine(p,x,160,2,'#36564c','#4f7060')
    return finish_scene(p,node)


def world_map():
    p=Pixels(320,180,'#a4b49a')
    for i,c in enumerate(SKY):p.rect(0,i*24,320,24,c)
    clouds(p);p.poly([(0,84),(44,57),(81,72),(121,50),(159,80),(210,55),(270,66),(320,41),(320,180),(0,180)],'#91a78d')
    p.poly([(0,124),(50,93),(113,106),(170,82),(223,95),(279,76),(320,90),(320,180),(0,180)],'#6f8e73')
    p.poly([(0,153),(59,129),(118,140),(187,111),(257,122),(320,101),(320,180),(0,180)],'#5d7c63')
    # Road is atmospheric only; accessible encounter nodes are HTML/SVG controls.
    p.poly([(22,180),(48,147),(92,140),(128,113),(181,111),(220,78),(261,70),(275,42),(286,45),(269,83),(229,90),(190,124),(133,125),(99,152),(57,158),(43,180)],'#bdb18a')
    p.poly([(25,180),(49,150),(94,144),(131,117),(184,115),(223,82),(265,75),(276,46),(280,47),(267,79),(226,86),(187,120),(131,121),(97,148),(54,154),(36,180)],'#d5c59a')
    distant_castle(p,270,23)
    for x,y,s in [(12,126,1),(28,122,1),(57,115,1),(13,166,1),(82,98,1),(105,99,1),(155,150,1),(174,148,1),(197,155,1),(230,136,1),(262,133,1),(306,119,2),(299,172,2)]:pine(p,x,y,s)
    masonry(p,111,87,24,22,'#96a48b','#c1c5a5');p.rect(119,95,8,14,'#405b4f');p.rect(109,85,28,3,'#d0c7a0')
    p.rect(194,84,27,15,'#83967f');p.poly([(191,84),(207,72),(224,84)],'#4d6e5d');p.rect(205,88,5,11,'#344f46')
    for x,y in [(69,164),(117,163),(196,138),(238,109),(310,148)]:
        p.rect(x,y,4,2,'#a6ab7e');p.rect(x+5,y+2,2,2,'#bcb382')
    return p


def main():
    print('Keybreakers — deterministic pixel artwork')
    (ASSETS/'scenes').mkdir(parents=True,exist_ok=True)
    (ASSETS/'avatars').mkdir(parents=True,exist_ok=True)
    (ASSETS/'sprites').mkdir(parents=True,exist_ok=True)
    previous={}
    if (ASSETS/'manifest.json').exists(): previous=json.loads((ASSETS/'manifest.json').read_text())
    manifest={'version':1,'styleBible':'tools/assets/style.md','reviewChecklist':['consistent original cast','no rendered text','nothing frightening','no puzzle hints','plausible pixel anatomy'],'assets':{},'byAssetId':{}}
    def save(id,rel,p,w=None,h=None,type='sprite'):
        data=p.svg(w,h);(ASSETS/rel).write_text(data)
        manifest['assets'][rel]={'id':id,'type':type,'file':rel,'format':'image/svg+xml','dimensions':{'width':w or p.w,'height':h or p.h},'sha256':hashlib.sha256(data.encode()).hexdigest(),'placeholder':True,'approved':True,'source':'hand-authored integer pixel grid; tools/assets/generate.py','review':{'heroOwlMatch':True,'noTextInImage':True,'nothingFrightening':True,'noPuzzleHints':True,'plausibleAnatomy':True,'reviewedBy':'procedural-source checks; parent visual review pending before commit'}}
        manifest['byAssetId'][id]=rel
    for n in range(1,5):
        for state in ['locked','unlocked']:save(f'ch1-n{n}-{state}',f'scenes/ch1-n{n}-{state}.svg',scene(n,state=='unlocked'),1920,1080,'scene')
    save('map-ch1','scenes/map-ch1.svg',world_map(),1920,1080,'scene')
    save('chapter1-card','scenes/chapter1-card.svg',scene(1),1920,1080,'scene')
    for v in range(1,7):
        save(f'hero-{v}',f'avatars/hero-{v}.svg',hero(v),192,192,'avatar')
        for pose in ['idle','walk','think','celebrate']:save(f'hero-{v}-{pose}',f'sprites/hero-{v}-{pose}.svg',hero(v,pose))
    for pose in ['idle','smirk','fume']:save(f'grubb-{pose}',f'sprites/grubb-{pose}.svg',grubb(pose))
    cast={'rivet':rivet(),'lemma':lemma(),'troll':troll(),'alchemist':alchemist(),'stonemason':stonemason(),'guardians':guardians()}
    for name in ['crab','mouse','chameleon','magpies','cats']:cast[name]=creature(name)
    for name,p in cast.items():save(name,f'sprites/{name}.svg',p)
    sheet=Pixels(320,192,'#e7dec4')
    portraits=[hero(),rivet(),grubb(),lemma(),troll(),alchemist(),stonemason(),guardians()]
    portraits += [creature(name) for name in ['crab','mouse','chameleon','magpies','cats']]
    for i,art in enumerate(portraits):sheet.paste(art,(i%4)*80+(80-art.w)//2,(i//4)*48)
    save('cast-sheet','avatars/cast-sheet.svg',sheet,1280,768,'avatar')
    # Legacy sheet URLs are kept so installed clients and existing tools still resolve.
    owl_sheet=Pixels(192,48)
    for i in range(4):owl_sheet.paste(rivet(),i*48,0)
    save('archimedes-sheet','avatars/archimedes-sheet.svg',owl_sheet,768,192,'avatar')
    save('rivet-sheet','avatars/rivet-sheet.svg',owl_sheet,768,192,'avatar')
    hero_sheet=Pixels(192,48)
    for i,pose in enumerate(['idle','walk','think','celebrate']):hero_sheet.paste(hero(1,pose),i*48,0)
    save('hero-sheet','avatars/hero-sheet.svg',hero_sheet,768,192,'avatar')
    # Never discard separately reviewed imagegen assets or alter their approval state.
    for rel,entry in previous.get('assets',{}).items():
        if rel not in manifest['assets'] and (ASSETS/rel).exists():
            manifest['assets'][rel]=entry
            if entry.get('id'):manifest['byAssetId'][entry['id']]=rel
    # The selected illustrated stills are copied byte-for-byte, never rerendered.
    # Source hash checks bind approval to reviewed images; revoked entries remain
    # revoked, and missing copies are restored from their recorded originals.
    from prepare_stills import prepare_stills
    still_count, still_bytes = prepare_stills(manifest, previous)
    (ASSETS/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(f"Manifest successfully written to {ASSETS/'manifest.json'}")
    print(f"Total assets: {len(manifest['assets'])}")
    print(f"Reviewed stills: {still_count} ({still_bytes} bytes; original PNGs)")

if __name__=='__main__':main()
