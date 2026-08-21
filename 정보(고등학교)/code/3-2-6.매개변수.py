def discount(price, rate):
    return round(price * (1 - rate))


print(discount(12000, 0.1))
print(discount(12000, 0.25))
