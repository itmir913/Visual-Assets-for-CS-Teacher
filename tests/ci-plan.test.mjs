import {defineCheck} from './_check.mjs';
import {check} from '../tools/checks/ci-plan.mjs';

defineCheck('ci-plan', check);
