#!/bin/bash
# 单条计策强度：第 CH 章、战力 P，开局 2 分钟强制获得某计策（不喝药以外的锦囊），统计五名武将总胜率
# 用法：tools/stratpower.sh 6 0.75 6
CH=${1:-6}; P=${2:-0.75}; N=${3:-6}
ids="none libing shengou shensu yiyi jiliang qinwang yangjing paozhuan beishui kurou caochuan lianhuan jinchan huoshao shimian chenhuo guohe wanjian jiedao qixing wolong bazhen taoyuan yiqi"
for id in $ids; do
  for h in zhaoyun guanyu zhangfei zhuge lvbu; do
    if [ "$id" = none ]; then E="NOSTRAT=1"; else E="FORCE=$id"; fi
    ( env $E HERO=$h POWER=$P node dist/sim/sim.js $CH 0 0 $N 2>&1 | grep -c 胜利 > /tmp/sp_${id}_${h} ) &
  done
  wait
  t=0; for h in zhaoyun guanyu zhangfei zhuge lvbu; do t=$((t+$(cat /tmp/sp_${id}_${h}))); done
  echo "$id $t/$((N*5))"
done
