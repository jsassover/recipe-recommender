// src/pages/ShoppingListPage.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CATEGORY_ICONS, groupByCategory } from '../utils/categories';

export default function ShoppingListPage() {
  const [items, setItems] = useState([]);
  const [pantryItems, setPantryItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('category');

  useEffect(() => {
    fetchItems();
    fetchPantryItems();
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('shopping_list')
      .select('*')
      .order('id', { ascending: true });

    if (error) console.error('Error fetching items:', error);
    else setItems(data);
    setIsLoading(false);
  };

  const fetchPantryItems = async () => {
    const { data, error } = await supabase
      .from('pantry')
      .select('name')
      .order('name');

    if (error) console.error('Error fetching pantry:', error);
    else setPantryItems(data?.map(p => p.name.toLowerCase()) || []);
  };

  const isInPantry = (itemName) => {
    return pantryItems.includes(itemName.toLowerCase());
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (newItemName.trim() === '') return;

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('shopping_list')
      .insert({
        name: newItemName,
        quantity: newItemQuantity,
        user_id: user.id
      })
      .select();

    if (error) {
      console.error('Error adding item:', error.message);
    } else {
      setItems(prevItems => [...prevItems, data[0]]);
      setNewItemName('');
      setNewItemQuantity(1);
    }
  };

  const handleCheckboxChange = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    } else {
      setSelectedItems(prev => [...prev, itemId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.id));
    }
  };

  const deleteSelectedItems = async () => {
    if (selectedItems.length === 0) return;

    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .in('id', selectedItems);

    if (error) {
      console.error('Error deleting items:', error);
      alert("Failed to delete items.");
    } else {
      setItems(prevItems => prevItems.filter(item => !selectedItems.includes(item.id)));
      setSelectedItems([]);
    }
  };

  const deleteItem = async (itemId) => {
    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .eq('id', itemId);

    if (error) console.error('Error deleting item:', error);
    else setItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };

  const handleOrder = async () => {
    console.log('Building Instacart cart...');
    const itemsPayload = items.map(item => ({
      name: item.name,
      quantity: item.quantity
    }));
    const { data, error } = await supabase.functions.invoke('checkout-handler', { body: { items: itemsPayload } });

    if (error) {
      console.error('Error from function:', error.message);
      alert(`Error: ${error.message}`);
    }

    if (data && data.checkoutUrl) {
      console.log('SUCCESS! Got checkout URL:', data.checkoutUrl);
      window.open(data.checkoutUrl, '_blank');
    } else if (data) {
      alert(`Error: ${data.error || 'Could not create cart.'}`);
    }
  };

  const isAllSelected = items.length > 0 && selectedItems.length === items.length;
  const groupedItems = groupByCategory(items);
  const hasCategories = Object.keys(groupedItems).some(cat => cat !== 'Other' && groupedItems[cat]?.length > 0);

  const renderShoppingItem = (item) => {
    const inPantry = isInPantry(item.name);

    return (
      <li
        key={item.id}
        className={`shopping-item ${selectedItems.includes(item.id) ? 'checked' : ''} ${inPantry ? 'in-pantry' : ''}`}
      >
        <input
          type="checkbox"
          className="item-checkbox"
          checked={selectedItems.includes(item.id)}
          onChange={() => handleCheckboxChange(item.id)}
        />
        <div className="item-content">
          <span className="item-quantity-badge">{item.quantity}</span>
          <span className="item-text">{item.name}</span>
          {inPantry && <span className="pantry-badge">In Pantry</span>}
        </div>
        <button
          onClick={() => deleteItem(item.id)}
          className="item-delete-btn"
          aria-label="Delete item"
        >
          ×
        </button>
      </li>
    );
  };

  return (
    <div className="page-container">
      <section className="shopping-section">
        <div className="section-header">
          <h2>Shopping List</h2>
          {items.length > 0 && hasCategories && (
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'category' ? 'active' : ''}`}
                onClick={() => setViewMode('category')}
              >
                By Category
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                All Items
              </button>
            </div>
          )}
        </div>

        {/* Add Item Form */}
        <form onSubmit={addItem} className="add-item-form">
          <input
            type="text"
            className="item-name-input"
            placeholder="Add an item (e.g., Apples)"
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
          <button type="submit" className="btn-primary">
            Add
          </button>
        </form>

        {/* Shopping List Container */}
        <div className="shopping-list-container">
          {/* List Actions Bar */}
          {items.length > 0 && (
            <div className="list-actions">
              <div className="list-actions-left">
                <button
                  onClick={handleSelectAll}
                  className="btn-ghost btn-sm"
                >
                  {isAllSelected ? "Deselect All" : "Select All"}
                </button>
                {selectedItems.length > 0 && (
                  <span className="select-count">
                    {selectedItems.length} selected
                  </span>
                )}
              </div>
              <div className="list-actions-right">
                {selectedItems.length > 0 && (
                  <button
                    onClick={deleteSelectedItems}
                    className="btn-danger btn-sm"
                  >
                    Delete Selected
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Shopping List */}
          {isLoading ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <p className="mt-md">Loading your list...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🛒</div>
              <h3>Your list is empty</h3>
              <p>Add items above or generate from your meal plan!</p>
            </div>
          ) : viewMode === 'category' && hasCategories ? (
            // Grouped by category view
            <div className="category-list">
              {Object.entries(groupedItems).map(([category, categoryItems]) => (
                <div key={category} className="category-group">
                  <div className="category-header">
                    <span className="category-icon">{CATEGORY_ICONS[category] || '📦'}</span>
                    <span className="category-name">{category}</span>
                    <span className="category-count">{categoryItems.length}</span>
                  </div>
                  <ul className="shopping-list">
                    {categoryItems.map(renderShoppingItem)}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            // Flat list view
            <ul className="shopping-list">
              {items.map(renderShoppingItem)}
            </ul>
          )}
        </div>
      </section>

      {/* Sticky Order Footer */}
      {items.length > 0 && (
        <div className="sticky-order-footer">
          <button onClick={handleOrder} className="order-button">
            <span>🛒</span>
            Order with Instacart ({items.length} items)
          </button>
        </div>
      )}
    </div>
  );
}
