// src/ShoppingList.jsx
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function ShoppingList({ session }) {
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [krogerResult, setKrogerResult] = useState(null);
  const [userZipCode, setUserZipCode] = useState(''); // NEW STATE

  const user = session.user;

  useEffect(() => {
    fetchItems();
  }, []);

  // --- REST OF CRUD FUNCTIONS (fetchItems, addItem, deleteItem) ARE UNCHANGED ---

  const fetchItems = async () => {
    // ... (unchanged fetch logic) ...
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
    setKrogerResult(null); // Clear previous results
    // ... (unchanged insert logic) ...
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

  const deleteItem = async (itemId) => {
    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .eq('id', itemId);

    setKrogerResult(null); // Clear previous results
    if (error) console.error('Error deleting item:', error);
    else setItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };


  // Function for Instacart order (unchanged)
  const handleInstacartOrder = async () => {
    setKrogerResult(null);
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


  // *** UPDATED FUNCTION FOR KROGER ***
  const handleKrogerOrder = async () => {
    setKrogerResult(null);
    if (items.length === 0) {
      alert("Your list is empty. Add items first.");
      return;
    }
    // Check for Zip Code input
    if (!userZipCode || userZipCode.length !== 5 || isNaN(Number(userZipCode))) {
        alert("Please enter a valid 5-digit Zip Code.");
        return;
    }

    // 1. Prepare payload
    const itemsPayload = items.map(item => ({
        name: item.name,
        quantity: item.quantity
    }));

    // 2. Invoke the Kroger mapping function, passing the Zip Code
    const { data, error } = await supabase.functions.invoke('create-kroger-cart', {
      body: { 
        items: itemsPayload,
        zipCode: userZipCode // <--- PASSING THE ZIP CODE
      }
    });

    if (error) {
      console.error('Kroger Error:', error.message);
      setKrogerResult({ error: error.message });
      return;
    }

    setKrogerResult(data);
  };


  // --- JSX Rendering ---
  return (
    <div className="App">
      <h1>My Shopping List</h1>

      {/* --- Add Item Form (same) --- */}
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

      {/* --- The List Itself (same) --- */}
      <ul>
        {items.length === 0 ? (
          <p>Your list is empty. Add something!</p>
        ) : (
          items.map(item => (
            <li key={item.id}>
              {item.quantity}x {item.name}
              <button onClick={() => deleteItem(item.id)}>Delete</button>
            </li>
          ))
        )}
      </ul>
      
      <hr />
      
      {/* --- KROGER LOCATION INPUT (NEW) --- */}
      <div style={{ marginBottom: '15px', padding: '10px', border: '1px solid #ccc', display: 'inline-block' }}>
        <label htmlFor="zipCode" style={{ fontWeight: 'bold' }}>Your Zip Code:</label>
        <input
          type="text"
          id="zipCode"
          placeholder="e.g., 90210"
          maxLength="5"
          value={userZipCode}
          onChange={(e) => setUserZipCode(e.target.value)}
          style={{ width: '80px', marginLeft: '5px', textAlign: 'center' }}
        />
      </div>


      {/* --- ORDER BUTTONS --- */}
      <button onClick={handleInstacartOrder} style={{ fontSize: '16px', marginRight: '10px' }}>
        Order with Instacart (Link)
      </button>
      
      <button onClick={handleKrogerOrder} style={{ fontSize: '16px' }}>
        Check Kroger Availability
      </button>


      {/* --- KROGER STATUS DISPLAY (same) --- */}
      {krogerResult && (
        <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px', backgroundColor: '#f9f9f9' }}>
          <h4>Kroger Search Results:</h4>
          
          {krogerResult.error ? (
            <p style={{ color: 'red' }}>Error: {krogerResult.error}</p>
          ) : (
            <>
              {krogerResult.locationId && (
                <p>Checking Inventory at Store ID: **{krogerResult.locationId}**</p>
              )}
              <p>Status: {krogerResult.message || "Mapping successful."}</p>
              
              {krogerResult.mappedItems && krogerResult.mappedItems.length > 0 ? (
                <>
                  <p>Found **{krogerResult.mappedItems.length}** UPC codes for these items:</p>
                  <ul style={{ listStyleType: 'disc', paddingLeft: '20px' }}>
                    {krogerResult.mappedItems.map((item, index) => (
                      <li key={index}>
                        **{item.name}:** UPC {item.upc}
                      </li>
                    ))}
                  </ul>
                  <p style={{ color: '#007bff', fontWeight: 'bold', marginTop: '10px' }}>
                    *Note: True cart creation requires an in-browser login flow.*
                  </p>
                </>
              ) : (
                <p>No products were found for your entire list.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}