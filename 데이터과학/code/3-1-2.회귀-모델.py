# ---
# check: none
# ---
# X는 속성들, y는 맞힐 값이다. 두 값을 준비해 두었다고 보고 모델만 만든다.
from sklearn.linear_model import LinearRegression

reg = LinearRegression().fit(X, y)
