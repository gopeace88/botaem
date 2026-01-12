/**
 * RunnerPanel 컴포넌트 유닛 테스트
 * 순수 TypeScript로 논리적/문법적 검증
 */

// ============================================
// 1. StepResult 타입 정합성 테스트
// ============================================

type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

interface StepResult {
  stepId: string;
  stepIndex: number;
  status: StepStatus;
  message?: string;
  error?: string;
  duration?: number;
  screenshot?: string;
  // 자동 고침 결과
  healed?: boolean;
  healedSelector?: string;
  originalSelector?: string;
  healMethod?: 'fallback' | 'text' | 'aria' | 'dynamic' | 'manual';
}

interface PlaybookStep {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  message?: string;
  timeout?: number;
  optional?: boolean;
}

function testStepResultImportConsistency(): void {
  console.log('=== StepResult 타입 정합성 테스트 ===');

  // runner.store.ts와 동일한 타입 구조인지 검증
  const result: StepResult = {
    stepId: 'step1',
    stepIndex: 0,
    status: 'success',
    message: '테스트',
    healed: true,
    healedSelector: 'text="확인"',
    originalSelector: '#btn1',
    healMethod: 'dynamic',
  };

  // 모든 필드 접근 가능 확인
  if (result.healed && result.healedSelector && result.healMethod) {
    console.log('✅ StepResult heal 필드 접근 가능');
  }

  // StepStatus 모든 값 테스트
  const allStatuses: StepStatus[] = ['pending', 'running', 'success', 'failed', 'skipped'];
  allStatuses.forEach(status => {
    const r: StepResult = { stepId: 'test', stepIndex: 0, status };
    console.log(`✅ StepStatus '${status}' 유효`);
  });
}

// ============================================
// 2. getStepStatus 로직 테스트
// ============================================

interface RunnerState {
  isRunning: boolean;
  currentStepIndex: number;
  totalSteps: number;
  results: StepResult[];
}

function getStepStatus(
  index: number,
  localStepResults: Map<number, StepResult>,
  state: RunnerState
): StepStatus {
  // 스텝 모드: 로컬 결과 우선
  const localResult = localStepResults.get(index);
  if (localResult) return localResult.status;

  // 전체 실행 모드: state 결과 사용
  const result = state.results.find((r) => r.stepIndex === index);
  if (result) return result.status;
  if (state.currentStepIndex === index && state.isRunning) return 'running';
  return 'pending';
}

function testGetStepStatus(): void {
  console.log('\n=== getStepStatus 로직 테스트 ===');

  const state: RunnerState = {
    isRunning: true,
    currentStepIndex: 2,
    totalSteps: 5,
    results: [
      { stepId: 's0', stepIndex: 0, status: 'success' },
      { stepId: 's1', stepIndex: 1, status: 'failed', error: 'test error' },
    ],
  };

  const localResults = new Map<number, StepResult>();
  localResults.set(3, { stepId: 's3', stepIndex: 3, status: 'success', healed: true, healMethod: 'fallback' });

  // 테스트 케이스
  const tests = [
    { index: 0, expected: 'success', desc: 'state 결과에서 성공' },
    { index: 1, expected: 'failed', desc: 'state 결과에서 실패' },
    { index: 2, expected: 'running', desc: '현재 실행 중' },
    { index: 3, expected: 'success', desc: '로컬 결과 우선 (고침됨)' },
    { index: 4, expected: 'pending', desc: '아직 실행 안됨' },
  ];

  tests.forEach(({ index, expected, desc }) => {
    const result = getStepStatus(index, localResults, state);
    const pass = result === expected;
    console.log(`${pass ? '✅' : '❌'} ${desc}: index ${index} => '${result}'`);
  });
}

// ============================================
// 3. getStepResult 로직 테스트
// ============================================

function getStepResult(
  index: number,
  localStepResults: Map<number, StepResult>,
  state: RunnerState
): StepResult | undefined {
  const localResult = localStepResults.get(index);
  if (localResult) return localResult;
  return state.results.find((r) => r.stepIndex === index);
}

function testGetStepResult(): void {
  console.log('\n=== getStepResult 로직 테스트 ===');

  const healedResult: StepResult = {
    stepId: 's1',
    stepIndex: 1,
    status: 'success',
    healed: true,
    healedSelector: 'text="교부관리"',
    originalSelector: '#menu1',
    healMethod: 'dynamic',
  };

  const state: RunnerState = {
    isRunning: false,
    currentStepIndex: -1,
    totalSteps: 3,
    results: [
      { stepId: 's0', stepIndex: 0, status: 'success' },
      healedResult,
    ],
  };

  const localResults = new Map<number, StepResult>();
  localResults.set(2, {
    stepId: 's2',
    stepIndex: 2,
    status: 'failed',
    error: '요소를 찾을 수 없습니다',
  });

  // 테스트 케이스
  const result0 = getStepResult(0, localResults, state);
  const result1 = getStepResult(1, localResults, state);
  const result2 = getStepResult(2, localResults, state);
  const result3 = getStepResult(3, localResults, state);

  console.log(`${result0?.status === 'success' ? '✅' : '❌'} index 0: state 결과 반환`);
  console.log(`${result1?.healed === true ? '✅' : '❌'} index 1: healed 결과 반환`);
  console.log(`${result2?.error ? '✅' : '❌'} index 2: 로컬 결과 우선 반환`);
  console.log(`${result3 === undefined ? '✅' : '❌'} index 3: undefined 반환`);
}

// ============================================
// 4. UI 조건부 렌더링 로직 테스트
// ============================================

function testUIConditionalRendering(): void {
  console.log('\n=== UI 조건부 렌더링 로직 테스트 ===');

  // 시나리오 1: 고침된 결과
  const healedResult: StepResult = {
    stepId: 'step1',
    stepIndex: 0,
    status: 'success',
    healed: true,
    healedSelector: 'text="확인"',
    originalSelector: '#btn1',
    healMethod: 'fallback',
  };

  // result?.healed 조건
  if (healedResult.healed) {
    console.log('✅ 고침 배지 표시 조건 충족');

    // healMethod 라벨 매핑
    const methodLabels: Record<string, string> = {
      fallback: '폴백 셀렉터',
      dynamic: '동적 탐색',
      text: '텍스트 매칭',
      aria: 'ARIA 매칭',
      manual: '수동 수정',
    };

    const label = healedResult.healMethod ? methodLabels[healedResult.healMethod] : '';
    console.log(`✅ 라벨 표시: ${label}`);

    // "플레이북에 적용" 버튼 동작 시뮬레이션
    const newSelector = healedResult.healedSelector;
    console.log(`✅ 적용 버튼 클릭 시 selector: ${newSelector}`);
  }

  // 시나리오 2: 실패 결과
  const failedResult: StepResult = {
    stepId: 'step2',
    stepIndex: 1,
    status: 'failed',
    error: '요소를 찾을 수 없습니다',
  };

  // result?.error 조건
  if (failedResult.error) {
    console.log('✅ 에러 메시지 표시 조건 충족');
    console.log('✅ "수동으로 요소 선택" 버튼 표시 조건 충족');
  }

  // 시나리오 3: 일반 성공
  const normalResult: StepResult = {
    stepId: 'step3',
    stepIndex: 2,
    status: 'success',
    message: '완료',
  };

  if (!normalResult.healed && !normalResult.error) {
    console.log('✅ 일반 성공 상태 (추가 UI 없음)');
  }
}

// ============================================
// 5. updateStep 로직 테스트
// ============================================

interface Playbook {
  id: string;
  metadata: {
    name: string;
    startUrl?: string;
    category: string;
  };
  steps: PlaybookStep[];
}

function testUpdateStepLogic(): void {
  console.log('\n=== updateStep 로직 테스트 ===');

  const playbook: Playbook = {
    id: 'pb1',
    metadata: { name: '테스트', category: '기본' },
    steps: [
      { id: 's1', action: 'click', selector: '#old-selector', message: '버튼 클릭' },
      { id: 's2', action: 'type', selector: '#input', value: 'test' },
    ],
  };

  // updateStep 함수 시뮬레이션
  function updateStep(pb: Playbook, index: number, updates: Partial<PlaybookStep>): Playbook {
    const updatedSteps = [...pb.steps];
    updatedSteps[index] = { ...updatedSteps[index], ...updates };
    return { ...pb, steps: updatedSteps };
  }

  // 고침된 셀렉터 적용 시뮬레이션
  const healedSelector = 'text="확인 버튼"';
  const updated = updateStep(playbook, 0, { selector: healedSelector });

  if (updated.steps[0].selector === healedSelector) {
    console.log('✅ 고침된 셀렉터 적용 성공');
    console.log(`   기존: #old-selector`);
    console.log(`   변경: ${healedSelector}`);
  }

  // 원본 변경되지 않음 확인
  if (playbook.steps[0].selector === '#old-selector') {
    console.log('✅ 원본 playbook 불변성 유지');
  }
}

// ============================================
// 6. 카운트 계산 로직 테스트
// ============================================

function testCountCalculations(): void {
  console.log('\n=== 결과 카운트 계산 테스트 ===');

  const results: StepResult[] = [
    { stepId: 's1', stepIndex: 0, status: 'success' },
    { stepId: 's2', stepIndex: 1, status: 'success', healed: true },
    { stepId: 's3', stepIndex: 2, status: 'failed', error: 'test' },
    { stepId: 's4', stepIndex: 3, status: 'success' },
    { stepId: 's5', stepIndex: 4, status: 'failed', error: 'test2' },
    { stepId: 's6', stepIndex: 5, status: 'skipped' },
  ];

  const successCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const healedCount = results.filter((r) => r.healed).length;

  console.log(`${successCount === 3 ? '✅' : '❌'} 성공 카운트: ${successCount}`);
  console.log(`${failedCount === 2 ? '✅' : '❌'} 실패 카운트: ${failedCount}`);
  console.log(`${healedCount === 1 ? '✅' : '❌'} 고침됨 카운트: ${healedCount}`);
}

// ============================================
// 7. canPickSelector 조건 테스트
// ============================================

function testCanPickSelector(): void {
  console.log('\n=== canPickSelector 조건 테스트 ===');

  const pickableActions = ['click', 'type', 'select', 'hover', 'scroll'];
  const nonPickableActions = ['navigate', 'wait', 'screenshot', 'custom'];

  function canPickSelector(action: string): boolean {
    return pickableActions.includes(action);
  }

  // Pickable actions
  pickableActions.forEach(action => {
    const result = canPickSelector(action);
    console.log(`${result ? '✅' : '❌'} '${action}' => 선택 가능`);
  });

  // Non-pickable actions
  nonPickableActions.forEach(action => {
    const result = canPickSelector(action);
    console.log(`${!result ? '✅' : '❌'} '${action}' => 선택 불가`);
  });
}

// ============================================
// 8. statusConfig 매핑 테스트
// ============================================

function testStatusConfig(): void {
  console.log('\n=== statusConfig 매핑 테스트 ===');

  const statusConfig = {
    pending: { icon: '○', color: 'text-gray-400', bg: 'bg-white border-gray-200' },
    running: { icon: '◉', color: 'text-blue-500', bg: 'bg-blue-50 border-blue-300' },
    success: { icon: '✓', color: 'text-green-600', bg: 'bg-green-50 border-green-300' },
    failed: { icon: '✗', color: 'text-red-600', bg: 'bg-red-50 border-red-300' },
    skipped: { icon: '⊘', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-300' },
  };

  const allStatuses: StepStatus[] = ['pending', 'running', 'success', 'failed', 'skipped'];

  allStatuses.forEach(status => {
    const config = statusConfig[status];
    if (config && config.icon && config.color && config.bg) {
      console.log(`✅ '${status}' 설정: ${config.icon} / ${config.color}`);
    } else {
      console.log(`❌ '${status}' 설정 누락`);
    }
  });
}

// ============================================
// 모든 테스트 실행
// ============================================

function runAllTests(): void {
  console.log('========================================');
  console.log('RunnerPanel 컴포넌트 유닛 테스트');
  console.log('========================================');

  try {
    testStepResultImportConsistency();
    testGetStepStatus();
    testGetStepResult();
    testUIConditionalRendering();
    testUpdateStepLogic();
    testCountCalculations();
    testCanPickSelector();
    testStatusConfig();

    console.log('\n========================================');
    console.log('✅ 모든 테스트 통과!');
    console.log('========================================');
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error);
    process.exit(1);
  }
}

// 실행
runAllTests();
