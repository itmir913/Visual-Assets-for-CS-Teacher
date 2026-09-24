import numpy as np
import Orange.data.pandas_compat as p

# 입력 데이터를 판다스의 데이터프레임에 저장
df = p.pd.concat(in_data.to_pandas_dfs(), axis=1)

# 각 속성에서 0의 값을 결측치(NaN)로 대체
df['종경(mm)']  = df['종경(mm)'].replace(0, np.nan)
df['횡경(mm)']  = df['횡경(mm)'].replace(0, np.nan)
df['L/D 비율']  = df['L/D 비율'].replace(0, np.nan)
df['경도평균']  = df['경도평균'].replace(0, np.nan)

# 데이터프레임의 값을 출력하기
out_data = p.table_from_frame(df)
