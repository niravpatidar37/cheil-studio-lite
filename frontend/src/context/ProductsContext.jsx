import { createContext, useContext, useEffect, useState } from "react";
import { getProducts } from "../lib/api";

const ProductsContext = createContext({ products: {}, loading: true });

export function ProductsProvider({ children }) {
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <ProductsContext.Provider value={{ products, loading }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  return useContext(ProductsContext);
}
