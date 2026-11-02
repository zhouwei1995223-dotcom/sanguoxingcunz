#!/bin/bash
# 守城胜率批量测试：tools/defbatch.sh "1:bare 2:bare 4:bare 4:built" 3
# 每个配置跑 N 局（默认 3，同时跑），输出每局结果和胜场
CFGS=${1:-"1:bare 4:bare 4:built"}; N=${2:-3}
OUT=${TMPDIR:-/tmp}/defbatch; mkdir -p $OUT
for cfg in $CFGS; do
  lv=${cfg%%:*}; prof=${cfg##*:}
  for i in $(seq 1 $N); do
    ( Q="?skip=1&lv=$lv&prof=$prof&full=1" timeout 600 node tools/shot.mjs defense > $OUT/${lv}_${prof}_$i.log 2>&1 ) &
  done
  wait
  wins=0; line=""
  for i in $(seq 1 $N); do
    f=$OUT/${lv}_${prof}_$i.log
    r=$(grep '^{' $f | tail -n 1 | python3 -c "import sys,json;d=json.loads(sys.stdin.read() or '{}');print(('胜' if d.get('won') else '败'), str(d.get('t'))+'s', '城'+str(round(100*d.get('city',0)/max(1,d.get('max',1))))+'%')" 2>/dev/null)
    case "$r" in 胜*) wins=$((wins+1));; esac
    line="$line | $r"
  done
  p=$(grep -o 'PROFILE.*' $OUT/${lv}_${prof}_1.log | head -n 1 | cut -c9-)
  echo "第${lv}关 $prof 胜 $wins/$N $line   $p"
done
