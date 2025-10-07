import React, { useState, useEffect, useCallback } from 'react';
import { userProfileAPI } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import BLoading from './ui/BLoading';

const ManageProfileTags = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentTag, setCurrentTag] = useState({ id: null, name: '', category: 'INTEREST' });
  const [isEditing, setIsEditing] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');

  const tagCategories = ['INTEREST', 'OWNED_DEVICE', 'MEMBERSHIP'];

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterCategory ? { category: filterCategory } : {};
      const response = await userProfileAPI.adminGetProfileTags(params);
      // The API might return { tags: [...] } or just [...] based on previous observations
      setTags(response.data?.tags || response.data || []); 
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch profile tags.');
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags, filterCategory]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentTag(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentTag.name || !currentTag.category) {
      toast.error('Tag name and category are required.');
      return;
    }
    setLoading(true); // For saving operation
    try {
      if (isEditing) {
        await userProfileAPI.adminUpdateProfileTag(currentTag.id, { name: currentTag.name, category: currentTag.category });
        toast.success('Tag updated successfully!');
      } else {
        await userProfileAPI.adminCreateProfileTag({ name: currentTag.name, category: currentTag.category });
        toast.success('Tag created successfully!');
      }
      setShowModal(false);
      fetchTags(); // Re-fetch tags
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${isEditing ? 'update' : 'create'} tag.`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tag) => {
    setCurrentTag({ id: tag.id, name: tag.name, category: tag.category });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (tagId) => {
    if (!window.confirm('Are you sure you want to delete this tag?')) return;
    setLoading(true);
    try {
      await userProfileAPI.adminDeleteProfileTag(tagId);
      toast.success('Tag deleted successfully!');
      fetchTags(); // Re-fetch tags
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete tag.');
    } finally {
      setLoading(false);
    }
  };

  const openModalForCreate = () => {
    setCurrentTag({ id: null, name: '', category: 'INTEREST' });
    setIsEditing(false);
    setShowModal(true);
  };

  if (loading && tags.length === 0) {
    return <BLoading variant="page" label="Loading tags..." />;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Manage Profile Tags</h1>

      <div className="mb-4 flex justify-between items-center">
        <div>
          <label htmlFor="filterCategory" className="mr-2">Filter by Category:</label>
          <select 
            id="filterCategory" 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="p-2 border rounded-md"
          >
            <option value="">All Categories</option>
            {tagCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <button 
          onClick={openModalForCreate} 
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Create New Tag
        </button>
      </div>

      {/* Tag Creation/Editing Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">{isEditing ? 'Edit Tag' : 'Create New Tag'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Tag Name</label>
                <input 
                  type="text" 
                  name="name" 
                  id="name" 
                  value={currentTag.name} 
                  onChange={handleInputChange} 
                  required 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                <select 
                  name="category" 
                  id="category" 
                  value={currentTag.category} 
                  onChange={handleInputChange} 
                  required 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {tagCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : (isEditing ? 'Update Tag' : 'Create Tag')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tags Table */}
      {(!loading || tags.length > 0) && tags.length > 0 ? (
        <div className="overflow-x-auto bg-white shadow-md rounded-lg">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tags.map(tag => (
                <tr key={tag.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tag.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tag.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button onClick={() => handleEdit(tag)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                    <button onClick={() => handleDelete(tag.id)} className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && tags.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500 text-lg">No profile tags found{filterCategory ? ` for category "${filterCategory}"` : ''}.</p>
            <p className="text-gray-400 text-sm">Try a different filter or create a new tag.</p>
        </div>
      ) : null}
    </div>
  );
};

export default ManageProfileTags; 