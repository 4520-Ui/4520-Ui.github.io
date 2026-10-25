import { getCollection } from 'astro:content';

export function url(path = '/') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
export function dateLabel(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(date);
}
export async function publicNotes() {
  return (await getCollection('notes', ({ data }) => data.publish === true))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
export async function allProjects() {
  return (await getCollection('projects')).sort((a, b) => a.data.order - b.data.order);
}
