import time

start = time.time()

total = 0
for i in range(1000000):
    total = total + i

end = time.time()

print(round(end - start, 3), '초')
