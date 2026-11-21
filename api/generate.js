const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { default: OpenAI } = require('openai');
const { validate, validateActivities } = require('./validate.js');

const systemPrompt = readFileSync(join(__dirname, '..', '시스템 프롬프트.txt'), 'utf8');
const MAX_BODY_BYTES = 100 * 1024;

class RequestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isNonBlankText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidInput(type, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false;
  }
  if (type === 'quiz') {
    return Number.isInteger(input.count) && input.count >= 1 && input.count <= 20 &&
      Array.isArray(input.types) && input.types.length > 0 && input.types.every(isNonBlankText);
  }
  return Number.isFinite(input.duration) && input.duration > 0;
}

async function readBody(req) {
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new RequestError(413, 'INVALID_INPUT', '요청이 너무 큽니다.');
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function sendError(res, status, code, message) {
  sendJson(res, status, { error: { code, message } });
}

function createDefaultClient(endpoint, apiKey) {
  return new OpenAI({ baseURL: endpoint, apiKey });
}

function createGenerateHandler({ createClient = createDefaultClient } = {}) {
  return async function generate(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      sendError(res, 405, 'METHOD_NOT_ALLOWED', 'POST 요청만 사용할 수 있습니다.');
      return;
    }

    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      if (error instanceof RequestError) {
        sendError(res, error.status, error.code, error.message);
      } else {
        sendError(res, 400, 'INVALID_INPUT', '요청 본문이 올바른 JSON이 아닙니다.');
      }
      return;
    }

    const { type, input } = body ?? {};
    if ((type !== 'quiz' && type !== 'activity') || !isValidInput(type, input)) {
      sendError(res, 400, 'INVALID_INPUT', '요청 유형 또는 입력값을 확인하세요.');
      return;
    }

    const endpoint = process.env.AI_ENDPOINT;
    const apiKey = process.env.AI_API_KEY;
    const deployment = process.env.AI_DEPLOYMENT;
    if (![endpoint, apiKey, deployment].every(isNonBlankText)) {
      sendError(res, 500, 'CONFIG_MISSING', 'AI 연결 설정이 없습니다. 관리자에게 문의하세요.');
      return;
    }

    const passesValidation = (result) => type === 'quiz'
      ? validate(result, { count: input.count, types: input.types })
      : validateActivities(result, { duration: input.duration });

    let client;
    try {
      client = createClient(endpoint, apiKey);
    } catch {
      sendError(res, 502, 'AI_FAILED', 'AI 연결을 초기화하지 못했습니다. 관리자에게 문의하세요.');
      return;
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      let completion;
      try {
        completion = await client.chat.completions.create({
          model: deployment,
          messages: [
            { role: 'system', content: attempt === 0 ? systemPrompt :
              `${systemPrompt}\n이전 응답이 형식 검사를 통과하지 못했습니다. 요청 조건과 JSON 구조를 다시 확인한 뒤, 조건을 모두 충족하는 JSON 객체만 새로 출력하세요.` },
            { role: 'user', content: `type: ${type}\n${JSON.stringify(input)}` },
          ],
          response_format: { type: 'json_object' },
        });
      } catch {
        sendError(res, 502, 'AI_FAILED', 'AI 응답을 받지 못했습니다. 잠시 후 다시 시도하세요.');
        return;
      }

      let result;
      try {
        result = JSON.parse(completion.choices?.[0]?.message?.content ?? '');
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        continue;
      }
      if (passesValidation(result)) {
        sendJson(res, 200, result);
        return;
      }
    }

    sendError(res, 502, 'AI_FAILED', 'AI 응답 형식이 올바르지 않습니다. 다시 요청했지만 검사를 통과하지 못했습니다.');
  };
}

module.exports = createGenerateHandler();
module.exports.createGenerateHandler = createGenerateHandler;
