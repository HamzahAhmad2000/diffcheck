import React, { useState } from 'react';
import {
  ViewAllButton,
  EnterStartButton,
  BackButton,
  CloseButton,
  SearchBar,
  FilterDropdown,
  TagSelector,
  PopupForm,
  LoadingIndicator,
  SecurityQuestionsTable,
  PasskeysTable,
  LinkedAccountsTable
} from '../index';

/**
 * ComponentExamples - Usage examples for all user components
 * This file demonstrates how to use each component from the library
 */
const ComponentExamples = () => {
  // State for examples
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mock data
  const categories = [
    { value: 'technology', label: 'Technology' },
    { value: 'design', label: 'Design' },
    { value: 'business', label: 'Business' }
  ];

  const sampleTags = [
    { id: 1, name: 'React' },
    { id: 2, name: 'JavaScript' },
    { id: 3, name: 'Design' },
    { id: 4, name: 'UX/UI' }
  ];

  const securityQuestions = [
    { id: 1, question: "What was your first pet's name?" },
    { id: 2, question: "In which city were you born?" },
    { id: 3, question: "What was your mother's maiden name?" }
  ];

  const linkedAccounts = [
    { provider: 'google', name: 'John Doe', email: 'john@example.com' },
    { provider: 'discord', name: 'JohnD#1234' }
  ];

  const formFields = [
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      placeholder: 'Enter title...',
      required: true,
      maxLength: 100
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
      placeholder: 'Enter description...',
      required: true,
      rows: 4
    },
    {
      name: 'category',
      type: 'select',
      label: 'Category',
      required: true,
      options: categories
    },
    {
      name: 'attachments',
      type: 'file',
      label: 'Attachments',
      multiple: true
    }
  ];

  const handleFormSubmit = async (formData) => {
    console.log('Form submitted:', formData);
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setShowModal(false);
    }, 2000);
  };

  return (
    <div className="component-examples" style={{ padding: '2rem', background: '#1a1a1a', color: '#fff' }}>
      <h1>User Component Library Examples</h1>
      
      {/* Buttons Section */}
      <section style={{ marginBottom: '3rem' }}>
        <h2>Buttons</h2>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <ViewAllButton 
            onClick={() => console.log('View all clicked')}
            text="View All Items"
          />
          
          <EnterStartButton 
            onClick={() => console.log('Start clicked')}
            text="Start Survey"
            variant="primary"
          />
          
          <EnterStartButton 
            onClick={() => console.log('Claim clicked')}
            text="Claim Reward"
            claimable={true}
          />
          
          <EnterStartButton 
            onClick={() => console.log('Completed')}
            text="Survey"
            completed={true}
          />
          
          <BackButton 
            onClick={() => console.log('Back clicked')}
            text="Back to Dashboard"
          />
          
          <CloseButton 
            onClick={() => console.log('Close clicked')}
            variant="ghost"
          />
        </div>
      </section>

      {/* Forms Section */}
      <section style={{ marginBottom: '3rem' }}>
        <h2>Forms</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <SearchBar 
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search components..."
            clearable={true}
          />
          
          <FilterDropdown 
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categories}
            placeholder="All Categories"
            label="Filter by Category"
          />
        </div>

        <TagSelector 
          availableTags={sampleTags}
          selectedTagIds={selectedTags}
          onChange={setSelectedTags}
          title="Select Tags"
          selectionMode="multiple"
          maxSelection={3}
        />

        <div style={{ marginTop: '1rem' }}>
          <button 
            onClick={() => setShowModal(true)}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Open Popup Form
          </button>
        </div>
      </section>

      {/* Feedback Section */}
      <section style={{ marginBottom: '3rem' }}>
        <h2>Feedback Components</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '1rem' }}>
            <h4>Spinner Loading</h4>
            <LoadingIndicator 
              variant="spinner"
              size="medium"
              text="Loading..."
            />
          </div>
          
          <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '1rem' }}>
            <h4>Dots Loading</h4>
            <LoadingIndicator 
              variant="dots"
              size="medium"
              text="Processing..."
            />
          </div>
          
          <div style={{ border: '1px solid #333', borderRadius: '8px', padding: '1rem' }}>
            <h4>Progress Bar</h4>
            <LoadingIndicator 
              variant="bar"
              size="medium"
              text="Uploading..."
            />
          </div>
        </div>
      </section>

      {/* Tables Section */}
      <section style={{ marginBottom: '3rem' }}>
        <h2>Tables</h2>
        
        <div style={{ display: 'grid', gap: '2rem' }}>
          <SecurityQuestionsTable 
            availableQuestions={securityQuestions}
            onSave={async (questions) => {
              console.log('Security questions saved:', questions);
              return { success: true };
            }}
            loading={false}
          />
          
          <PasskeysTable 
            passkeys={['ABC123', 'DEF456', 'GHI789', 'JKL012']}
            onGenerate={async () => {
              console.log('Generating new passkeys...');
              return { success: true };
            }}
            loading={false}
          />
          
          <LinkedAccountsTable 
            linkedAccounts={linkedAccounts}
            onUnlink={async (provider) => {
              console.log('Unlinking:', provider);
            }}
            onLink={async (provider) => {
              console.log('Linking:', provider);
            }}
            availableProviders={['google', 'discord', 'twitter']}
          />
        </div>
      </section>

      {/* Popup Form */}
      <PopupForm 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleFormSubmit}
        title="Create New Item"
        subtitle="Fill in the details below to create a new item."
        fields={formFields}
        loading={loading}
        size="medium"
      />
    </div>
  );
};

export default ComponentExamples;
