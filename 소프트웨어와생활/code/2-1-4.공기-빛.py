# 교실의 습도를 읽어 빛 띠의 색으로 보여 준다.
# 높은 상태가 한동안 이어지면 버저로 한 번만 짧게 알린다.
#
# 빛 띠의 신호선  -> GP0
# 온습도 센서     -> GP22
# 버저            -> GP15

from machine import Pin, PWM
import neopixel
import dht
import time

DATA_PIN = 0
SENSOR_PIN = 22
BUZZER_PIN = 15

COUNT = 8            # 띠에 달린 알의 개수
READ_EVERY = 5       # 몇 초마다 읽을지
HIGH_LIMIT = 70      # 이 값 이상이면 높다고 본다
HOLD_COUNT = 36      # 5초 x 36 = 180초, 곧 3분

strip = neopixel.NeoPixel(Pin(DATA_PIN), COUNT)
sensor = dht.DHT11(Pin(SENSOR_PIN))
buzzer = PWM(Pin(BUZZER_PIN))


# region: 색고르기
def color_for(humidity):
    """습도 값 하나를 색 하나로 옮긴다."""
    if humidity < 40:
        return (0, 10, 60)      # 메마름 - 푸른빛
    if humidity < 60:
        return (0, 40, 20)      # 알맞음 - 초록빛
    if humidity < HIGH_LIMIT:
        return (50, 35, 0)      # 슬슬 답답함 - 노란빛
    return (60, 0, 0)           # 높음 - 붉은빛
# endregion


def paint(color):
    """띠 전체를 한 가지 색으로 물들인다."""
    for i in range(COUNT):
        strip[i] = color
    strip.write()


# region: 알림
def beep():
    """짧게 한 번 소리를 낸다."""
    buzzer.freq(880)
    buzzer.duty_u16(2000)
    time.sleep(0.2)
    buzzer.duty_u16(0)
# endregion


# region: 본문
high_streak = 0     # 높은 값이 몇 번이나 이어졌는지 센다

while True:
    sensor.measure()
    humidity = sensor.humidity()
    paint(color_for(humidity))

    if humidity >= HIGH_LIMIT:
        high_streak = high_streak + 1
    else:
        high_streak = 0

    if high_streak == HOLD_COUNT:   # 딱 맞을 때 한 번만 울린다
        beep()

    time.sleep(READ_EVERY)
# endregion
