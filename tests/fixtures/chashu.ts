import type { RecipeDataInput } from "@shared/recipe";

export const chashu: RecipeDataInput = {
  title: { ru: "Чашу и нитамаго", en: "Chashu and nitamago" },
  servings: { amount: 4 },
  times: { prepMin: 20, cookMin: 120, passiveMin: 720 },
  tags: [{ ru: "японская", en: "japanese" }],
  source: { url: "https://www.youtube.com/watch?v=sYUp0qCAtzw", label: { en: "Taiji's Kitchen" } },
  prepTasks: [
    { id: "string", text: { ru: "Достать нить", en: "Get kitchen twine" } },
    { id: "ahead", text: { ru: "Начать за день", en: "Start a day ahead" }, leadMin: 1440 },
  ],
  sections: [
    {
      id: "chashu",
      title: { ru: "Чашу", en: "Chashu" },
      bowls: [{ id: "aromatics", label: { ru: "Ароматика", en: "Aromatics" } }],
      ingredients: [
        {
          id: "pork",
          name: { ru: "Свиная грудинка", en: "Pork belly" },
          qty: { min: 750, max: 1000 },
          unit: "g",
        },
        {
          id: "garlic",
          name: { ru: "Чеснок", en: "Garlic" },
          qty: { min: 2, max: 3 },
          unit: "clove",
          bowl: "aromatics",
        },
        {
          id: "ginger",
          name: { ru: "Имбирь", en: "Ginger" },
          qty: { min: 10 },
          unit: "g",
          bowl: "aromatics",
          prep: { ru: "тонко нарезать", en: "thinly sliced" },
        },
      ],
      steps: [
        {
          id: "boil",
          text: {
            ru: "Добавить {{ing:garlic}} и {{ing:ginger}}, варить {{timer:1h30m}}",
            en: "Add {{ing:garlic}} and {{ing:ginger}}, simmer {{timer:1h30m}}",
          },
        },
      ],
    },
    {
      id: "marinade",
      title: { ru: "Маринад", en: "Marinade" },
      ingredients: [
        { id: "soy", name: { ru: "Соевый соус", en: "Soy sauce" }, qty: { min: 1 }, unit: "cup" },
        { id: "garlic-2", name: { ru: "Чеснок", en: "Garlic" }, qty: { min: 2 }, unit: "clove" },
        {
          id: "sake",
          name: { ru: "Сакэ", en: "Sake" },
          qty: { min: 1 },
          unit: "tbsp",
          alternatives: [{ name: { ru: "вода", en: "water" } }],
        },
        { id: "salt", name: { ru: "Соль", en: "Salt" }, scaling: "to-taste" },
        { id: "bay", name: { ru: "Лавровый лист", en: "Bay leaf" }, qty: { min: 1 }, scaling: "fixed" },
      ],
      steps: [{ id: "marinate", text: { ru: "Залить {{ing:soy}}", en: "Pour {{ing:soy}}" } }],
      waitAfterMin: 720,
    },
  ],
};
