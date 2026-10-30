#!/bin/bash
# 当前版本（金疮药 + 锦囊）的胜率：tools/balfull.sh "3 6" 0.85 8
CHS=${1:-"3 6"}; P=${2:-0.85}; N=${3:-8}
# HEROES 环境变量可以只测部分武将，默认全部十位
HS=${HEROES:-"zhaoyun guanyu zhangfei zhuge lvbu huangzhong machao sunshangxiang dianwei jiangwei"}
for ch in $CHS; do
  line="第${ch}章 战力${P}:"; total=0
  for h in $HS; do
    ( HERO=$h POWER=$P node dist/sim/sim.js $ch 0 0 $N 2>&1 | grep -c 胜利 > ${TMPDIR:-/tmp}/bf_${ch}_${h} ) &
  done
  wait
  for h in $HS; do v=$(cat ${TMPDIR:-/tmp}/bf_${ch}_${h}); total=$((total+v)); line="$line $h $v/$N"; done
  echo "$line  合计 $total/$((N*$(echo $HS | wc -w)))"
done
