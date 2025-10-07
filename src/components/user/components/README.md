# User Components Library

This is a comprehensive collection of reusable React components extracted from the user-facing pages of the business survey application. These components are designed to be flexible, accessible, and consistent with the application's design system.

## 📁 Component Organization

```
react/src/components/user/components/
├── buttons/           # Interactive button components
├── forms/            # Form inputs and controls
├── tables/           # Data tables and management interfaces
├── lists/            # List display components
├── cards/            # Card-based content displays
├── feedback/         # Loading, progress, and feedback components
├── layout/           # Layout and structural components
└── index.js          # Main exports file
```

## 🔧 Installation & Usage

Import components from the main index file:

```javascript
import { 
  ViewAllButton, 
  EnterStartButton, 
  SearchBar, 
  TagSelector,
  LoadingIndicator 
} from '../components/user/components';
```

Or import individual components:

```javascript
import ViewAllButton from '../components/user/components/buttons/ViewAllButton';
```

## 📋 Component Categories

### 🔘 Buttons

#### ViewAllButton
A reusable "View All" button component extracted from dashboard sections.

**Props:**
- `onClick` (function, required): Click handler
- `text` (string, default: "View All"): Button text
- `variant` (string, default: "primary"): Button style variant
- `disabled` (boolean, default: false): Disabled state
- `className` (string): Additional CSS classes

**Example:**
```javascript
<ViewAllButton 
  onClick={() => navigate('/user/brands')}
  text="View All Brands"
  variant="primary"
/>
```

#### EnterStartButton
A versatile button component for various action states (start, enter, claim, completed, etc.).

**Props:**
- `onClick` (function, required): Click handler
- `text` (string, default: "Start"): Button text
- `variant` (string, default: "primary"): Button style
- `size` (string, default: "medium"): Button size
- `disabled` (boolean): Disabled state
- `loading` (boolean): Loading state
- `completed` (boolean): Completed state
- `claimed` (boolean): Claimed state
- `claimable` (boolean): Claimable state
- `pending` (boolean): Pending state
- `icon` (string): Icon class name

**Example:**
```javascript
<EnterStartButton 
  onClick={handleStart}
  text="Start Survey"
  variant="primary"
  size="medium"
  completed={isCompleted}
  claimable={isClaimable}
/>
```

#### BackButton
A navigation back button component.

**Props:**
- `onClick` (function, required): Click handler
- `text` (string, default: "Back"): Button text
- `variant` (string, default: "primary"): Button style
- `showIcon` (boolean, default: true): Show back arrow icon
- `icon` (string, default: "ri-arrow-left-s-line"): Icon class

**Example:**
```javascript
<BackButton 
  onClick={() => navigate(-1)}
  text="Back to Profile"
  variant="ghost"
/>
```

#### CloseButton
A close button component for modals and overlays.

**Props:**
- `onClick` (function, required): Click handler
- `variant` (string, default: "primary"): Button style
- `size` (string, default: "medium"): Button size
- `ariaLabel` (string, default: "Close"): Accessibility label

**Example:**
```javascript
<CloseButton 
  onClick={handleClose}
  variant="ghost"
  size="medium"
/>
```

### 📝 Forms

#### SearchBar
A search input component with integrated icon and clear functionality.

**Props:**
- `value` (string): Current search value
- `onChange` (function, required): Change handler
- `placeholder` (string, default: "Search"): Placeholder text
- `variant` (string, default: "primary"): Style variant
- `size` (string, default: "medium"): Size variant
- `clearable` (boolean, default: true): Show clear button
- `loading` (boolean): Loading state
- `onSubmit` (function): Submit handler

**Example:**
```javascript
<SearchBar 
  value={searchQuery}
  onChange={setSearchQuery}
  placeholder="Search businesses..."
  variant="primary"
  clearable={true}
  onSubmit={handleSearch}
/>
```

#### FilterDropdown
A dropdown component for filtering content.

**Props:**
- `value` (string|number): Selected value
- `onChange` (function, required): Change handler
- `options` (array): Options array
- `placeholder` (string, default: "Select..."): Placeholder text
- `label` (string): Field label
- `clearable` (boolean, default: true): Show clear option
- `loading` (boolean): Loading state

**Example:**
```javascript
<FilterDropdown 
  value={selectedCategory}
  onChange={setSelectedCategory}
  options={categories}
  placeholder="All Categories"
  label="Category Filter"
/>
```

#### TagSelector
A tag selection component with search and multiple selection support.

**Props:**
- `availableTags` (array): Available tags
- `selectedTagIds` (array): Selected tag IDs
- `onChange` (function): Selection change handler
- `category` (string): Tag category
- `selectionMode` (string, default: "multiple"): Selection mode
- `maxSelection` (number): Maximum selections
- `allowCreate` (boolean): Allow creating new tags
- `theme` (string, default: "dark"): Theme variant

**Example:**
```javascript
<TagSelector 
  availableTags={interestTags}
  selectedTagIds={selectedInterests}
  onChange={handleTagChange}
  selectionMode="multiple"
  maxSelection={10}
  theme="dark"
/>
```

#### PopupForm
A modal form component with flexible field configuration.

**Props:**
- `isOpen` (boolean): Modal open state
- `onClose` (function, required): Close handler
- `onSubmit` (function, required): Submit handler
- `title` (string, default: "Submit Form"): Modal title
- `subtitle` (string): Modal subtitle
- `fields` (array, required): Form field configuration
- `loading` (boolean): Loading state
- `size` (string, default: "medium"): Modal size

**Example:**
```javascript
<PopupForm 
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onSubmit={handleSubmit}
  title="Submit Your Idea"
  fields={[
    {
      name: 'title',
      type: 'text',
      label: 'Idea Title',
      required: true,
      maxLength: 120
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
      required: true,
      rows: 4
    }
  ]}
/>
```

### 🔄 Feedback

#### LoadingIndicator
A flexible loading indicator component with multiple variants.

**Props:**
- `variant` (string, default: "spinner"): Loading animation type
- `size` (string, default: "medium"): Size variant
- `color` (string, default: "primary"): Color theme
- `text` (string, default: "Loading..."): Loading text
- `showText` (boolean, default: true): Show text
- `centered` (boolean, default: true): Center alignment
- `fullHeight` (boolean, default: false): Full height container

**Example:**
```javascript
<LoadingIndicator 
  variant="spinner"
  size="medium"
  text="Loading dashboard..."
  fullHeight={true}
/>
```

### 📊 Tables

#### SecurityQuestionsTable
A security questions management interface.

**Props:**
- `availableQuestions` (array, required): Available security questions
- `onSave` (function): Save handler
- `loading` (boolean): Loading state
- `title` (string): Table title
- `maxQuestions` (number, default: 2): Maximum questions

**Example:**
```javascript
<SecurityQuestionsTable 
  availableQuestions={securityQuestions}
  onSave={handleSaveQuestions}
  loading={saving}
  maxQuestions={2}
/>
```

#### PasskeysTable
A passkeys (recovery codes) management interface.

**Props:**
- `passkeys` (array): Current passkeys
- `onGenerate` (function): Generate handler
- `loading` (boolean): Loading state
- `title` (string): Table title
- `showConfirmation` (boolean, default: true): Show confirmation dialog

**Example:**
```javascript
<PasskeysTable 
  passkeys={recoveryKeys}
  onGenerate={handleGenerateKeys}
  loading={generating}
  showConfirmation={true}
/>
```

#### LinkedAccountsTable
A social account linking management interface.

**Props:**
- `linkedAccounts` (array): Currently linked accounts
- `onUnlink` (function): Unlink handler
- `onLink` (function): Link handler
- `loading` (boolean): Loading state
- `availableProviders` (array): Available OAuth providers

**Example:**
```javascript
<LinkedAccountsTable 
  linkedAccounts={connectedAccounts}
  onUnlink={handleUnlinkAccount}
  onLink={handleLinkAccount}
  availableProviders={['google', 'discord', 'twitter']}
/>
```

## 🎨 Styling & Theming

All components support:
- **Dark/Light themes**: Most components have `theme` or `variant` props
- **Size variants**: `small`, `medium`, `large` sizing options
- **Custom styling**: `className` prop for additional CSS classes
- **Responsive design**: Mobile-first responsive breakpoints

## 🔧 Component Variants

### Size Variants
- `small`: Compact sizing for dense layouts
- `medium`: Default sizing for most use cases
- `large`: Prominent sizing for primary actions

### Style Variants
- `primary`: Main brand styling with purple gradient
- `secondary`: Subtle gray styling
- `ghost`: Transparent background styling
- `outline`: Border-only styling
- `danger`: Red styling for destructive actions

### Theme Variants
- `dark`: Dark theme (default)
- `light`: Light theme for admin interfaces

## 📱 Responsive Behavior

All components include responsive breakpoints:
- **768px and below**: Tablet adjustments
- **480px and below**: Mobile-specific styling with `calc()` font reductions

## ♿ Accessibility

Components include:
- ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader compatible markup
- High contrast color schemes

## 🧪 Testing

Each component includes:
- PropTypes validation
- Default prop values
- Error handling for edge cases
- Loading and disabled states

## 📚 Best Practices

1. **Import only what you need** to optimize bundle size
2. **Use appropriate variants** for consistent styling
3. **Handle loading states** for better UX
4. **Provide meaningful labels** for accessibility
5. **Test responsive behavior** across devices
6. **Follow the naming conventions** established in the codebase

## 🔗 Related Documentation

- [User Component Architecture](./architecture.md)
- [Styling Guidelines](./styling.md)
- [Testing Components](./testing.md)
- [Contributing Guidelines](./contributing.md)

---

*This component library was extracted from the existing user interface components to promote reusability and maintainability across the application.*
