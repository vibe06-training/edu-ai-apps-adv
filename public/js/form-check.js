function requiredMessage(label) {
  const last = label.charCodeAt(label.length - 1);
  const particle = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0 ? '을' : '를';
  return `${label}${particle} 입력하세요.`;
}

function validationMessage(input, label) {
  if (input.validity.badInput) {
    return `${label}에 숫자를 입력하세요.`;
  }
  const value = input.value.trim();
  if (input.required && !value) {
    return requiredMessage(label);
  }
  if (input.validity.rangeUnderflow && !input.max) {
    return `${label}은 ${input.min}분 이상 입력하세요.`;
  }
  if (input.validity.rangeOverflow || input.validity.rangeUnderflow || input.validity.stepMismatch) {
    return `${input.min}~${input.max} 사이의 정수를 입력하세요.`;
  }
  const maxLength = input.maxLength;
  if (Number.isInteger(maxLength) && maxLength >= 0 && value.length > maxLength) {
    return `${label}은(는) ${maxLength}자 이하로 입력하세요.`;
  }
  return input.validity.valid ? '' : input.validationMessage;
}

function checkPreviewForm(form) {
  const rows = [];
  let firstInvalid;

  for (const field of form.querySelectorAll('.field')) {
    field.querySelector('.field-error')?.remove();
    const controls = [...field.querySelectorAll('input, select, textarea')];
    const control = controls[0];
    for (const input of controls) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
    const isGroup = field.hasAttribute('data-choice-group');
    const label = field.querySelector('[data-label]').dataset.label;
    const value = isGroup
      ? controls.filter((input) => input.checked).map((input) => input.value).join(', ')
      : control.value.trim();
    const message = isGroup
      ? (value ? '' : requiredMessage(label))
      : validationMessage(control, label);

    if (message) {
      const error = document.createElement('p');
      error.id = `${control.id || control.name}-error`;
      error.className = 'field-error';
      error.textContent = message;
      field.append(error);
      for (const input of controls) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', error.id);
      }
      firstInvalid ??= control;
    } else if (value) {
      rows.push([label, value]);
    }
  }

  return { rows, firstInvalid };
}
