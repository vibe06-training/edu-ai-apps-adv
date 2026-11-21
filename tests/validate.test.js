const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, validateActivities } = require('../api/validate.js');

test('퀴즈: 요청 문항 수, 문항 형식, 정답과 해설을 검사한다', () => {
  const question = {
    number: 1,
    type: '선택형',
    difficulty: '보통',
    question: '얼음이 물로 변하는 상태 변화는 무엇인가?',
    choices: ['융해', '응고', '기화', '액화'],
    answer: 1,
    explanation: '고체가 액체로 변하는 현상을 융해라고 한다.',
  };
  const title = '물질의 상태 변화';
  const options = { count: 5, types: ['선택형'] };
  const questions = Array.from({ length: 5 }, (_, index) => ({
    ...question,
    number: index + 1,
  }));
  assert.equal(validate({ title, questions }, options), true, '유효한 문항 5개');
  assert.equal(validate({ title, questions: questions.slice(0, 4) }, options), false, '문항 수 불일치');
  assert.equal(validate({ title, questions: [{ ...question, answer: 4 }] }, { ...options, count: 1 }), true, '정답 번호 상한');

  for (const [label, changes] of [
    ['보기 3개', { choices: ['융해', '응고', '기화'] }],
    ['보기 중복', { choices: ['융해', '융해', '기화', '액화'] }],
    ['정답 번호 하한 미만', { answer: 0 }],
    ['정답 번호 상한 초과', { answer: 5 }],
    ['정수가 아닌 정답 번호', { answer: 2.5 }],
    ['빈 문제', { question: '  ' }],
    ['빈 정답', { answer: '  ' }],
    ['빈 해설', { explanation: '  ' }],
    ['정답 필드 누락', { answer: undefined }],
  ]) {
    const response = { title, questions: [{ ...question, ...changes }] };
    assert.equal(validate(response, { ...options, count: 1 }), false, label);
  }
});

test('학습활동: 활동 3개, 소요 시간 합계와 필수 항목을 검사한다', () => {
  const activity = {
    number: 1,
    title: '기후 그래프 짝 맞추기',
    grouping: '짝',
    minutes: 10,
    materials: ['기후 그래프 카드'],
    steps: ['지역 카드와 그래프를 비교한다.', '선택한 이유를 한 문장으로 쓴다.'],
    goalLink: '자료를 근거로 지역별 기후 차이를 설명한다.',
    check: '짝마다 선택한 이유를 발표한다.',
  };
  const options = { duration: 40 };
  const activities = [
    activity,
    { ...activity, number: 2, grouping: '모둠', minutes: 20 },
    { ...activity, number: 3 },
  ];

  assert.equal(validateActivities({ activities }, options), true, '활동 3개의 합계가 요청 시간과 같음');
  assert.equal(validateActivities({ activities: activities.slice(0, 2) }, options), false, '활동 수 불일치');
  assert.equal(validateActivities({ activities }, { duration: 39 }), false, '개별 시간은 범위 내지만 합계가 요청 시간 초과');

  for (const [label, changes] of [
    ['진행 순서가 1단계', { steps: ['그래프를 읽는다.'] }],
    ['빈 활동명', { title: '  ' }],
    ['빈 진행 단계', { steps: ['그래프를 읽는다.', '  '] }],
    ['빈 학습 목표 연결', { goalLink: '  ' }],
    ['빈 확인 방법', { check: '  ' }],
  ]) {
    const response = { activities: [{ ...activity, ...changes }, ...activities.slice(1)] };
    assert.equal(validateActivities(response, options), false, label);
  }
});
