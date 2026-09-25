# ---
# check: none
# ---
# 의료 AI 진단 프로그램 (의사코드)
def analyze_xray_image(patient_xray):

    model = load_model("lung_disease_data")
    disease_probability = model.predict(patient_xray)

    if disease_probability > 0.8:
        print("위험 징후 발견! 의사 확인 필요")
    else:
        print("정상 패턴")
