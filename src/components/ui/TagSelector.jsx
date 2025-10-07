import React, { useState, useEffect } from "react";
import toast from 'react-hot-toast'; // Added for consistency, though not used in provided snippet
// Assuming a CSS file like `TagSelector.css` will be created based on your provided CSS snippets
import './TagSelector.css'; // Create this file

// Assuming tagsAPI.getAllTags() exists in apiClient.js
// import { tagsAPI } from '../../services/apiClient'; // Path to your API client

// Mock API call for demonstration
const mockTagsAPI = {
  getAllTags: () => new Promise(resolve => setTimeout(() => resolve([
    { id: 1, name: "music", count: 85625, category: "Entertainment" },
    { id: 2, name: "blogger", count: 52870, category: "Occupation" },
    { id: 3, name: "socialmedia", count: 40410, category: "Technology" },
    { id: 4, name: "entrepreneur", count: 34334, category: "Business" },
    { id: 5, name: "marketing", count: 29474, category: "Business" },
    { id: 6, name: "tech", count: 26964, category: "Technology" },
    { id: 7, name: "sports", count: 23745, category: "Entertainment" },
    { id: 8, name: "photography", count: 22904, category: "Hobbies" },
    { id: 9, name: "travel", count: 21425, category: "Lifestyle" },
    { id: 10, name: "fashion", count: 21027, category: "Lifestyle" },
    { id: 11, name: "design", count: 18801, category: "Creative" },
    { id: 12, name: "politics", count: 18427, category: "News" },
    { id: 13, name: "technology", count: 17687, category: "Technology" },
    { id: 14, name: "news", count: 17643, category: "News" },
    { id: 15, name: "movies", count: 17632, category: "Entertainment" },
  ]), 500))
};


const TagSelector = ({ initialSelectedIds = [], onSave, onSkip, isLoading }) => {
  const [allTags, setAllTags] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [sortMode, setSortMode] = useState("popularity"); // "popularity" or "alphabetical"
  const [selectedTagIds, setSelectedTagIds] = useState(new Set(initialSelectedIds));
  const [tagsLoading, setTagsLoading] = useState(false);

  useEffect(() => {
    setTagsLoading(true);
    // Replace with actual API call: tagsAPI.getAllTags()
    mockTagsAPI.getAllTags()
      .then((fetchedTags) => {
        setAllTags(fetchedTags || []);
      })
      .catch((err) => {
        console.error("Failed to fetch tags:", err);
        toast.error("Could not load tags.");
      })
      .finally(() => setTagsLoading(false));
  }, []);

  const lowerFilter = filterText.toLowerCase();
  const filteredTags = allTags.filter((tag) =>
    tag.name.toLowerCase().includes(lowerFilter)
  );

  const sortedTags = [...filteredTags].sort((a, b) => {
    if (sortMode === "popularity") {
      return b.count - a.count;
    } else {
      return a.name.localeCompare(b.name);
    }
  });

  const toggleTag = (tagId) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const handleSaveTags = () => {
    onSave(Array.from(selectedTagIds));
  };

  if (tagsLoading) {
    return <div className="loading-tags primaryfont" style={{textAlign: 'center', padding: '20px'}}>Loading tags...</div>;
  }

  return (
    <div className="tag-selector-page-container"> {/* Use a unique class for scoping */}
      <div className="search-sort-bar">
        <input
          type="text"
          placeholder="Search tags..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="tag-search-input primaryfont"
        />
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
          className="tag-sort-select primaryfont"
        >
          <option value="popularity">Sort by Popularity</option>
          <option value="alphabetical">Sort A → Z</option>
        </select>
      </div>

      <div className="tag-cloud-container">
        {sortedTags.length > 0 ? sortedTags.map((tag) => {
          const isSelected = selectedTagIds.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              className={`tag-chip primaryfont ${isSelected ? "tag-chip--selected" : ""}`}
              onClick={() => toggleTag(tag.id)}
              aria-pressed={isSelected}
            >
              <span className="tag-chip__name">{tag.name}</span>
              <span className="tag-chip__count">({tag.count.toLocaleString()})</span>
            </button>
          );
        }) : <p className="primaryfont" style={{color: '#ccc'}}>No tags match your search.</p>}
      </div>

      <div className="selected-tags-strip">
        <h4 className="primaryfont" style={{marginBottom: '8px', fontSize: '1rem', color: '#ddd'}}>Selected Tags:</h4>
        {selectedTagIds.size > 0 ? (
            Array.from(selectedTagIds).map((tagId) => {
            const tag = allTags.find((t) => t.id === tagId);
            if (!tag) return null;
            return (
                <div key={tagId} className="selected-chip primaryfont">
                {tag.name}
                <button
                    type="button"
                    className="selected-chip__remove"
                    onClick={() => toggleTag(tagId)}
                    aria-label={`Remove ${tag.name}`}
                >
                    ×
                </button>
                </div>
            );
            })
        ) : <p className="primaryfont" style={{color: '#888', fontStyle: 'italic'}}>No tags selected yet.</p>}
      </div>

      <div className="tag-actions form_button_group" style={{marginTop: '20px', display: 'flex', justifyContent: 'space-between'}}>
        <button onClick={onSkip} className="form_button_type_3 primaryfont" disabled={isLoading}>
          Skip for now
        </button>
        <button onClick={handleSaveTags} className="form_button_type_2 primaryfont" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
};

export default TagSelector; 