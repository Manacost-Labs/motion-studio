// Образец данных Hearthstone для демо канала, витрин и стендов (yt-template-demo, yt-motion-showcase, PosterCalib.tsx рядом):
// sample-article.json — копия байт-в-байт article.json ролика yt-legend-decks-sep26 (статья «15 колод для Легенды»,
// hs-manacost.ru, 20.09.2026). Общий код студий берёт образец отсюда, а не из папки чужого ролика.
// Обновлять только целиком (скопировать файл заново) — по нему сняты эталоны qa/golden/yt-template-demo
import type {ArticleData} from '../data/article';
import sample from './sample-article.json';

export const SAMPLE_ARTICLE = sample satisfies ArticleData;
