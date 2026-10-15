#!/bin/bash
# 当前版本（金疮药 + 锦囊）的胜率：tools/balfull.sh "3 6" 0.85 8
CHS=${1:-"3 6"}; P=${2:-0.85}; N=${3:-8}
for ch in $CHS; do
  line="第${ch}章 战力${P}:"; total=0
  for h in zhaoyun guanyu zhangfei zhuge lvbu; do
    ( HERO=$h POWER=$P node dist/sim/sim.js $ch 0 0 $N 2>&1 | grep -c 胜利 > /tmp/bf_${ch}_${h} ) &
  done
  wait
  for h in zhaoyun guanyu zhangfei zhuge lvbu; do v=$(cat /tmp/bf_${ch}_${h}); total=$((total+v)); line="$line $h $v/$N"; done
  echo "$line  合计 $total/$((N*5))"
done
