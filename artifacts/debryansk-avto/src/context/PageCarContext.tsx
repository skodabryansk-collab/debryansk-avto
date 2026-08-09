import React, { createContext, useContext } from "react";

export interface PageCarInfo {
  carId: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  isNew: boolean;
  bodyType?: string;
  run?: number;
}

const PageCarContext = createContext<PageCarInfo | null>(null);

export function PageCarProvider({
  car,
  children,
}: {
  car: PageCarInfo;
  children: React.ReactNode;
}) {
  return (
    <PageCarContext.Provider value={car}>
      {children}
    </PageCarContext.Provider>
  );
}

export function usePageCar(): PageCarInfo | null {
  return useContext(PageCarContext);
}
