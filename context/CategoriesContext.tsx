import React, { createContext, ReactNode, useContext, useState } from 'react';

interface Category {
  label: string;
  color: string;
}

interface CategoriesContextType {
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

// donde van a estar las categorías así se comparten entre screens
export const CategoriesProvider = ({ children }: { children: ReactNode }) => {
  
  const DEFAULT_COLORS = [
    '#FF3B30',
    '#34C759',
    '#007AFF',
    '#FF9500',
    '#AF52DE',
  ];

  const [categories, setCategories] = useState<Category[]>([
    { label: 'Cosa 1', color: DEFAULT_COLORS[0] },
    { label: 'Cosa 2', color: DEFAULT_COLORS[1] },
  ]);

  const value = { categories, setCategories };

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
};

// hook
export const useCategories = () => {
  const context = useContext(CategoriesContext);
  if (context === undefined) {
    throw new Error('useCategories debe ser usado dentro de un CategoriesProvider');
  }
  return context;
};