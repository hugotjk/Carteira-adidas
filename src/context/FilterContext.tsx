import React, { createContext, useContext, useState, ReactNode } from "react";
import { Filters, FilterType } from "../types";

interface FilterContextType {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  updateFilter: (type: FilterType, values: string[]) => void;
  clearFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<Filters>({});

  const updateFilter = (type: FilterType, values: string[]) => {
    setFilters((prev) => ({
      ...prev,
      [type]: values.length > 0 ? values : undefined,
    }));
  };

  const clearFilters = () => setFilters({});

  return (
    <FilterContext.Provider value={{ filters, setFilters, updateFilter, clearFilters }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return context;
};
