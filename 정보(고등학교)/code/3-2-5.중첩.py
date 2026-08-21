image = [
    [255, 255, 0, 255, 255],
    [255, 0, 0, 0, 255],
    [0, 0, 0, 0, 0],
]

dark = 0

for row in image:
    for value in row:
        if value == 0:
            dark = dark + 1

print(dark)
