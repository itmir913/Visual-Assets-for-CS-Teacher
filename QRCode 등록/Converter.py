import pandas as pd
import requests
import json

# ================= 설정 구간 (유지보수용 변수) =================
INPUT_FILE = "input_data.csv"
OUTPUT_FILE = "output_result.csv"
TARGET_COLUMN_INDEX = 3  # D열
NEW_COLUMN_NAME = "시리얼번호"
API_URL = "https://schoolreg.org/GG/AS/MB/UGGASMBA01/selectMngNo"
PREFIX_TO_REMOVE = "https://schoolreg.org/GD?A="


# ======================================================

def get_serial_number(qr_data):
    # QR 데이터 유효성 검사 (접두사 확인)
    if not isinstance(qr_data, str) or PREFIX_TO_REMOVE not in qr_data:
        return None, f"잘못된 QR코드: {qr_data}"

    try:
        # 데이터 가공 및 요청 바디 생성
        mng_no = qr_data.replace(PREFIX_TO_REMOVE, "")
        payload = {
            "dm_asInfo": {
                "MNG_NO": mng_no,
                "MNG3_NO": mng_no[0:2],
                "MNG6_NO": mng_no[2:5],
                "MNG8_NO": mng_no[5:],
                "MNG_FNO": "", "CTPV_EDU_CD": "", "SCHL_CD": "", "SCHL_NM": "",
                "SCHL_DTL_CD": "", "ROAD_NM_ADDR": "", "DEPT_CD": "", "IO_GB": "",
                "OPRTR_CE_ID": "", "OPRTR_CE_HP_NO": "", "OPRTR_CE_EML_ADDR": "",
                "SETL_NO": "", "ZIP_CD": "", "PROD_EVT_CD": "", "PROD_BIZDGR_CD": "",
                "PROD_GENIDV_GB": "", "PROD_SEQ_NO": "", "MDLGRP_CD": "",
                "MDLGRP_NM": "", "PROD_CD": "", "PROD_NM": ""
            }
        }

        # HTTP POST 요청 발송
        headers = {'Content-Type': 'application/json'}
        response = requests.post(API_URL, data=json.dumps(payload), headers=headers)

        if response.status_code == 200:
            # 성공 시 결과 추출
            res_data = response.json()
            serial = res_data.get("dm_prodInfo", {}).get("PROD_SEQ_NO", "결과없음")
            return serial, None
        else:
            return f"에러({response.status_code})", f"HTTP 오류(상태코드: {response.status_code})"

    except Exception as e:
        return "통신실패", f"예외 발생: {str(e)}"


def main():
    try:
        # CSV 파일 로드
        df = pd.read_csv(INPUT_FILE)
        total = len(df)
        target_col = df.columns[TARGET_COLUMN_INDEX]
        results = []

        print(f"--- 데이터 처리 시작 (총 {total}건) ---")

        for i, row in df.iterrows():
            curr_idx = i + 1
            qr_val = str(row[target_col])

            # API 처리 수행
            serial, error_msg = get_serial_number(qr_val)
            results.append(serial if serial else error_msg)

            if error_msg:
                # 오류 발생 시 새 줄에 출력하여 로그 유지
                print(f"\n[오류] {curr_idx}번 행: {error_msg}")
            else:
                # 정상 진행 시 한 줄에서 업데이트
                print(f"처리 진행 중: [{curr_idx}/{total}]", end="\r")

        # 새 열 추가 및 저장
        df[NEW_COLUMN_NAME] = results
        df.to_csv(OUTPUT_FILE, index=False, encoding='utf-8-sig')

        print(f"\n" + "=" * 40)
        print(f"작업 완료! 생성된 파일: {OUTPUT_FILE}")

    except Exception as e:
        print(f"\n파일 처리 중 치명적 오류 발생: {e}")


if __name__ == "__main__":
    main()