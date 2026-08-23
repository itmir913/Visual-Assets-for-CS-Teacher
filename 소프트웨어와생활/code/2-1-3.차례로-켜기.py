# 띠의 알을 한 알씩 차례로 켜고, 끝까지 가면 모두 끈 뒤 다시 시작한다.

from machine import Pin
import neopixel
import time

DATA_PIN = 0
COUNT = 8

strip = neopixel.NeoPixel(Pin(DATA_PIN), COUNT)


# region: 모두끄기
def clear():
    """띠의 모든 알을 끈다."""
    for i in range(COUNT):
        strip[i] = (0, 0, 0)
    strip.write()
# endregion


# region: 반복
while True:
    for i in range(COUNT):
        strip[i] = (0, 30, 50)
        strip.write()
        time.sleep(0.1)
    time.sleep(0.5)
    clear()
    time.sleep(0.5)
# endregion
