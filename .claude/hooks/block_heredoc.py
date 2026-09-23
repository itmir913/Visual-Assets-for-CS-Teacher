# -*- coding: utf-8 -*-
"""셸 명령에 heredoc(<<)이 들어 있으면 막는다.

이 저장소의 Git Bash에서 heredoc은 따옴표를 쳐도 백슬래시와 백틱을 먹는다.
정규식이 조용히 망가진 채로 파일에 쓰여, 오류가 한참 뒤에야 드러난다.
스크립트는 Write 도구로 파일에 쓰고 그 파일을 실행한다.
"""
import json
import re
import sys

data = json.load(sys.stdin)
cmd = (data.get('tool_input') or {}).get('command') or ''
# PowerShell 여기-문자열(@' '@ · @" "@)도 같은 까닭으로 막는다.
if re.search(r'<<', cmd) or re.search(r"@['\"]\s*$", cmd, re.M):
    sys.stderr.write('heredoc 금지 — 스크립트는 Write 도구로 파일에 쓰고 그 파일을 실행하라.\n')
    sys.exit(2)
