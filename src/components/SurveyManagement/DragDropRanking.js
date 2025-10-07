// DragDropRanking.js
import React, { useState, useEffect } from 'react';

const DragDropRanking = ({ items, onChange }) => {
  const [list, setList] = useState(items || []);

  useEffect(() => {
    setList(items || []);
  }, [items]);

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    const dragIndex = e.dataTransfer.getData('text/plain');
    if (dragIndex === '') return;
    const newList = [...list];
    const draggedItem = newList.splice(dragIndex, 1)[0];
    newList.splice(dropIndex, 0, draggedItem);
    setList(newList);
    onChange(newList);
  };

  return (
    <ul style={{ listStyleType: 'none', padding: 0 }}>
      {list.map((item, index) => (
        <li
          key={index}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
          style={{
            padding: '8px',
            border: '1px solid #ccc',
            marginBottom: '5px',
            cursor: 'move',
            backgroundColor: '#f9f9f9',
          }}
        >
          {item.text}
        </li>
      ))}
    </ul>
  );
};

export default DragDropRanking;
