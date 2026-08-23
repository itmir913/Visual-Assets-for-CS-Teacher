# 온습도 센서가 읽은 값을 화면에 찍어 본다.
# 센서의 신호선은 GP22번 핀에 꽂아 두었다고 본다.

from machine import Pin
import dht
import time

SENSOR_PIN = 22

sensor = dht.DHT11(Pin(SENSOR_PIN))

while True:
    # region: 읽기
    sensor.measure()                 # 센서에게 지금 값을 측정하라고 시킨다
    temperature = sensor.temperature()
    humidity = sensor.humidity()
    print("온도", temperature, "도 / 습도", humidity, "%")
    # endregion

    time.sleep(3)   # 이 센서는 너무 자주 읽으면 값을 주지 않는다
