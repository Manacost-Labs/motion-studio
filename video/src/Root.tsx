import React from 'react';
import {AdCompositions} from './ads';

// Все ролики регистрируются в src/ads/index.tsx (по папке на ролик).
// Шаблоны (src/templates) композиций не заводят: ролик по шаблону — это папка в src/ads с конфигом.
export const RemotionRoot: React.FC = () => <AdCompositions />;
