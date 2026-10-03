// Переменные окружения в коде роликов: Remotion подставляет в сборку process.env c переменными REMOTION_*
// (например, REMOTION_DRAFT из scripts/render.ps1 -Draft). Типы Node в проект роликов не подключены — объявляем только это
declare const process: {env: Record<string, string | undefined>};
