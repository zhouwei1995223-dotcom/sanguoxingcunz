#!/bin/bash
# 对比：旧版（不喝药、无锦囊）/ 只有金疮药 / 金疮药+锦囊 的胜率
# 用法：tools/balance3.sh "3 5 7" 0.85 8
CHS=${1:-"3 5"}; P=${2:-0.85}; N=${3:-8}
for ch in $CHS; do
  for mode in old potion full; do
    case $mode in old) ENVS="NOPOTION=1 NOSTRAT=1";; potion) ENVS="NOSTRAT=1";; full) ENVS="";; esac
    line="第${ch}章 战力${P} ${mode}:"; total=0
    for h in zhaoyun guanyu zhangfei zhuge lvbu; do
      ( env $ENVS HERO=$h POWER=$P node dist/sim/sim.js $ch 0 0 $N 2>&1 | grep -c 胜利 > /tmp/b3_${ch}_${mode}_${h} ) &
    done
    wait
    for h in zhaoyun guanyu zhangfei zhuge lvbu; do v=$(cat /tmp/b3_${ch}_${mode}_${h}); total=$((total+v)); line="$line $h $v/$N"; done
    echo "$line  合计 $total/$((N*5))"
  done
done
