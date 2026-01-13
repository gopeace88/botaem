"use strict";
/**
 * Playbook Types - 플레이북 관련 타입 정의
 * @module @botame/types/playbook
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SELECTOR_STRATEGIES = exports.DIFFICULTY_LEVELS = exports.ACTION_TYPES = void 0;
// ============================================
// 기본 타입
// ============================================
/** 지원하는 액션 타입 */
exports.ACTION_TYPES = [
    "navigate",
    "click",
    "type",
    "select",
    "wait",
    "guide",
    "scroll",
    "hover",
    // Guide app additional actions
    "assert",
    "highlight",
    "condition",
    "loop",
    "extract",
    "validate",
];
/** 난이도 */
exports.DIFFICULTY_LEVELS = ["쉬움", "보통", "어려움"];
// ============================================
// 셀렉터 타입
// ============================================
/** 셀렉터 전략 */
exports.SELECTOR_STRATEGIES = [
    "css",
    "xpath",
    "text",
    "role",
    "testId",
    "placeholder",
    "label",
];
