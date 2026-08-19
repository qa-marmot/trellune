import { UNIT_05_LESSONS } from './unit05';
import { UNIT_06_LESSONS } from './unit06';
import { UNIT_07_LESSONS } from './unit07';
import { UNIT_08_LESSONS } from './unit08';
import { UNIT_09_LESSONS } from './unit09';
import { UNIT_10_LESSONS } from './unit10';

export const INDEPENDENT_UNIT_LESSONS = Object.freeze([
	UNIT_05_LESSONS,
	UNIT_06_LESSONS,
	UNIT_07_LESSONS,
	UNIT_08_LESSONS,
	UNIT_09_LESSONS,
	UNIT_10_LESSONS,
]);

export const INDEPENDENT_LESSONS = Object.freeze(INDEPENDENT_UNIT_LESSONS.flat());
