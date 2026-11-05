import { DEFAULT_LANG, isLang, type Lang } from "@shared/l10n";
import { useParams } from "react-router";

const ru = {
  appName: "Рецепты",
  search: "Рецепт или ингредиент",
  whatToCook: "Что готовим?",
  agents: "ИИ-агенты (MCP)",
  installApp: "Установить на телефон",
  installIosHint: "В Safari нажмите «Поделиться» → «На экран „Домой“».",
  recipeCount: (n: number) => `${n} ${plural(n, ["рецепт", "рецепта", "рецептов"])}`,
  allRecipes: "Все рецепты",
  nothingFound: "Ничего не найдено",
  prep: "Подготовка",
  cook: "Готовка",
  total: "Все продукты",
  servings: (n: number) => `${n} ${plural(n, ["порция", "порции", "порций"])}`,
  prepTime: "Подготовка",
  cookTime: "Готовка",
  passiveTime: "Ожидание",
  source: "Источник",
  openOn: (site: string) => `Открыть на ${site} ↗`,
  openSource: "Открыть источник ↗",
  collapse: "Свернуть",
  close: "Закрыть",
  ahead: "заранее",
  beforeStart: "До начала",
  prepAhead: "Заранее",
  bowl: "Миска",
  optional: "по желанию",
  toTaste: "по вкусу",
  or: "или",
  wait: "подождать",
  subRecipes: "Входит в рецепт",
  reset: "Сбросить отметки",
  notTranslated: "нет перевода",
  draft: "черновик",
  edit: "Редактировать",
  newRecipe: "Новый рецепт",
  trash: "Корзина",
  admin: "Пользователи",
  tokens: "Токены и MCP",
  logout: "Выйти",
  login: "Вход",
  email: "Email",
  password: "Пароль",
  name: "Имя",
  signIn: "Войти",
  theme: { system: "Тема: системная", light: "Тема: светлая", dark: "Тема: тёмная" },
  timerDone: "Готово!",
  timers: "Таймеры",
  timerSettings: "Настройки таймера",
  sound: "Звук",
  vibration: "Вибрация",
  ringUntilDismissed: "Звонить до отключения",
  enableNotifications: "Уведомления, когда экран заблокирован",
  iosInstallHint: "На iPhone уведомления работают, если добавить сайт на экран «Домой».",
  offline: "Нет сети — показаны сохранённые рецепты",
  groceries: "Список продуктов",
  notFound: "Страница не найдена",
  error: "Что-то пошло не так",
};

type Dict = typeof ru;

const en: Dict = {
  appName: "Recipes",
  search: "Recipe or ingredient",
  whatToCook: "What are we cooking?",
  agents: "AI agents (MCP)",
  installApp: "Install on your phone",
  installIosHint: "In Safari, tap Share → Add to Home Screen.",
  recipeCount: (n: number) => `${n} ${n === 1 ? "recipe" : "recipes"}`,
  allRecipes: "All recipes",
  nothingFound: "Nothing found",
  prep: "Prep",
  cook: "Cook",
  total: "Groceries",
  servings: (n: number) => `${n} ${n === 1 ? "serving" : "servings"}`,
  prepTime: "Prep",
  cookTime: "Cook",
  passiveTime: "Waiting",
  source: "Source",
  openOn: (site: string) => `Open on ${site} ↗`,
  openSource: "Open source ↗",
  collapse: "Collapse",
  close: "Close",
  ahead: "ahead",
  beforeStart: "Before you start",
  prepAhead: "Ahead",
  bowl: "Bowl",
  optional: "optional",
  toTaste: "to taste",
  or: "or",
  wait: "wait",
  subRecipes: "Part of this recipe",
  reset: "Reset checkmarks",
  notTranslated: "not translated",
  draft: "draft",
  edit: "Edit",
  newRecipe: "New recipe",
  trash: "Trash",
  admin: "Users",
  tokens: "Tokens & MCP",
  logout: "Log out",
  login: "Log in",
  email: "Email",
  password: "Password",
  name: "Name",
  signIn: "Sign in",
  theme: { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" },
  timerDone: "Done!",
  timers: "Timers",
  timerSettings: "Timer settings",
  sound: "Sound",
  vibration: "Vibration",
  ringUntilDismissed: "Ring until dismissed",
  enableNotifications: "Notify me when the screen is locked",
  iosInstallHint: "On iPhone, notifications work once the site is added to the Home Screen.",
  offline: "Offline — showing saved recipes",
  groceries: "Groceries",
  notFound: "Page not found",
  error: "Something went wrong",
};

export const dictionaries: Record<Lang, Dict> = { ru, en };

function plural(n: number, [one, few, many]: [string, string, string]) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (!Number.isInteger(n)) return few;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function useLang(): Lang {
  const { lang } = useParams();
  return isLang(lang) ? lang : DEFAULT_LANG;
}

export function useT(): Dict {
  return dictionaries[useLang()];
}

/** Language from Accept-Language for routes without a /:lang prefix. */
export function langFromRequest(request: Request): Lang {
  const header = request.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return DEFAULT_LANG;
}

/** Swap the leading /ru or /en of a path. */
export function switchLangPath(pathname: string, to: Lang): string {
  return pathname.replace(/^\/(ru|en)(?=\/|$)/, `/${to}`) || `/${to}`;
}
