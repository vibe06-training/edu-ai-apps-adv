const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createGenerateHandler } = require('../api/generate.js');
const quizMock = require('../mock/quiz.json');

const AI_KEYS = ['AI_ENDPOINT', 'AI_API_KEY', 'AI_DEPLOYMENT'];

function withEnv(values, fn) {
  const saved = Object.fromEntries(AI_KEYS.map((key) => [key, process.env[key]]));
  for (const key of AI_KEYS) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  return fn().finally(() => {
    for (const key of AI_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
}

async function call(handler, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = 'POST';
  const res = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(text) { this.body = JSON.parse(text); },
  };
  await handler(req, res);
  return res;
}

function fakeClient(content, calls) {
  return (endpoint, apiKey) => ({
    chat: {
      completions: {
        async create(params) {
          calls.push({ endpoint, apiKey, params });
          return { choices: [{ message: { content: typeof content === 'function' ? content(calls.length) : content } }] };
        },
      },
    },
  });
}

const config = { AI_ENDPOINT: 'https://example.test/v1', AI_API_KEY: 'test-key', AI_DEPLOYMENT: 'test-model' };
const quizInput = { count: 5, types: ['선택형'], subject: '수학' };

test('generate: 퀴즈 요청의 첫 줄에 type을 넣고 검증된 응답을 반환한다', () => withEnv(config, async () => {
  const calls = [];
  const handler = createGenerateHandler({ createClient: fakeClient(JSON.stringify(quizMock.response), calls) });
  const res = await call(handler, { type: 'quiz', input: quizInput });

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(res.body, quizMock.response);
  assert.equal(calls[0].endpoint, config.AI_ENDPOINT);
  assert.equal(calls[0].apiKey, config.AI_API_KEY);
  assert.equal(calls[0].params.model, config.AI_DEPLOYMENT);
  const [firstLine, rest] = calls[0].params.messages[1].content.split('\n');
  assert.equal(firstLine, 'type: quiz');
  assert.deepEqual(JSON.parse(rest), quizInput);
}));

test('generate: 잘못된 입력·설정 누락·검증 실패를 오류 코드로 구분한다', () => withEnv(config, async () => {
  const calls = [];
  const badAnswer = { ...quizMock.response, questions: quizMock.response.questions.map((q) => ({ ...q, answer: 5 })) };
  const handler = createGenerateHandler({ createClient: fakeClient(JSON.stringify(badAnswer), calls) });

  for (const body of [{ type: 'essay', input: quizInput }, { type: 'quiz', input: { ...quizInput, count: 21 } },
    { type: 'activity', input: { duration: 0 } }]) {
    const res = await call(handler, body);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'INVALID_INPUT');
  }
  assert.equal(calls.length, 0);

  const invalid = await call(handler, { type: 'quiz', input: quizInput });
  assert.equal(invalid.statusCode, 502);
  assert.equal(invalid.body.error.code, 'AI_FAILED');

  await withEnv({ ...config, AI_API_KEY: undefined }, async () => {
    const missing = await call(handler, { type: 'activity', input: { duration: 40 } });
    assert.equal(missing.statusCode, 500);
    assert.equal(missing.body.error.code, 'CONFIG_MISSING');
  });
  assert.equal(calls.length, 2);
}));

test('generate: 검사에서 거부된 응답은 한 번 다시 요청해 올바른 응답만 반환한다', () => withEnv(config, async () => {
  const calls = [];
  const first = { ...quizMock.response, questions: quizMock.response.questions.slice(0, 4) };
  const handler = createGenerateHandler({
    createClient: fakeClient((attempt) => JSON.stringify(attempt === 1 ? first : quizMock.response), calls),
  });
  const res = await call(handler, { type: 'quiz', input: quizInput });

  assert.equal(calls.length, 2);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, quizMock.response);
  assert.deepEqual(calls[0].params.messages[1], calls[1].params.messages[1]);
}));

test('generate: 파싱할 수 없는 응답도 한 번만 다시 요청하고 502를 반환한다', () => withEnv(config, async () => {
  const calls = [];
  const handler = createGenerateHandler({ createClient: fakeClient('{"questions":', calls) });
  const res = await call(handler, { type: 'quiz', input: quizInput });

  assert.equal(calls.length, 2);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error.code, 'AI_FAILED');
  assert.match(res.body.error.message, /다시 요청했지만/);
}));
