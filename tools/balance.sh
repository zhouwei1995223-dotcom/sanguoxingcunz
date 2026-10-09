#!/bin/bash
# 平衡矩阵：每个武将在指定章节、按推荐战力的不同比例各跑 N 局，输出胜率
# 用法：tools/balance.sh "3 5 7" "0.7 1.0" 8
CHS=${1:-"3 5"}; PS=${2:-"0.7 1.0"}; N=${3:-8}
for ch in $CHS; do for p in $PS; do
  line="第${ch}章 战力${p}:"
  for h in zhaoyun guanyu zhangfei zhuge lvbu; do
    ( HERO=$h POWER=$p node dist/sim/sim.js $ch 0 0 $N 2>&1 | grep -c 胜利 > /tmp/bal_${ch}_${p}_${h} ) &
  done
  wait
  for h in zhaoyun guanyu zhangfei zhuge lvbu; do line="$line $h $(cat /tmp/bal_${ch}_${p}_${h})/$N"; done
  echo "$line"
done; done
