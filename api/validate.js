function isNonBlankText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validate(response, request) {
  const { title, questions } = response ?? {};
  const { count, types } = request ?? {};
  if (!isNonBlankText(title) || !Number.isInteger(count) || count < 1 ||
      !Array.isArray(questions) || questions.length !== count ||
      !Array.isArray(types) || types.length === 0 || !Array.from(types).every(isNonBlankText)) {
    return false;
  }

  for (const item of questions) {
    if (!item || !types.includes(item.type) ||
        !isNonBlankText(item.question) || !isNonBlankText(item.explanation) ||
        !Array.isArray(item.choices) || item.choices.length !== 4 ||
        !Number.isInteger(item.answer) || item.answer < 1 || item.answer > 4) {
      return false;
    }
    const choices = Array.from(item.choices);
    if (!choices.every(isNonBlankText) || new Set(choices.map((choice) => choice.trim())).size !== 4) {
      return false;
    }
  }
  return true;
}

function validateActivities(response, request) {
  const { activities } = response ?? {};
  const { duration } = request ?? {};
  if (!Array.isArray(activities) || activities.length !== 3 ||
      !Number.isFinite(duration) || duration <= 0) {
    return false;
  }

  let totalMinutes = 0;
  for (const activity of activities) {
    if (!activity || !isNonBlankText(activity.title) || !isNonBlankText(activity.grouping) ||
        !Number.isFinite(activity.minutes) || activity.minutes <= 0 ||
        !Array.isArray(activity.materials) || !Array.from(activity.materials).every(isNonBlankText) ||
        !Array.isArray(activity.steps) || activity.steps.length < 2 ||
        !Array.from(activity.steps).every(isNonBlankText) ||
        !isNonBlankText(activity.goalLink) || !isNonBlankText(activity.check)) {
      return false;
    }
    totalMinutes += activity.minutes;
  }
  return totalMinutes <= duration;
}

module.exports = { validate, validateActivities };
