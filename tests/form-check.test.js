const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const scriptPath = join(__dirname, '../public/js/form-check.js');
const browser = {};
runInNewContext(readFileSync(scriptPath, 'utf8'), browser, { filename: scriptPath });

const topicLabel = '단원 또는 주제';

function programmaticInput(value, maxLength = 100) {
  return {
    value,
    maxLength,
    required: true,
    // 값이 코드로 설정되면 브라우저가 길이 초과를 표시하지 않을 수 있다.
    validity: { valid: true, tooLong: false },
    validationMessage: '',
  };
}

test('주제 100자 및 앞뒤 공백을 제외한 100자는 허용한다', () => {
  const topic = '가'.repeat(100);
  assert.equal(browser.validationMessage(programmaticInput(topic), topicLabel), '');
  assert.equal(browser.validationMessage(programmaticInput(` ${topic} `), topicLabel), '');
});

test('프로그램으로 입력한 주제 101자는 항목 이름과 100자 한도를 안내한다', () => {
  const message = browser.validationMessage(programmaticInput('가'.repeat(101)), topicLabel);
  assert.ok(message.includes(topicLabel), '오류에 주제 항목 이름이 있어야 한다');
  assert.match(message, /\b100\b/);
});

test('과목에도 해당 HTML 길이 한도인 30자를 적용한다', () => {
  const label = '과목';
  assert.equal(browser.validationMessage(programmaticInput('가'.repeat(30), 30), label), '');
  const message = browser.validationMessage(programmaticInput('가'.repeat(31), 30), label);
  assert.ok(message.includes(label), '오류에 과목 항목 이름이 있어야 한다');
  assert.match(message, /\b30\b/);
});
