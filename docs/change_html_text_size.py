# import glob # 더 이상 사용하지 않으므로 주석 또는 삭제 가능
import os


def adjust_text_sizes(file_path):
    # 파일 읽기 (UTF-8 인코딩)
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()

    # 🔄 텍스트 크기 변환 규칙 (가장 큰 폰트 -> 작은 폰트 순서)
    replacements = [
        ("text-6xl", "text-7xl"),
        ("text-5xl", "text-6xl"),
        ("text-4xl", "text-5xl"),
        ("text-3xl", "text-4xl"),
        ("text-2xl", "text-3xl"),
        ("text-xl", "text-2xl"),
        ("text-lg", "text-xl"),
        ("text-base", "text-lg"),
        ("text-sm", "text-base"),
        ("text-xs", "text-base")
    ]

    # 순차적으로 replace 수행
    for old_class, new_class in replacements:
        content = content.replace(old_class, new_class)

    # 결과를 원본 파일에 그대로 덮어쓰기
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(content)

    print(f"✅ 변환 완료: '{os.path.basename(file_path)}'")


# ---------------------------------------------------------
# 📂 내가 원하는 특정 HTML 파일들만 지정하여 일괄 처리
# ---------------------------------------------------------

# 기존 전체 폴더 탐색 로직 주석 처리
# target_files = glob.glob("*.html")

# 📝 변환을 원하는 파일명들을 아래 리스트에 쉼표(,)로 구분하여 입력하세요.
target_files = [
    "example1.html",
    "example2.html",
    "test_page.html"
]

if not target_files:
    print("❌ 처리할 파일 목록이 비어있습니다.")
else:
    print(f"🚀 지정된 {len(target_files)}개의 HTML 파일 텍스트 크기 교정을 시작합니다...\n")

    for file_name in target_files:
        # 파일이 실제로 존재하는지 확인 후 변환 진행
        if os.path.exists(file_name):
            adjust_text_sizes(file_name)
        else:
            print(f"⚠️ 파일을 찾을 수 없습니다: '{file_name}' (건너뜀)")

    print("\n🎉 모든 파일의 텍스트 크기 변환 작업이 완료되었습니다!")
