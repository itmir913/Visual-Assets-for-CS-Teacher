import {defineCheck} from './_check.mjs';
import {check} from '../tools/checks/sim-index.mjs';

// 구운 결과가 저장소의 `simulator/index.html` 과 같은가. 굽는 쪽은 `npm run gen:sim-index`.
defineCheck('sim-index', check);
