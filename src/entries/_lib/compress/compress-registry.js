/* 무엇을 보여 줄지 정하는 곳. **연산도 그림도 여기 없다** — 무엇이 있는지만 적는다.
 *
 * 찾기 시뮬레이터의 등록부와 같은 자리다. 탭을 늘리거나 프리셋을 바꿀 때
 * 손대는 파일이 하나로 모인다.
 */

import {rleEncode, rleDecode} from './compress-rle.js';
import {huffmanEncode, huffmanTree, huffmanDecode, codesOf} from './compress-huffman.js';
import {keywordEncode, keywordDecode} from './compress-keyword.js';

/**
 * 프리셋. **하나하나가 「무엇을 보이려고」 있는 것이지 종류를 채운 것이 아니다.**
 *
 * 셋을 나란히 돌렸을 때 **어느 하나가 늘 이기지 않는 것**이 이 목록의 요건이다.
 * 한 방법이 모든 프리셋에서 이기면 학생은 「그럼 그것만 쓰면 되잖아」로 끝낸다.
 * `check:compress`가 그 조건을 값으로 지킨다.
 */
export const COMPRESS_PRESETS = [
    {
        id: 'runs',
        name: '이어진 반복이 많다',
        text: 'AAAAABBCCC',
        hint: '같은 글자가 붙어 있다. 런 렝스가 노리는 모양이고, 강의노트가 든 예와 같은 글이다.',
    },
    {
        id: 'flat',
        name: '이어지지 않고 되풀이된다',
        text: 'ABABABABAB',
        hint: '반복이 분명히 있는데 <b>이어져 있지 않다.</b> 런 렝스는 늘어나고 허프만은 그대로다.',
    },
    {
        id: 'none',
        name: '반복이 하나도 없다',
        text: 'ABCDEFGHIJ',
        hint: '줄일 거리가 없다. <b>압축률이 음수로 나오는 것</b>을 보라고 둔 글이다.',
    },
    {
        id: 'skew',
        name: '한 글자가 유난히 잦다',
        text: 'AAAAAAAAAABCDEFG',
        hint: 'A만 열 번이고 나머지는 한 번씩이다. <b>허프만이 노리는 모양</b>이다.',
    },
    {
        id: 'word',
        name: '같은 낱말이 되풀이된다',
        text: 'ABCABCABCABC',
        hint: '세 글자짜리 조각이 네 번 나온다. <b>키워드 인코딩이 노리는 모양</b>이다.',
    },
    {
        id: 'same',
        name: '전부 같은 글자',
        text: 'AAAAAAAAAAAAAAAAAAAA',
        hint: '가장 잘 줄어드는 글이다. 그런데 <b>허프만은 하나도 못 줄인다</b> — 구별할 것이 없기 때문이다.',
    },
];

/**
 * 방법 셋.
 *
 * `run`은 스냅샷을 만들고, `decode`는 되돌린다. **되돌리기가 없으면 압축이 아니다** —
 * 검사가 판마다 이것으로 원본과 대 본다.
 */
export const COMPRESS_METHODS = [
    {
        id: 'rle',
        name: '런 렝스 부호화',
        short: '이어진 반복을 줄인다',
        icon: 'fa-grip-lines',
        view: 'scan',
        run: rleEncode,
        decode: (out) => rleDecode(out.out),
        /** 화면 아래에 붙는 「이 방법은 무엇을 노리는가」. **본문보다 단정해지지 않게 쓴다.** */
        idea: '<b>이어져 있는</b> 같은 글자를 「글자 + 횟수」로 적습니다. '
            + '방법이 아주 간단해 빠르지만, <b>이어진 부분이 없으면 오히려 길어집니다</b> — '
            + '글자마다 「1번」을 덧붙이게 되기 때문입니다.',
        notes: [
            '가지런한 칸이 <b>원본</b>이고, 아래에 쌓이는 것이 <b>줄여 적은 결과</b>입니다.',
            '지금 묶고 있는 구간이 <b>노란색</b>으로 덮입니다.',
            '조각 하나는 「글자 + 횟수」라 <b>글자 몇 개를 묶었든 크기가 같습니다.</b>',
        ],
    },
    {
        id: 'huffman',
        name: '허프만 코딩',
        short: '자주 나오는 것을 짧게',
        icon: 'fa-code-branch',
        view: 'tree',
        run: huffmanEncode,
        decode: (out) => {
            const tree = huffmanTree(out.text);
            return huffmanDecode(out.out.map((o) => o.code).join(''), tree);
        },
        idea: '자주 나오는 글자에 <b>짧은 코드</b>를, 드물게 나오는 글자에 긴 코드를 줍니다. '
            + '글자마다 길이가 달라지는 것이 특징입니다. '
            + '그래서 <b>횟수가 고르면 이득이 없습니다</b> — 짧은 코드를 줄 「자주 나오는 글자」가 없기 때문입니다.',
        notes: [
            '가장 작은 둘을 묶어 올라가며 나무를 짓습니다. <b>자주 나오는 쪽이 왼쪽</b>입니다.',
            '뿌리에서 잎까지 걸어가며 <b>왼쪽 0, 오른쪽 1</b>을 주워 담은 것이 그 글자의 코드입니다.',
            '<b>자주 나온 글자일수록 잎이 위에 있어</b> 코드가 짧습니다.',
        ],
    },
    {
        id: 'keyword',
        name: '키워드 인코딩',
        short: '되풀이되는 조각을 기호로',
        icon: 'fa-tag',
        view: 'scan',
        run: keywordEncode,
        decode: (out) => keywordDecode(out.encoded, out.dict),
        idea: '떨어져 있어도 <b>되풀이되는 조각</b>을 기호 하나로 바꿉니다. '
            + '<b>이득이 큰 것부터 차례로 고를 뿐이고, 가장 좋은 답을 찾아 주지는 않습니다</b> — '
            + '조각끼리 겹치고 서로를 잡아먹어서 다 헤아려 보지 않고는 알 수 없기 때문입니다.',
        notes: [
            '바꿀 조각이 정해지면 <b>노란색</b>으로 덮이고, 그 자리가 기호 하나가 됩니다.',
            '바꾼 뒤 <b>남은 글자의 가짓수가 줄면 칸도 좁아집니다</b> — 줄이는 방식의 절반이 이것입니다.',
            '기호가 무엇인지는 <b>사전을 봐야</b> 알 수 있습니다. 그래서 사전을 함께 보내야 합니다.',
        ],
    },
];

export const methodOf = (id) => COMPRESS_METHODS.find((m) => m.id === id) || COMPRESS_METHODS[0];

/** 함께 보내야 하는 것의 이름. 방법마다 부르는 말이 다르다. */
export const sideNameOf = (id) => (id === 'keyword' ? '사전' : '코드표');

/**
 * 화면 아래 「화면 읽는 법」에 늘 붙는 말.
 *
 * **압축률에서 무엇을 뺐는지 숨기지 않는다.** 이것을 안 적으면 학생은 코드표가
 * 공짜라고 읽고, 「짧은 글에서는 압축이 손해일 수 있다」를 영영 못 만난다.
 */
export const COMPRESS_COMMON_NOTES = [
    '크기는 <b>비트</b>로 셉니다. 줄이기 전은 <b>글자마다 같은 길이 코드를 줬을 때</b>입니다 — '
    + '글자가 여덟 가지면 하나에 3비트입니다.',
    '<b>압축률은 본문만으로 냅니다.</b> 코드표와 사전은 크기를 옆에 따로 적습니다 — '
    + '<b>받는 쪽이 되살리려면 그것도 함께 보내야 하므로 없는 셈 칠 수는 없습니다.</b>',
    '코드표와 사전은 <b>알맹이만 셌습니다.</b> 줄을 어디서 끊는지 표시하는 자리는 '
    + '적는 방식에 따라 달라져서 세지 않았습니다.',
];
