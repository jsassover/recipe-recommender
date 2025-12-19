// src/App.jsx
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import MealPlanner from './MealPlanner';
import './App.css';

// --- THE SHOPPING LIST COMPONENT ---
function ShoppingListApp({ session }) {
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const user = session.user;

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('shopping_list')
      .select('*')
      .order('id', { ascending: true });

    if (error) console.error('Error fetching items:', error);
    else setItems(data);
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (newItemName.trim() === '') return;

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

  // Handle checking/unchecking a single box
  const handleCheckboxChange = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    } else {
      setSelectedItems(prev => [...prev, itemId]);
    }
  };

  // --- NEW: Handle Select All / Deselect All ---
  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      // If all are currently selected, clear selection
      setSelectedItems([]);
    } else {
      // Otherwise, select every single item ID
      setSelectedItems(items.map(item => item.id));
    }
  };

  // Delete all selected items
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
    // Prepare the items to be sent to the function
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Check if all items are currently selected (for button text)
  const isAllSelected = items.length > 0 && selectedItems.length === items.length;

  return (
    <div className="App">
      <button onClick={handleSignOut} style={{ float: 'right' }}>Sign Out</button>
      <h1>My Shopping List</h1>
      <p>Welcome, {session.user.email}!</p>

      {/* --- Add Item Form --- */}
      <form onSubmit={addItem}>
        <input
          type="text"
          placeholder="Add an item (e.g., Apples)"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
        />
        <input
          type="number"
          min="1"
          value={newItemQuantity}
          onChange={(e) => setNewItemQuantity(Number(e.target.value))}
        />
        <button type="submit">Add</button>
      </form>

      {/* --- ACTION BUTTONS (Select All & Delete) --- */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', margin: '15px 0' }}>
          
          {/* 1. SELECT ALL BUTTON */}
          <button 
            onClick={handleSelectAll}
            style={{ 
              backgroundColor: '#ccc', 
              color: 'black', 
              border: 'none', 
              cursor: 'pointer', 
              padding: '5px 10px', 
              borderRadius: '5px',
              fontSize: '14px'
            }}
          >
            {isAllSelected ? "Deselect All" : "Select All"}
          </button>

          {/* 2. BULK DELETE BUTTON (Only shows if items selected) */}
          {selectedItems.length > 0 && (
            <button 
              onClick={deleteSelectedItems}
              style={{ 
                backgroundColor: '#ff4d4d', 
                color: 'white', 
                border: 'none', 
                cursor: 'pointer', 
                padding: '5px 10px', 
                borderRadius: '5px',
                fontSize: '14px'
              }}
            >
              Delete Selected ({selectedItems.length})
            </button>
          )}
        </div>
      )}

      {/* --- The List Itself --- */}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.length === 0 ? (
          <p>Your list is empty. Add something!</p>
        ) : (
          items.map(item => (
            <li key={item.id} style={{ display: 'flex', alignItems: 'center', margin: '5px 0', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
              
              {/* Checkbox */}
              <input 
                type="checkbox"
                checked={selectedItems.includes(item.id)}
                onChange={() => handleCheckboxChange(item.id)}
                style={{ marginRight: '10px', width: '20px', height: '20px', cursor: 'pointer' }}
              />
              
              {/* Item Name */}
              <span style={{ flexGrow: 1, textAlign: 'left' }}>
                {item.quantity}x {item.name}
              </span>
              
              {/* Single Delete X */}
              <button onClick={() => deleteItem(item.id)} style={{ fontSize: '10px', marginLeft: '10px' }}>
                X
              </button>
            </li>
          ))
        )}
      </ul>

      <hr />
      <button onClick={handleOrder} style={{ marginTop: '20px', fontSize: '16px' }}>
        Order with Instacart
      </button>

      <hr style={{ marginTop: '40px' }}/>
      
      {/* The Meal Planner Component */}
      <MealPlanner />
    </div>
  );
}

// --- THE MAIN APP COMPONENT ---
function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return (
      <div style={{ maxWidth: '400px', margin: '50px auto' }}>
        <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} />
      </div>
    )
  } else {
    return <ShoppingListApp session={session} />
  }
}

export default App;