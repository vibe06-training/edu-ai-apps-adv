const form = document.querySelector('#preview-form');
const result = document.querySelector('#result-values');
const status = document.querySelector('#result-status');
const samples = document.querySelector('#sample-cards');
const sampleStatus = document.querySelector('#sample-status');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  samples.replaceChildren();
  sampleStatus.classList.remove('sample-error');
  const { rows, firstInvalid } = checkPreviewForm(form);

  if (firstInvalid) {
    result.hidden = true;
    result.replaceChildren();
    status.textContent = '입력 항목을 확인한 뒤 다시 제출해 주세요.';
    sampleStatus.textContent = '입력을 수정한 뒤 다시 제출하면 샘플을 검증합니다.';
    firstInvalid.focus();
    return;
  }

  result.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'result-row';
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    return row;
  }));
  result.hidden = false;
  status.textContent = '제출한 입력값입니다.';

  const type = samples.dataset.preview;
  const formData = new FormData(form);
  const input = {};
  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key);
    input[key] = key === 'groupings' ? values : values[0];
  }
  // Server contract: count is a number, quiz types is an array, activity uses duration.
  input.count = Number(input.count);
  if (type === 'quiz') {
    input.types = [input.type];
  } else {
    input.duration = Number(input.minutes);
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  sampleStatus.textContent = type === 'quiz' ? '퀴즈를 생성하고 있습니다.' : '학습활동을 추천하고 있습니다.';
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, input }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      showSampleError(body?.error?.message ?? `요청에 실패했습니다. (HTTP ${response.status})`);
      return;
    }
    const items = (type === 'quiz' ? body.questions : body.activities)
      .map((item, index) => ({ ...item, number: index + 1 }));
    samples.append(...items.map(type === 'quiz' ? quizCard : activityCard));
    sampleStatus.textContent = `AI가 만든 내용입니다. 수업에 쓰기 전에 확인하세요. (${type === 'quiz' ? '문항' : '활동'} ${items.length}개)`;
  } catch {
    showSampleError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    submitButton.disabled = false;
  }
});

function textElement(tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function quizCard(item) {
  const card = document.createElement('article');
  card.className = 'card sample-card';
  const choices = document.createElement('ol');
  choices.append(...item.choices.map((choice) => textElement('li', choice)));

  const answer = document.createElement('details');
  answer.append(
    textElement('summary', '정답 및 해설 보기'),
    textElement('p', `정답: ${item.answer}번 — ${item.choices[item.answer - 1]}`),
    textElement('p', item.explanation),
  );
  card.append(textElement('h3', `${item.number}. ${item.question}`), choices, answer);
  return card;
}

function activityCard(item) {
  const card = document.createElement('article');
  card.className = 'card sample-card';
  card.append(
    textElement('h3', `${item.number}. ${item.title}`),
    textElement('p', `${item.grouping} 활동 · 소요 시간 ${item.minutes}분`),
    textElement('p', `준비물: ${item.materials.length ? item.materials.join(', ') : '없음'}`),
  );
  return card;
}

function showSampleError(message) {
  sampleStatus.textContent = message;
  sampleStatus.classList.add('sample-error');
}

function showMockCards(input) {
  if (typeof mockPreview === 'undefined') {
    showSampleError('샘플을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 제출해 주세요.');
    return;
  }

  const isQuiz = samples.dataset.preview === 'quiz';
  const count = Number(input.get('count'));
  const response = mockPreview.data[samples.dataset.preview];
  const passed = isQuiz
    ? mockPreview.validate(response, { count, types: [input.get('type')] })
    : mockPreview.validateActivities(response, { duration: Number(input.get('minutes')) }) &&
      response.activities.length === count;

  if (!passed) {
    showSampleError(isQuiz
      ? '샘플 문항 검증에 실패했습니다. 선택형 5문항으로 설정했는지 확인해 주세요.'
      : '샘플 활동 검증에 실패했습니다. 추천 개수가 3개이고 활동 시간이 40분 이상인지 확인해 주세요.');
    return;
  }

  const items = isQuiz ? response.questions : response.activities;
  samples.append(...items.map(isQuiz ? quizCard : activityCard));
  sampleStatus.textContent = `검증을 통과한 ${isQuiz ? '문항' : '활동'} ${items.length}개입니다.`;
}
