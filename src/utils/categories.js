// src/utils/categories.js
// Shared category constants and utilities

export const CATEGORY_ORDER = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Bakery & Bread',
  'Frozen',
  'Pantry',
  'Beverages',
  'Other'
];

export const CATEGORY_ICONS = {
  'Produce': '🥬',
  'Meat & Seafood': '🥩',
  'Dairy & Eggs': '🥛',
  'Bakery & Bread': '🍞',
  'Frozen': '❄️',
  'Pantry': '🥫',
  'Beverages': '🥤',
  'Other': '📦'
};

/**
 * Group items by category, sorted by CATEGORY_ORDER
 * @param {Array} items - Array of items with a 'category' property
 * @returns {Object} - Object with category names as keys and arrays of items as values
 */
export function groupByCategory(items) {
  const grouped = {};

  items.forEach(item => {
    const category = item.category || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  });

  // Sort categories by predefined order
  const sortedGrouped = {};
  CATEGORY_ORDER.forEach(cat => {
    if (grouped[cat]) {
      sortedGrouped[cat] = grouped[cat];
    }
  });

  // Add any categories not in the predefined order
  Object.keys(grouped).forEach(cat => {
    if (!sortedGrouped[cat]) {
      sortedGrouped[cat] = grouped[cat];
    }
  });

  return sortedGrouped;
}
