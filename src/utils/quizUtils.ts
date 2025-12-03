import { subcategories } from '../services/bot/quiz/quizData';

const subcategoryToCategoryMap: Record<string, string> = {};

for (const category in subcategories) {
    if (Object.prototype.hasOwnProperty.call(subcategories, category)) {
        for (const subcategory of subcategories[category]) {
            subcategoryToCategoryMap[subcategory] = category;
        }
    }
}

export { subcategoryToCategoryMap };