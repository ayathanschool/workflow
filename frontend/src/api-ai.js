// Frontend API for AI lesson plan suggestions
import { callAPI } from './api.js';

export async function suggestLessonPlan(payload) {
  const res = await callAPI('suggestLessonPlan', payload);
  return res && (res.data || res);
}

export async function suggestLessonPlansBulk(payload) {
  const res = await callAPI('suggestLessonPlansBulk', payload);
  return res && (res.data || res);
}
