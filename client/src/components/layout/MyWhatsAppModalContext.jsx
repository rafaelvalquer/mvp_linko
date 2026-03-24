import { createContext, useContext } from "react";

const MyWhatsAppModalContext = createContext({
  openMyWhatsAppModal: () => {},
  closeMyWhatsAppModal: () => {},
});

export function MyWhatsAppModalProvider({ value, children }) {
  return (
    <MyWhatsAppModalContext.Provider value={value}>
      {children}
    </MyWhatsAppModalContext.Provider>
  );
}

export function useMyWhatsAppModal() {
  return useContext(MyWhatsAppModalContext);
}
