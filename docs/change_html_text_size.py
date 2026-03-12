import glob
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
# 📂 현재 폴더 내의 모든 HTML 파일 자동 탐색
# ---------------------------------------------------------
target_files = glob.glob("*.html")

if not target_files:
    print("❌ 현재 폴더에 HTML 파일이 없습니다.")
else:
    print(f"🚀 총 {len(target_files)}개의 HTML 파일 텍스트 크기 교정을 시작합니다...\n")
    for file_name in target_files:
        adjust_text_sizes(file_name)
    print("\n🎉 모든 파일의 텍스트 크기 변환이 완료되었습니다!")
