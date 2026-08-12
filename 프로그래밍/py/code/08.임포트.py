# ---
# check: none
# ---
import math
print(math.sqrt(16))            # 4.0   꾸러미 이름을 앞에 붙여 부른다

import math as m
print(m.sqrt(16))               # 4.0   긴 이름에 짧은 별명을 붙인다

from math import sqrt
print(sqrt(16))                 # 4.0   필요한 것만 꺼내 오면 이름 없이 부른다
