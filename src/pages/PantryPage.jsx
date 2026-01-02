// src/pages/PantryPage.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CATEGORY_ORDER, CATEGORY_ICONS, groupByCategory } from '../utils/categories';

// Common pantry staples for quick add
const COMMON_STAPLES = {
  'Pantry': ['Salt', 'Pepper', 'Olive Oil', 'Vegetable Oil', 'Sugar', 'Flour', 'Rice', 'Pasta', 'Soy Sauce', 'Vinegar', 'Honey', 'Garlic Powder', 'Onion Powder', 'Paprika', 'Cumin', 'Cinnamon', 'Vanilla Extract', 'Baking Soda', 'Baking Powder'],
  'Dairy & Eggs': ['Butter', 'Eggs', 'Milk'],
  'Produce': ['Garlic', 'Onions', 'Lemons'],
  'Beverages': ['Coffee', 'Tea']
};

// Convert string to Title Case
function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function PantryPage() {
  const [pantryItems, setPantryItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemCategory, setNewItemCategory] = useState('Pantry');
  const [isLoading, setIsLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetchPantryItems();
  }, []);

  const fetchPantryItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('pantry')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) console.error('Error fetching pantry:', error);
    else setPantryItems(data || []);
    setIsLoading(false);
  };

  const findExistingItem = (name) => {
    const normalizedName = name.trim().toLowerCase();
    return pantryItems.find(item => item.name.toLowerCase() === normalizedName);
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (newItemName.trim() === '') return;

    const formattedName = toTitleCase(newItemName.trim());
    const existingItem = findExistingItem(formattedName);

    if (existingItem) {
      // Show confirmation dialog
      const confirmed = window.confirm(
        `You already have "${existingItem.name}" in your pantry (quantity: ${existingItem.quantity || 1}).\n\nDo you want to add ${newItemQuantity} more?`
      );

      if (confirmed) {
        // Update existing item quantity
        const newQuantity = (existingItem.quantity || 1) + newItemQuantity;
        const { error } = await supabase
          .from('pantry')
          .update({ quantity: newQuantity })
          .eq('id', existingItem.id);

        if (error) {
          console.error('Error updating item:', error.message);
        } else {
          setPantryItems(prev =>
            prev.map(item =>
              item.id === existingItem.id
                ? { ...item, quantity: newQuantity }
                : item
            )
          );
          setNewItemName('');
          setNewItemQuantity(1);
        }
      }
      // If not confirmed, just clear the form
      return;
    }

    // Add new item
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('pantry')
      .insert({
        name: formattedName,
        quantity: newItemQuantity,
        category: newItemCategory,
        user_id: user.id
      })
      .select();

    if (error) {
      console.error('Error adding item:', error.message);
    } else {
      setPantryItems(prev => [...prev, data[0]]);
      setNewItemName('');
      setNewItemQuantity(1);
    }
  };

  const addQuickItem = async (name, category) => {
    const { data: { user } } = await supabase.auth.getUser();
    const formattedName = toTitleCase(name);
    const existingItem = findExistingItem(formattedName);

    if (existingItem) {
      // Show confirmation for quick add too
      const confirmed = window.confirm(
        `You already have "${existingItem.name}" in your pantry (quantity: ${existingItem.quantity || 1}).\n\nDo you want to add 1 more?`
      );

      if (confirmed) {
        const newQuantity = (existingItem.quantity || 1) + 1;
        const { error } = await supabase
          .from('pantry')
          .update({ quantity: newQuantity })
          .eq('id', existingItem.id);

        if (error) {
          console.error('Error updating item:', error.message);
        } else {
          setPantryItems(prev =>
            prev.map(item =>
              item.id === existingItem.id
                ? { ...item, quantity: newQuantity }
                : item
            )
          );
        }
      }
      return;
    }

    const { data, error } = await supabase
      .from('pantry')
      .insert({
        name: formattedName,
        quantity: 1,
        category: category,
        user_id: user.id
      })
      .select();

    if (error) {
      console.error('Error adding item:', error.message);
    } else {
      setPantryItems(prev => [...prev, data[0]]);
    }
  };

  const deleteItem = async (itemId) => {
    const { error } = await supabase
      .from('pantry')
      .delete()
      .eq('id', itemId);

    if (error) console.error('Error deleting item:', error);
    else setPantryItems(prev => prev.filter(item => item.id !== itemId));
  };

  const groupedItems = groupByCategory(pantryItems);
  const pantryNames = pantryItems.map(p => p.name.toLowerCase());

  return (
    <div className="page-container">
      <section className="pantry-section">
        <div className="section-header">
          <h2>My Pantry</h2>
          <p className="section-subtitle">Items you always have on hand</p>
        </div>

        {/* Add Item Form */}
        <form onSubmit={addItem} className="add-item-form">
          <input
            type="text"
            className="item-name-input"
            placeholder="Add a pantry item..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
          />
          <input
            type="number"
            className="quantity-input"
            min="1"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(Number(e.target.value))}
          />
          <select
            className="category-select"
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value)}
          >
            {CATEGORY_ORDER.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            Add
          </button>
        </form>

        {/* Quick Add Suggestions */}
        <div className="quick-add-section">
          <button
            className="btn-ghost btn-sm"
            onClick={() => setShowSuggestions(!showSuggestions)}
          >
            {showSuggestions ? 'Hide Suggestions' : 'Show Common Staples'}
          </button>

          {showSuggestions && (
            <div className="suggestions-container">
              {Object.entries(COMMON_STAPLES).map(([category, items]) => (
                <div key={category} className="suggestion-category">
                  <span className="suggestion-category-label">
                    {CATEGORY_ICONS[category]} {category}
                  </span>
                  <div className="suggestion-chips">
                    {items.map(item => {
                      const isInPantry = pantryNames.includes(item.toLowerCase());
                      return (
                        <button
                          key={item}
                          className={`suggestion-chip ${isInPantry ? 'in-pantry' : ''}`}
                          onClick={() => addQuickItem(item, category)}
                        >
                          {isInPantry ? '✓ ' : '+ '}{item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pantry Items */}
        <div className="pantry-list-container">
          {isLoading ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <p className="mt-md">Loading your pantry...</p>
            </div>
          ) : pantryItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏠</div>
              <h3>Your pantry is empty</h3>
              <p>Add items you always have on hand, like salt, oil, and spices.</p>
              <p>These items will be marked as "In Pantry" on your shopping list.</p>
            </div>
          ) : (
            <div className="category-list">
              {Object.entries(groupedItems).map(([category, categoryItems]) => (
                <div key={category} className="category-group">
                  <div className="category-header">
                    <span className="category-icon">{CATEGORY_ICONS[category] || '📦'}</span>
                    <span className="category-name">{category}</span>
                    <span className="category-count">{categoryItems.length}</span>
                  </div>
                  <ul className="pantry-list">
                    {categoryItems.map(item => (
                      <li key={item.id} className="pantry-item">
                        <div className="pantry-item-content">
                          <span className="pantry-item-quantity">{item.quantity || 1}</span>
                          <span className="pantry-item-name">{item.name}</span>
                        </div>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="item-delete-btn"
                          aria-label="Remove from pantry"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
