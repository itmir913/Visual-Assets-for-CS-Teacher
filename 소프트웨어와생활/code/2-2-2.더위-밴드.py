# 손목에 차는 「더위 조심 밴드」.
# 온도와 습도를 함께 보고 조심할 단계를 매겨 색으로 알린다.
# 단계가 올라간 그 순간에만 짧게 한 번 소리를 낸다.
#
# 빛 띠      -> GP0
# 온습도 센서 -> GP22
# 버저        -> GP15

from machine import Pin, PWM
import neopixel
import dht
import time

DATA_PIN = 0
SENSOR_PIN = 22
BUZZER_PIN = 15

COUNT = 4          # 밴드에는 알을 적게 쓴다
READ_EVERY = 10    # 몇 초마다 읽을지 - 자주 읽으면 전지가 빨리 닳는다
SAMPLES = 5        # 한 번 판단할 때 몇 번 읽을지

COLORS = (
    (0, 30, 20),   # 0단계 - 편안함
    (40, 30, 0),   # 1단계 - 슬슬 더움
    (60, 20, 0),   # 2단계 - 조심
    (70, 0, 0),    # 3단계 - 쉬어 가기
)

strip = neopixel.NeoPixel(Pin(DATA_PIN), COUNT)
sensor = dht.DHT11(Pin(SENSOR_PIN))
buzzer = PWM(Pin(BUZZER_PIN))


# region: 가운데값
def middle(values):
    """읽은 값들을 크기순으로 늘어놓고 가운데 것을 고른다.

    몸에 닿은 센서는 조금만 움직여도 값이 튄다.
    가장 크게 튄 값과 가장 작게 튄 값을 자연스럽게 버리는 방법이다.
    """
    ordered = sorted(values)
    return ordered[len(ordered) // 2]
# endregion


def read_steady():
    """여러 번 읽어 흔들림이 적은 온도와 습도를 얻는다."""
    temperatures = []
    humidities = []
    for _ in range(SAMPLES):
        sensor.measure()
        temperatures.append(sensor.temperature())
        humidities.append(sensor.humidity())
        time.sleep(1.5)
    return middle(temperatures), middle(humidities)


# region: 단계
def level_of(temperature, humidity):
    """온도와 습도를 함께 보고 0부터 3까지의 단계를 매긴다.

    이 셈은 수업에서 원리를 확인하려고 우리가 지어낸 것이다.
    공식 지표가 아니므로 건강을 판단하는 근거로 쓰면 안 된다.
    """
    score = temperature + (humidity - 40) * 0.1
    if score < 27:
        return 0
    if score < 30:
        return 1
    if score < 33:
        return 2
    return 3
# endregion


def paint(color):
    """밴드의 알을 모두 한 색으로 물들인다."""
    for i in range(COUNT):
        strip[i] = color
    strip.write()


def beep():
    """짧게 한 번 소리를 낸다."""
    buzzer.freq(660)
    buzzer.duty_u16(1500)
    time.sleep(0.15)
    buzzer.duty_u16(0)


# region: 본문
last_level = 0

while True:
    temperature, humidity = read_steady()
    level = level_of(temperature, humidity)
    paint(COLORS[level])

    if level > last_level:       # 올라갈 때만 알린다
        beep()
    last_level = level

    time.sleep(READ_EVERY)
# endregion
