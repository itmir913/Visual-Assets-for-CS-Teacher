# 네오픽셀 띠의 첫 번째 알만 켠다.
# 띠의 DI(데이터 입력) 선은 GP0번 핀에 꽂아 두었다고 본다.

from machine import Pin
import neopixel
import time

DATA_PIN = 0   # 띠의 DI를 꽂은 핀 번호
COUNT = 8      # 띠에 달린 알의 개수

strip = neopixel.NeoPixel(Pin(DATA_PIN), COUNT)

# region: 켜기
strip[0] = (0, 40, 60)   # 빨강 0, 초록 40, 파랑 60
strip.write()            # 정한 값을 실제로 띠에 보낸다
# endregion

time.sleep(3)

# region: 끄기
strip[0] = (0, 0, 0)
strip.write()
# endregion
